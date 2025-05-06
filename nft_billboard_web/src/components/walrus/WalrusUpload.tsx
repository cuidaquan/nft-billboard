import React, { useState, useRef, useEffect } from 'react';
import { Button, Upload, message, Radio, Spin, Form, Input, Progress, Tooltip, Card } from 'antd';
import { UploadOutlined, CheckCircleOutlined, InfoCircleOutlined, InboxOutlined, FileOutlined, LinkOutlined, LoadingOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/lib/upload';
import { walrusService, CustomSigner } from '../../utils/walrus';
import './WalrusUpload.scss';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { DEFAULT_NETWORK } from '../../config/config';
import { WALRUS_CONFIG } from '../../config/walrusConfig';
import { useTranslation } from 'react-i18next';
import { useWalletTransaction } from '../../hooks/useWalletTransaction';

const { Dragger } = Upload;

// 允许的文件类型
const ALLOWED_FILE_TYPES = [
  // 图片
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  // 视频
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime' // .mov 文件
];

// 文件大小限制 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface WalrusUploadProps {
  onSuccess?: (url: string, blobId?: string, storageSource?: string) => void;
  onError?: (error: Error) => void;
  leaseDays?: number;
  customStartTime?: number; // 自定义开始时间（Unix时间戳，秒）
  onChange?: (data: { url: string; blobId?: string; storageSource: string }) => void;
  hideStorageSelector?: boolean; // 是否隐藏存储模式选择器
  aspectRatio?: string; // 新增：广告位比例，如 "16:9"
  walletBalance?: string; // 钱包SUI余额
  walBalance?: string; // 钱包WAL余额
  insufficientBalance?: boolean; // SUI余额是否不足
}

// 上传阶段枚举
type UploadStage = 'preparing' | 'firstSigning' | 'uploading' | 'secondSigning' | 'finalizing' | 'completed' | 'idle';

/**
 * Walrus文件上传组件
 * 支持外部URL和Walrus上传两种模式
 * 可以通过hideStorageSelector属性控制是否显示存储模式选择器
 */
const WalrusUpload: React.FC<WalrusUploadProps> = ({
  onSuccess,
  onError,
  leaseDays = WALRUS_CONFIG.DEFAULT_LEASE_DAYS,
  customStartTime,
  onChange,
  hideStorageSelector = false, // 默认显示存储模式选择器
  aspectRatio, // 广告位比例
  walletBalance = '0', // 钱包SUI余额
  walBalance = '0', // 钱包WAL余额
  insufficientBalance = false // SUI余额是否不足
}) => {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [storageMode, setStorageMode] = useState<'walrus' | 'external'>('walrus');
  const [externalUrl, setExternalUrl] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [isImage, setIsImage] = useState(true);
  // 上传进度状态
  const [uploadProgress, setUploadProgress] = useState(0);
  // 上传阶段状态
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  // 上传文件名称
  const [uploadingFileName, setUploadingFileName] = useState('');
  // 使用useRef跟踪当前上传阶段，避免异步更新问题
  const currentStageRef = useRef<UploadStage>('idle');
  // 进度条动画定时器
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 跟踪签名次数
  const [signingCount, setSigningCount] = useState(0);
  // 使用ref跟踪签名次数，避免异步更新问题
  const signingCountRef = useRef(0);

  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { executeTransaction } = useWalletTransaction();

  // 从配置获取当前网络
  const networkConfig = DEFAULT_NETWORK;

  // 根据网络配置构建链ID
  let chainId: `${string}:${string}` = `sui:${networkConfig}`;

  console.log(`使用网络配置: ${chainId}`);

  // 创建符合CustomSigner接口的对象
  const createSigner = (): CustomSigner => {
    if (!account?.address) {
      throw new Error('钱包未连接');
    }

    return {
      // 签名交易方法
      signTransaction: async (tx: any) => {
        console.log('准备签名交易，交易对象:', tx);

        // 更新上传阶段为第一次签名中
        updateUploadStage('firstSigning');

        // 确保交易对象包含 sender 信息
        if (tx && typeof tx === 'object' && 'setSender' in tx && typeof tx.setSender === 'function') {
          console.log('设置交易发送者为:', account.address);
          tx.setSender(account.address);
        }

        // 特殊处理Uint8Array类型的交易数据
        if (tx instanceof Uint8Array) {
          console.log('检测到交易对象是Uint8Array类型，尝试转换为Transaction对象');

          try {
            // 使用Transaction.from将二进制数据转换为Transaction对象
            const transactionBlock = Transaction.from(tx);
            console.log('成功将Uint8Array转换为Transaction对象', transactionBlock);

            // 确保设置发送者
            if ('setSender' in transactionBlock && typeof transactionBlock.setSender === 'function') {
              transactionBlock.setSender(account.address);
            }

            // 根据签名计数判断是第几次签名
            const isFirstSigning = signingCountRef.current === 0;
            console.log(`准备执行签名，当前签名计数: ${signingCountRef.current}, 是第一次签名: ${isFirstSigning}`);

            // 显示相应的签名提示
            message.loading({
              content: isFirstSigning
                ? t('walrusUpload.progress.firstSigning')
                : t('walrusUpload.progress.secondSigning'),
              key: 'walrusUpload',
              duration: 0
            });

            const { success, result } = await executeTransaction(transactionBlock, {
              loadingMessage: t('walrusUpload.progress.signing'),
              successMessage: t('walrusUpload.progress.signSuccess'),
              loadingKey: 'walrusUpload',
              successKey: 'walrusUpload',
              userRejectedMessage: t('common.messages.userRejected')
            });

            // 如果交易被用户拒绝或失败，直接返回
            if (!success) {
              throw new Error(t('common.messages.userRejected'));
            }

            const response = result;

            // 第一次签名完成后更新进度为上传中
            // 只有在当前不是secondSigning状态时才更新为uploading
            if (currentStageRef.current !== 'secondSigning') {
              console.log(`第一次签名完成，更新进度为上传中，将自动从15%推进到95%`);
              updateUploadStage('uploading');
            } else {
              console.log(`当前已经是secondSigning状态，不更新为uploading状态`);
            }

            if (!response) {
              throw new Error('交易签名未返回结果');
            }

            return response;
          } catch (err: any) {
            console.error('无法处理Uint8Array类型的交易:', err);

            // 检查是否是用户拒绝交易
            if (err.message && (
              err.message.includes('User rejected') ||
              err.message.includes('User cancelled') ||
              err.message.includes('User denied') ||
              err.message.includes('用户拒绝') ||
              err.message.includes('用户取消') ||
              err.message.includes(t('common.messages.userRejected'))
            )) {
              // 用户拒绝交易，显示友好提示
              message.info({
                content: t('common.messages.userRejected'),
                key: 'walrusUpload',
                duration: 2
              });
              throw new Error(t('common.messages.userRejected'));
            } else {
              // 其他错误
              throw new Error(`${t('walrusUpload.upload.blobUploadFailed')}: ${err.message || t('common.messages.unknown')}`);
            }
          }
        }

        // 将交易对象转换为兼容格式
        let transactionToSign = tx;

        // 确保交易对象具有toJSON方法
        if (tx && typeof tx === 'object' && !('toJSON' in tx)) {
          console.log('为交易对象添加toJSON方法');

          // 创建一个包装对象，提供所需的方法
          transactionToSign = {
            ...tx,
            toJSON: function() {
              if (this.serialize && typeof this.serialize === 'function') {
                return this.serialize();
              }
              return this;
            }
          };
        }

        // 使用 Promise 包装 signAndExecute 调用，确保它返回结果
        try {
          // 根据签名计数判断是第几次签名
          const isFirstSigning = signingCountRef.current === 0;
          console.log(`准备执行签名，当前签名计数: ${signingCountRef.current}, 是第一次签名: ${isFirstSigning}`);

          // 显示相应的签名提示
          message.loading({
            content: isFirstSigning
              ? t('walrusUpload.progress.firstSigning')
              : t('walrusUpload.progress.secondSigning'),
            key: 'walrusUpload',
            duration: 0
          });

          const { success, result } = await executeTransaction(transactionToSign, {
            loadingMessage: t('walrusUpload.progress.signing'),
            successMessage: t('walrusUpload.progress.signSuccess'),
            loadingKey: 'walrusUpload',
            successKey: 'walrusUpload',
            userRejectedMessage: t('common.messages.userRejected')
          });

          // 如果交易被用户拒绝或失败，直接返回
          if (!success) {
            throw new Error(t('common.messages.userRejected'));
          }

          const response = result;

          // 第一次签名完成后更新进度为上传中
          // 只有在当前不是secondSigning状态时才更新为uploading
          if (currentStageRef.current !== 'secondSigning') {
            console.log(`第一次签名完成，更新进度为上传中，将自动从15%推进到95%`);
            updateUploadStage('uploading');
          } else {
            console.log(`当前已经是secondSigning状态，不更新为uploading状态`);
          }

          if (!response) {
            throw new Error('交易签名未返回结果');
          }

          return response;
        } catch (err: any) {
          console.error('交易签名最终失败:', err);

          // 检查是否是用户拒绝交易
          if (err.message && (
            err.message.includes('User rejected') ||
            err.message.includes('User cancelled') ||
            err.message.includes('User denied') ||
            err.message.includes('用户拒绝') ||
            err.message.includes('用户取消') ||
            err.message.includes(t('common.messages.userRejected'))
          )) {
            // 用户拒绝交易，显示友好提示
            message.info({
              content: t('common.messages.userRejected'),
              key: 'walrusUpload',
              duration: 2
            });
            throw new Error(t('common.messages.userRejected'));
          } else {
            // 其他错误
            throw new Error(`${t('walrusUpload.upload.blobUploadFailed')}: ${err.message || t('common.messages.unknown')}`);
          }
        }
      },

      // 获取 Sui 地址
      toSuiAddress: () => {
        return account.address;
      },

      // 地址属性
      address: account.address
    };
  };

  // 检查URL是否为图片或视频
  const checkMediaType = (url: string) => {
    const lowerCaseUrl = url.toLowerCase();
    // 检查图片扩展名
    if (lowerCaseUrl.endsWith('.jpg') || lowerCaseUrl.endsWith('.jpeg') ||
        lowerCaseUrl.endsWith('.png') || lowerCaseUrl.endsWith('.gif') ||
        lowerCaseUrl.endsWith('.webp') || lowerCaseUrl.endsWith('.bmp')) {
      return 'image';
    }
    // 检查视频扩展名
    if (lowerCaseUrl.endsWith('.mp4') || lowerCaseUrl.endsWith('.webm') ||
        lowerCaseUrl.endsWith('.ogg') || lowerCaseUrl.endsWith('.mov')) {
      return 'video';
    }
    // 默认当作图片处理
    return 'image';
  };

  // 验证URL是否有效
  const isValidUrl = (url: string): boolean => {
    try {
      // 检查URL是否包含协议
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return false;
      }

      // 检查URL是否至少包含域名部分
      const urlObj = new URL(url);
      return !!urlObj.hostname;
    } catch (e) {
      return false;
    }
  };

  const handleUpload = async (file: RcFile) => {
    if (!account?.address) {
      message.error(t('walrusUpload.upload.connectWalletError'));
      return false;
    }

    // 检查SUI余额是否不足
    if (insufficientBalance) {
      // 使用"购买广告位"作为价格描述，而不是具体数值
      message.error(t('nftDetail.transaction.insufficientBalanceGeneric', {
        balance: walletBalance
      }));
      return false;
    }

    // 检查WAL余额是否为0（仅在Walrus模式下）
    if (storageMode === 'walrus' && walBalance === '0') {
      message.error(t('walrusUpload.upload.noWalBalance'));
      return false;
    }

    // 检查文件类型
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      message.error(t('walrusUpload.upload.unsupportedType'));
      return false;
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
      // 先使用 t() 函数处理占位符替换，然后将结果传递给 message.error
      const errorMsg = t('walrusUpload.upload.fileTooLarge', { size: fileSizeMB });
      message.error(errorMsg);
      return false;
    }

    // 检查当前是否已经在上传中
    if (uploading) {
      console.log('当前已经在上传中，不重复启动上传流程');
      return false;
    }

    setUploading(true);
    // 重置上传状态并设置为准备中
    setUploadingFileName(file.name);
    // 确保进度条从0开始
    setUploadProgress(0);
    // 重置签名计数
    signingCountRef.current = 0;
    setSigningCount(0);
    // 重置当前状态引用
    currentStageRef.current = 'idle';
    console.log('开始新的上传，重置签名计数为0，当前状态为idle');
    updateUploadStage('preparing');

    try {
      // 计算存储时长，考虑自定义开始时间
      let duration = leaseDays * 24 * 60 * 60; // 基础租期（秒）

      // 如果设置了自定义开始时间，计算额外的存储时间
      if (customStartTime) {
        const now = Math.floor(Date.now() / 1000); // 当前时间（秒）
        if (customStartTime > now) {
          // 如果自定义时间在未来，增加额外的存储时间
          const extraTime = customStartTime - now;
          duration += extraTime;
          console.log(`检测到自定义开始时间，增加额外存储时间: ${Math.floor(extraTime / 86400)} 天`);
        }
      }

      // 创建Signer对象
      const signer = createSigner();

      // 在uploadFile调用前确保进度为上传中
      // 这里不需要再次调用updateUploadStage，因为在签名完成后已经更新了状态

      // 定义第二次签名开始的回调函数
      const handleSecondSigningStart = () => {
        console.log('===== 第二次签名开始 =====');
        console.log('当前阶段:', uploadStage);
        console.log('当前进度:', uploadProgress);
        console.log('签名计数:', signingCountRef.current);
        console.log('当前状态引用:', currentStageRef.current);

        // 停止所有正在进行的进度条自动推进
        if (progressTimerRef.current) {
          console.log('停止当前的进度条自动推进');
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }

        // 显示第二次签名提示
        message.loading({
          content: t('walrusUpload.progress.secondSigning'),
          key: 'walrusUpload',
          duration: 0
        });

        // 检查当前状态，如果已经是secondSigning，则不需要再次更新
        if (currentStageRef.current === 'secondSigning') {
          console.log('当前已经是secondSigning状态，不需要再次更新');
        } else {
          // 强制设置为secondSigning状态
          console.log('强制更新状态为secondSigning');
          updateUploadStage('secondSigning');
        }

        // 获取当前实际进度，避免使用可能已过期的uploadProgress状态
        // 如果当前进度小于95%，强制设置为95%
        const currentActualProgress = uploadProgress;
        if (currentActualProgress < 95) {
          console.log(`当前进度(${currentActualProgress}%)小于95%，强制设置为95%`);
          setUploadProgress(95);
        } else {
          console.log(`当前进度(${currentActualProgress}%)已经达到或超过95%，保持不变`);
        }

        // 记录详细的状态信息
        console.log(`第二次签名状态详情：
          - 当前阶段: ${currentStageRef.current}
          - 目标阶段: secondSigning
          - 当前进度: ${currentActualProgress}%
          - 目标进度: 95%
          - 签名计数: ${signingCountRef.current}
        `);

        console.log('===== 第二次签名状态更新完成 =====');
      };

      // 使用新的接口调用uploadFile，传递第二次签名回调函数
      const result = await walrusService.uploadFile(
        file,
        duration,
        account.address,
        signer,
        leaseDays, // 传递租赁天数，用于日志记录
        handleSecondSigningStart // 传递第二次签名回调函数
      );

      // 文件上传和签名都已完成，显示成功消息
      message.success({
        content: t('walrusUpload.progress.signSuccess'),
        key: 'walrusUpload',
        duration: 1
      });

      // 进入最终处理阶段
      updateUploadStage('finalizing');

      // 短暂延迟后完成整个过程
      setTimeout(() => {
        // 最终完成
        updateUploadStage('completed');

        // 设置上传成功状态和URL
        setUploadSuccess(true);
        setUploadedUrl(result.url);
        // 根据文件扩展名判断是图片还是视频
        setIsImage(checkMediaType(file.name) === 'image');

        message.success(t('walrusUpload.upload.uploadSuccess'));
        onSuccess?.(result.url, result.blobId, 'walrus');

        // 通知父组件内容变更
        onChange?.({
          url: result.url,
          blobId: result.blobId,
          storageSource: 'walrus'
        });
      }, 1000);

    } catch (error) {
      console.error('文件上传失败:', error);
      const err = error instanceof Error ? error : new Error(String(error));

      // 检查是否是用户拒绝交易
      if (err.message && (
        err.message.includes('User rejected') ||
        err.message.includes('User cancelled') ||
        err.message.includes('User denied') ||
        err.message.includes('用户拒绝') ||
        err.message.includes('用户取消') ||
        err.message.includes(t('common.messages.userRejected'))
      )) {
        // 用户拒绝交易，显示友好提示
        message.info({
          content: t('common.messages.userRejected'),
          key: 'walrusUpload',
          duration: 2
        });
      } else {
        // 其他错误
        message.error({
          content: `${t('walrusUpload.upload.uploadFailed')}: ${err.message}`,
          key: 'walrusUpload',
          duration: 3
        });
      }

      onError?.(err);

      // 停止进度自动推进
      if (progressTimerRef.current) {
        console.log('上传失败，停止自动推进');
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      // 记录错误时的状态信息
      console.log(`上传失败时的状态信息：
        - 当前阶段: ${currentStageRef.current}
        - 当前进度: ${uploadProgress}%
        - 签名计数: ${signingCountRef.current}
      `);

      // 重置上传状态
      updateUploadStage('idle');
    } finally {
      // 不要在这里马上设置uploading为false，而是在updateUploadStage('completed')后延迟设置
      // 使用类型断言确保TypeScript理解这是有效的比较
      const currentStage = currentStageRef.current as UploadStage;
      if (currentStage !== 'completed') {
        setUploading(false);
      } else {
        // 给用户一个短暂的时间看到100%完成状态
        setTimeout(() => {
          setUploading(false);
        }, 1500);
      }
    }
    return false;
  };

  // 构建accept属性，用于文件选择对话框中筛选文件类型
  const acceptFileTypes = '.jpg,.jpeg,.png,.gif,.webp,.bmp,.mp4,.webm,.mov,.ogg';

  const uploadProps = {
    name: 'file',
    multiple: false,
    beforeUpload: handleUpload,
    showUploadList: false,
    disabled: uploading || !account?.address || insufficientBalance || (storageMode === 'walrus' && walBalance === '0'),
    accept: acceptFileTypes, // 添加accept属性，限制文件选择对话框中显示的文件类型
  };

  const handleExternalUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setExternalUrl(url);
    setPreviewError(false);

    // 始终通知父组件URL变化，但不设置为成功状态
    onChange?.({
      url: url,
      storageSource: 'external'
    });

    if (url) {
      // 显示预览（即使URL不完全有效，也可以尝试预览）
      setPreviewVisible(true);

      // 不自动设置成功状态，需要用户点击确认按钮
      setUploadSuccess(false);
    } else {
      // URL为空
      setPreviewVisible(false);
      setUploadSuccess(false);
    }
  };

  const handleImageError = () => {
    setPreviewError(true);
    message.error(t('walrusUpload.external.loadError'));
  };

  const handleModeChange = (e: any) => {
    const mode = e.target.value;
    setStorageMode(mode);

    // 清空另一种模式的数据
    if (mode === 'external') {
      // 切换到外部URL模式时，只通知父组件模式变更
      // 不自动设置成功状态，需要用户点击确认按钮
      if (externalUrl) {
        onChange?.({
          url: externalUrl,
          storageSource: 'external'
        });
      }
      // 重置成功状态，等待用户确认
      setUploadSuccess(false);
    } else {
      // 切换到Walrus模式时，清空外部URL
      setExternalUrl('');
      setPreviewVisible(false);
      setPreviewError(false);
      // 如果之前没有上传过文件，重置上传成功状态
      if (!uploadedUrl || uploadedUrl === externalUrl) {
        setUploadSuccess(false);
        setUploadedUrl('');
      }
    }
  };

  // 获取上传阶段的描述文本
  const getUploadStageText = () => {
    switch (uploadStage) {
      case 'preparing':
        return t('walrusUpload.progress.preparing');
      case 'firstSigning':
        return t('walrusUpload.progress.firstSigning');
      case 'uploading':
        return t('walrusUpload.progress.uploading');
      case 'secondSigning':
        return t('walrusUpload.progress.secondSigning');
      case 'finalizing':
        return t('walrusUpload.progress.finalizing');
      case 'completed':
        return t('walrusUpload.progress.completed');
      default:
        return '';
    }
  };

  // 平滑更新进度条
  const updateProgressSmoothly = (
    startValue: number,
    endValue: number,
    duration: number = 1000,
    onComplete?: () => void
  ) => {
    // 清除之前的定时器
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    // 设置初始值
    setUploadProgress(startValue);

    // 计算步长和间隔
    const steps = Math.max(20, Math.floor(duration / 30)); // 至少20步，每30ms一步，使动画更平滑
    const interval = duration / steps;

    let currentStep = 0;
    let lastProgress = startValue;

    // 创建定时器
    progressTimerRef.current = setInterval(() => {
      currentStep++;

      if (currentStep >= steps) {
        // 最后一步，确保达到目标值
        setUploadProgress(endValue);
        clearInterval(progressTimerRef.current as NodeJS.Timeout);
        progressTimerRef.current = null;

        // 执行完成回调
        if (onComplete) {
          onComplete();
        }
      } else {
        // 使用缓动函数使进度更自然
        // 使用二次缓动函数：t^2 (加速) 或 1-(1-t)^2 (减速)
        let progress;
        const t = currentStep / steps;

        if (endValue > startValue) {
          // 上升进度使用减速缓动
          progress = startValue + (endValue - startValue) * (1 - Math.pow(1 - t, 2));
        } else {
          // 下降进度使用加速缓动
          progress = startValue + (endValue - startValue) * (t * t);
        }

        // 确保进度至少增加1%，避免看起来停滞
        const roundedProgress = Math.round(progress);
        if (roundedProgress === Math.round(lastProgress) && currentStep % 3 === 0) {
          lastProgress += (endValue > startValue ? 1 : -1);
          setUploadProgress(Math.min(Math.max(0, Math.round(lastProgress)), 100));
        } else {
          lastProgress = progress;
          setUploadProgress(Math.min(Math.max(0, roundedProgress), 100));
        }
      }
    }, interval);
  };

  // 不添加超时检查，让状态自然转换
  // 上传完成后，Walrus SDK 会调用 handleSecondSigningStart 函数
  // 将状态从 uploading 转换为 secondSigning

  // 更新上传阶段，同时更新进度条
  const updateUploadStage = (stage: UploadStage, progress?: number) => {
    // 获取当前进度值，用于平滑过渡
    const currentProgress = uploadProgress;

    // 记录状态变化，用于调试
    console.log(`状态变化: ${currentStageRef.current} -> ${stage}, 签名计数: ${signingCountRef.current}`);

    // 特殊处理签名状态
    if (stage === 'firstSigning') {
      // 增加签名计数
      signingCountRef.current += 1;
      console.log(`签名计数增加: ${signingCountRef.current}`);

      // 如果之前的状态是uploading，说明这是第二次签名
      if (currentStageRef.current === 'uploading') {
        console.log('检测到第二次签名，修正状态为secondSigning');
        stage = 'secondSigning';
      }
    }

    // 防止状态回退
    // 如果当前是secondSigning状态，不允许回退到uploading状态
    if (currentStageRef.current === 'secondSigning' && stage === 'uploading') {
      console.log('防止状态回退：当前已经是secondSigning状态，不允许回退到uploading状态');
      return; // 直接返回，不执行后续的状态更新
    }

    // 检查是否需要停止自动推进
    // 如果从 preparing 或 uploading 状态切换到其他状态，停止自动推进
    if ((currentStageRef.current === 'preparing' || currentStageRef.current === 'uploading') &&
        (stage !== 'preparing' && stage !== 'uploading')) {
      if (progressTimerRef.current) {
        console.log(`从${currentStageRef.current}状态切换到${stage}状态，停止自动推进`);
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }

    // 更新引用值，用于同步状态
    currentStageRef.current = stage;

    // 更新状态
    setUploadStage(stage);

    // 同步更新签名计数状态
    setSigningCount(signingCountRef.current);

    // 定义每个阶段的进度范围
    const stageProgressRanges = {
      'preparing': [0, 15],
      'firstSigning': [15, 15],  // 固定值15%
      'uploading': [15, 95],     // 上传阶段占大部分时间
      'secondSigning': [95, 95], // 固定值95%
      'finalizing': [95, 100],
      'completed': [100, 100],   // 固定值100%
      'idle': [0, 0]
    };

    // 根据阶段设置进度条
    if (stage === 'idle') {
      // 重置进度
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setUploadProgress(0);
    } else if (progress !== undefined) {
      // 如果提供了明确的进度值，直接设置
      setUploadProgress(progress);
    } else {
      // 获取当前阶段的进度范围
      const [startProgress, endProgress] = stageProgressRanges[stage] || [0, 0];

      // 确保进度只增不减
      const effectiveStartProgress = Math.max(currentProgress, startProgress);

      // 如果当前进度已经超过了这个阶段的结束进度，不做任何更改
      if (currentProgress < endProgress) {
        // 对于 preparing 和 uploading 状态，使用自动推进
        if (stage === 'preparing' || stage === 'uploading') {
          console.log(`进入${stage}阶段，启动匀速自动推进，当前进度: ${effectiveStartProgress}%，目标进度: ${endProgress}%`);

          // 启动自动推进
          if (progressTimerRef.current) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
          }

          // 使用每秒1.5%的固定增长率
          const progressPerSecond = 1.5; // 每秒增长1.5%
          const intervalMs = 100; // 更新间隔（毫秒）
          const progressPerInterval = progressPerSecond * (intervalMs / 1000); // 每次更新增长的百分比

          console.log(`匀速自动推进: 每秒${progressPerSecond}%, 每${intervalMs}ms ${progressPerInterval.toFixed(4)}%`);

          // 创建一个进度引用，用于跟踪当前进度
          const progressRef = { current: effectiveStartProgress };

          // 创建定时器，定期增加进度
          progressTimerRef.current = setInterval(() => {
            // 使用引用获取当前进度，避免闭包问题
            const currentProgress = progressRef.current;

            // 如果当前进度已经达到或超过目标进度，停止定时器
            if (currentProgress >= endProgress) {
              if (progressTimerRef.current) {
                console.log(`${stage}阶段进度已达到目标值 ${endProgress}%，停止自动推进，当前阶段: ${currentStageRef.current}`);
                clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
              }
              return;
            }

            // 检查当前阶段是否仍然是 preparing 或 uploading
            if (currentStageRef.current !== stage) {
              console.log(`检测到阶段变化: ${stage} -> ${currentStageRef.current}，停止自动推进`);
              if (progressTimerRef.current) {
                clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
              }
              return;
            }

            // 计算新的进度，确保不超过目标进度
            // 对于 uploading 状态，我们使用加速增长，确保不会停在中间位置
            let newProgress;
            if (stage === 'uploading') {
              // 使用匀速增长，每秒增长1%
              const baseIncrement = progressPerInterval;
              const speedMultiplier = 1.0; // 固定速度倍率为1.0，保持匀速

              // 计算实际增量
              const actualIncrement = baseIncrement * speedMultiplier;

              // 计算新进度
              newProgress = Math.min(currentProgress + actualIncrement, endProgress);

              // 不需要记录速度调整，因为使用匀速
            } else {
              // 其他状态使用正常增长
              newProgress = Math.min(currentProgress + progressPerInterval, endProgress);
            }

            // 更新引用值
            progressRef.current = newProgress;

            // 计算整数进度值
            const intProgress = Math.floor(newProgress);

            // 更新进度条，只使用整数值
            setUploadProgress(intProgress);

            // 每1%记录一次日志
            if (intProgress !== Math.floor(currentProgress)) {
              console.log(`${stage}阶段进度更新: ${intProgress}%，当前阶段: ${currentStageRef.current}`);
            }
          }, intervalMs);
        } else {
          // 对于其他状态，使用平滑过渡
          updateProgressSmoothly(effectiveStartProgress, endProgress);
        }
      }
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      // 清理所有定时器
      if (progressTimerRef.current) {
        console.log('组件卸载，清理所有定时器');
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, []);

  // 如果上传成功，直接显示媒体内容和URL
  if (uploadSuccess && uploadedUrl) {
    return (
      <div className="walrus-upload-success">
        <Card
          title={
            storageMode === 'external'
              ? t('purchase.form.externalUrlAlert')
              : t('walrusUpload.success.title')
          }
          className="uploaded-content-card"
        >
          <div className="uploaded-content-preview">
            {isImage ? (
              <img
                src={uploadedUrl}
                alt={t('walrusUpload.success.uploadedImage')}
                style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', margin: '0 auto' }}
                onError={handleImageError}
              />
            ) : (
              <video
                src={uploadedUrl}
                controls
                style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', margin: '0 auto' }}
              />
            )}
          </div>
          <div className="content-url">
            <p><LinkOutlined /> {t('walrusUpload.success.contentUrl')}</p>
            <a href={uploadedUrl} target="_blank" rel="noopener noreferrer">{uploadedUrl}</a>
          </div>
        </Card>
      </div>
    );
  }

  // 根据比例计算预览宽度
  const getRatioPreviewWidth = (ratio: string): string => {
    if (!ratio || !ratio.includes(':')) return '100%';

    const [w, h] = ratio.split(':').map(Number);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return '100%';

    if (w >= h) {
      return '100%';
    } else {
      // 对于竖向比例，按高度计算宽度
      return `${(w / h) * 100}%`;
    }
  };

  // 根据比例计算预览高度
  const getRatioPreviewHeight = (ratio: string): string => {
    if (!ratio || !ratio.includes(':')) return '100%';

    const [w, h] = ratio.split(':').map(Number);
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return '100%';

    if (w >= h) {
      // 对于横向比例，按宽度计算高度
      return `${(h / w) * 100}%`;
    } else {
      return '100%';
    }
  };

  return (
    <div className="walrus-upload-container">
      {/* 只有在hideStorageSelector为false时才显示存储模式选择器 */}
      {!hideStorageSelector && (
        <div className="storage-selector">
          <Radio.Group onChange={handleModeChange} value={storageMode}>
            <Radio value="walrus">{t('walrusUpload.storage.walrus')}</Radio>
            <Radio value="external">{t('walrusUpload.storage.external')}</Radio>
          </Radio.Group>
        </div>
      )}

      {/* 显示比例指南 */}
      {aspectRatio && (
        <div className="ratio-guidance" style={{
          backgroundColor: '#f0f8ff',
          padding: '12px 16px',
          borderRadius: '4px',
          marginBottom: '16px',
          border: '1px solid #e6f0ff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <InfoCircleOutlined style={{ color: '#1677ff', marginRight: '8px' }} />
            <span>{t('walrusUpload.upload.ratioGuidance', { ratio: aspectRatio })}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
            <div className="ratio-preview" style={{
              position: 'relative',
              width: '60px',
              height: '60px',
              margin: '0 16px 0 0',
              background: 'white',
              overflow: 'hidden',
              borderRadius: '4px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: getRatioPreviewWidth(aspectRatio),
                height: getRatioPreviewHeight(aspectRatio),
                background: '#e6f7ff',
                border: '1px solid #1677ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#1677ff'
              }}>
                {aspectRatio}
              </div>
            </div>
          </div>
        </div>
      )}

      {storageMode === 'walrus' ? (
        <>
          {uploading ? (
            <div className="upload-progress-container">
              <Card>
                <div className="upload-progress-header">
                  <LoadingOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 12 }} />
                  <h3>{t('walrusUpload.progress.uploading')}: {uploadingFileName}</h3>
                </div>
                <Progress
                  percent={uploadProgress}
                  status={uploadProgress < 100 ? "active" : "success"}
                  strokeColor={{
                    '0%': '#108ee9',
                    '50%': '#1677ff',
                    '100%': '#87d068',
                  }}
                  strokeWidth={6}
                  showInfo={true}
                  format={percent => `${percent ? percent.toFixed(0) : 0}%`}
                />
                <div className="upload-stage-info">
                  <div className="stage-text">
                    <span className="stage-icon">
                      {uploadStage === 'completed' ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <LoadingOutlined style={{ color: '#1890ff' }} />
                      )}
                    </span>
                    <span className="stage-description">{getUploadStageText()}</span>
                  </div>
                  {uploadStage === 'firstSigning' && (
                    <p className="upload-stage-hint upload-stage-hint-warning">
                      {t('walrusUpload.progress.firstSigningHint')}
                    </p>
                  )}
                  {uploadStage === 'secondSigning' && (
                    <p className="upload-stage-hint upload-stage-hint-warning">
                      {t('walrusUpload.progress.secondSigningHint')}
                    </p>
                  )}
                  {uploadStage === 'uploading' && (
                    <p className="upload-stage-hint upload-stage-hint-info">{t('walrusUpload.upload.hint')}</p>
                  )}
                  {uploadStage === 'completed' && (
                    <p className="upload-stage-hint upload-stage-hint-success">{t('walrusUpload.upload.uploadSuccess')}</p>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">
                {!account?.address
                  ? t('walrusUpload.upload.connectWalletFirst')
                  : insufficientBalance
                    ? t('nftDetail.transaction.insufficientBalanceGeneric', { balance: walletBalance })
                    : storageMode === 'walrus' && walBalance === '0'
                      ? t('walrusUpload.upload.noWalBalance')
                      : t('walrusUpload.upload.dragText')
                }
              </p>
              <p className="ant-upload-hint">
                {t('walrusUpload.upload.hint')}
              </p>
              <div className="upload-requirements">
                <p>{t('walrusUpload.upload.requirements')}</p>
                <p>{t('walrusUpload.upload.maxSize')}</p>
              </div>
            </Dragger>
          )}
        </>
      ) : (
        <div>
          <Form.Item>
            <div style={{ display: 'flex' }}>
              <Input
                placeholder={t('walrusUpload.external.placeholder')}
                value={externalUrl}
                onChange={handleExternalUrlChange}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                disabled={!externalUrl || !isValidUrl(externalUrl) || insufficientBalance}
                style={{
                  marginLeft: '8px',
                  height: '32px',
                  borderRadius: '4px',
                  background: 'linear-gradient(90deg, #4e63ff, #6e56cf)',
                  border: 'none',
                  boxShadow: '0 2px 6px rgba(78, 99, 255, 0.2)'
                }}
                title={insufficientBalance ? t('nftDetail.transaction.insufficientBalanceGeneric', { balance: walletBalance }) : ''}
                onClick={() => {
                  if (externalUrl && isValidUrl(externalUrl) && !insufficientBalance) {
                    // 通知父组件URL已确认
                    onSuccess?.(externalUrl, undefined, 'external');
                    // 设置上传成功状态
                    setUploadSuccess(true);
                    setUploadedUrl(externalUrl);
                    // 根据URL扩展名判断是图片还是视频
                    setIsImage(checkMediaType(externalUrl) === 'image');
                    // 显示成功消息
                    message.success(t('purchase.form.externalUrlSuccess'));
                  } else if (insufficientBalance) {
                    // 显示余额不足警告
                    message.error(t('nftDetail.transaction.insufficientBalanceGeneric', {
                      balance: walletBalance
                    }));
                  }
                }}
              >
                {t('walrusUpload.external.confirmUrl')}
              </Button>
            </div>
            <div className="upload-note">
              {t('walrusUpload.external.note')}
            </div>
          </Form.Item>

          {previewVisible && externalUrl && (
            <div className="external-url-preview">
              <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                <span>{t('walrusUpload.external.preview')}</span>
              </div>

              {previewError ? (
                <div className="preview-error">
                  <p>{t('walrusUpload.external.checkUrl')}</p>
                  <p>{t('walrusUpload.external.ensureImageUrl')}</p>
                  <Button
                    type="link"
                    onClick={() => window.open(externalUrl, '_blank')}
                  >
                    {t('walrusUpload.external.openInNewTab')}
                  </Button>
                </div>
              ) : (
                <div style={{ border: '1px dashed #d9d9d9', padding: '8px', borderRadius: '4px' }}>
                  <img
                    src={externalUrl}
                    alt={t('walrusUpload.success.uploadedImage')}
                    style={{ maxWidth: '100%', maxHeight: '200px', display: 'block', margin: '0 auto' }}
                    onError={handleImageError}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WalrusUpload;