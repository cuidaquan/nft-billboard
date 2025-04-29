import { WalrusClient } from '@mysten/walrus';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import type { WriteBlobOptions, ExtendBlobOptions } from '@mysten/walrus';
import type { Signer } from '@mysten/sui/cryptography';
import { WALRUS_CONFIG, getWalrusAggregatorUrl } from '../config/walrusConfig';

/**
 * 自定义签名器接口，兼容性更强
 */
export interface CustomSigner {
  signTransaction?: (tx: any) => Promise<any>;
  toSuiAddress: () => string;
  address?: string;
}

/**
 * Walrus服务类：负责与Walrus存储交互
 */
export class WalrusService {
  private client!: WalrusClient;
  private suiClient!: SuiClient;
  private readonly MAX_RETRIES = WALRUS_CONFIG.MAX_RETRIES;
  private readonly RETRY_DELAY = WALRUS_CONFIG.RETRY_DELAY;
  private walrusAggregatorUrl: string;

  constructor() {
    // 从配置获取网络类型
    const network = WALRUS_CONFIG.ENVIRONMENT;
    console.log('初始化 Walrus 服务，网络环境:', network);

    // 从配置获取聚合器URL
    this.walrusAggregatorUrl = getWalrusAggregatorUrl(network);
    console.log('Walrus 聚合器 URL:', this.walrusAggregatorUrl);

    // 初始化 SUI 客户端
    this.suiClient = new SuiClient({
      url: getFullnodeUrl(network),
    });

    try {
      // 初始化 Walrus 客户端
      this.client = new WalrusClient({
        // 网络环境配置
        network: network,
        // 由于类型不兼容问题，使用类型断言
        suiClient: this.suiClient as any,
        // 使用配置的WASM URL
        wasmUrl: WALRUS_CONFIG.WASM_URL,
        storageNodeClientOptions: {
          timeout: WALRUS_CONFIG.REQUEST_TIMEOUT,
          // 调整fetch参数类型
          fetch: ((url: RequestInfo, options?: RequestInit) =>
            this.fetchWithRetry(url.toString(), options || {}, this.MAX_RETRIES)) as any
        }
      });

      console.log('Walrus 客户端初始化完成');
    } catch (err) {
      console.error('Walrus 客户端初始化失败:', err);
    }
  }

  /**
   * 延迟指定时间
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 带重试的fetch请求
   */
  private async fetchWithRetry(url: string, options: any, retries = this.MAX_RETRIES): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(WALRUS_CONFIG.REQUEST_TIMEOUT)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} - ${response.statusText}\n${errorText}`);
      }
      return response;
    } catch (error) {
      if (retries > 0) {
        console.log(`请求失败，${retries}次重试机会剩余，等待${this.RETRY_DELAY}ms后重试...`);
        await this.delay(this.RETRY_DELAY);
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  /**
   * 上传文件到Walrus
   * @param file 要上传的文件
   * @param duration 存储时长(秒)
   * @param address 钱包地址
   * @param signer 签名对象
   * @returns Promise<{blobId: string, url: string}>
   */
  async uploadFile(
    file: File,
    duration: number,
    address: string,
    signer: Signer | CustomSigner,
    leaseDays?: number // 添加租赁天数参数，用于日志记录
  ): Promise<{ blobId: string, url: string }> {
    try {
      console.log(`正在上传文件到Walrus: ${file.name}, 大小: ${file.size} 字节`);

      // 将文件转换为 Uint8Array
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);

      // 计算存储时长（转换为epoch数，1个epoch约24小时）
      const epochs = Math.ceil(duration / (24 * 60 * 60));
      const durationDays = duration / (24 * 60 * 60);
      console.log(`文件将存储 ${epochs} 个epochs（约${epochs}天），原始时长: ${durationDays.toFixed(2)}天 (${duration}秒)`);

      // 如果存储时长超过租赁天数，记录额外的存储时间
      if (leaseDays !== undefined && durationDays > leaseDays) {
        console.log(`注意: 存储时长(${durationDays.toFixed(2)}天)超过了租赁天数(${leaseDays}天)，这可能是因为设置了未来的开始时间`);
      }

      try {
        console.log('开始写入blob数据至Walrus存储网络...');

        /**
         * WriteBlobOptions类型定义参照:
         * https://sdk.mystenlabs.com/typedoc/types/_mysten_walrus.WriteBlobOptions.html
         */
        const writeBlobOptions: WriteBlobOptions = {
          blob: uint8Array,
          deletable: true,
          epochs: epochs,
          signer: signer as any, // 使用类型断言解决类型兼容性问题
          attributes: {
            filename: file.name,
            contentType: file.type,
            size: file.size.toString(),
            lastModified: new Date(file.lastModified).toISOString(),
            uploadTime: new Date().toISOString(),
            origin: window.location.origin || 'unknown'
          },
          // 使用signer的地址作为owner
          owner: signer.toSuiAddress()
        };

        console.log('正在执行blob上传，参数:', JSON.stringify({
          fileSize: file.size,
          fileType: file.type,
          epochs: epochs,
          owner: signer.toSuiAddress(),
          attributes: writeBlobOptions.attributes
        }));

        const result = await this.client.writeBlob(writeBlobOptions);

        if (!result || !result.blobId) {
          throw new Error('文件上传失败：未获取到有效的blob信息');
        }

        const { blobId, blobObject } = result;

        console.log(`文件上传成功, Blob ID: ${blobId}`, blobObject ? `对象ID: ${blobObject.id?.id}` : '');

        // 获取blob URL
        let url = '';
        try {
          const objectId = blobObject?.id?.id;
          // 使用改进的getBlobUrl方法，优先使用objectId
          if (objectId) {
            url = await this.getBlobUrl(objectId);
            console.log(`成功获取Blob URL: ${url}`);
          } else {
            throw new Error('未获取到有效的对象ID');
          }
        } catch (e) {
          console.warn('无法通过对象ID获取blob URL:', e);
        }

        if (!url) {
          throw new Error('无法生成有效的Blob URL');
        }

        return { blobId, url };
      } catch (uploadError) {
        console.error('Walrus blob上传错误:', uploadError);
        const errorMessage = uploadError instanceof Error ? uploadError.message : '未知错误';
        throw new Error(`Blob上传失败: ${errorMessage}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'RetryableWalrusClientError') {
        console.log('遇到可重试错误，重置客户端后重试...');
        (this.client as any).reset();
        // 重新尝试上传
        return this.uploadFile(file, duration, address, signer);
      }
      throw error;
    }
  }


  /**
   * 获取Blob的URL
   * @param objectId Blob对象的ID
   * @returns Promise<string>
   */
  async getBlobUrl(objectId?: string): Promise<string> {
    try {
      // 使用Object ID方式构建URL (推荐方式)
      if (objectId) {
        console.log(`使用对象ID ${objectId} 构建URL`);
        return `${this.walrusAggregatorUrl}${objectId}`;
      }

      // 如果没有objectId，返回错误信息
      console.warn('未提供对象ID，无法构建URL');
      throw new Error('缺少对象ID，无法生成Walrus URL');
    } catch (e) {
      console.error('获取Blob URL时出错:', e);
      throw new Error(`无法获取Blob URL: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /**
   * 从Walrus URL中提取对象ID
   * @param url Walrus URL
   * @returns 对象ID或null
   */
  extractObjectIdFromUrl(url: string): string | null {
    try {
      if (!url) return null;

      let objectId: string | null = null;

      // 直接通过URL路径分割获取最后一部分作为objectId
      const urlParts = url.split('/');
      const lastPart = urlParts[urlParts.length - 1];

      if (lastPart && (lastPart.startsWith('0x') || /^[0-9a-fA-F]{64}$/.test(lastPart))) {
        // 确保对象ID以0x开头
        objectId = lastPart.startsWith('0x') ? lastPart : '0x' + lastPart;
      } else {
        // 如果最后一部分不是有效的对象ID，尝试从整个URL中提取
        const match = url.match(/([0-9a-fA-F]{64}|0x[0-9a-fA-F]{64})/);
        if (match && match[1]) {
          objectId = match[1].startsWith('0x') ? match[1] : '0x' + match[1];
        }
      }

      console.log(`从URL [${url}] 提取的对象ID: ${objectId}`);
      return objectId;
    } catch (error) {
      console.error('从URL提取对象ID失败:', error);
      return null;
    }
  }

  /**
   * 延长Walrus存储期限
   *
   * 根据Walrus SDK文档，支持两种方式延长存储期限：
   * 1. 通过指定epochs参数，增加存储的epoch数量
   * 2. 通过指定endEpoch参数，直接设置存储的结束epoch
   *
   * 内部使用ExtendBlobOptions类型构造参数：
   * ```typescript
   * type ExtendBlobOptions = {
   *   blobObjectId: string;
   *   owner: string;
   *   walCoin?: TransactionObjectArgument;
   * } & (
   *   | { endEpoch?: never; epochs: number }
   *   | { endEpoch: number; epochs?: never }
   * )
   * ```
   *
   * 注意：ExtendBlobOptions类型要求必须提供epochs或endEpoch其中之一，但不能同时提供两者。
   *
   * 参考文档：
   * - https://sdk.mystenlabs.com/typedoc/classes/_mysten_walrus.WalrusClient.html#executeextendblobtransaction
   * - https://sdk.mystenlabs.com/typedoc/types/_mysten_walrus.ExtendBlobOptions.html
   *
   * @param contentUrl 内容URL或blobId
   * @param duration 延长的存储时长(秒)，仅在使用epochs模式时有效
   * @param signer 签名对象
   * @param options 可选参数，包括：
   *   - endEpoch: 直接指定结束的epoch，如果提供此参数，将忽略duration
   *   - useEndEpoch: 是否使用endEpoch模式而非epochs模式
   * @returns Promise<boolean> 操作成功返回true，失败抛出异常
   */
  async extendStorageDuration(
    contentUrl: string,
    duration: number,
    signer: Signer | CustomSigner,
    options?: {
      endEpoch?: number;
      useEndEpoch?: boolean;
    }
  ): Promise<boolean> {
    try {
      console.log(`正在延长Walrus存储期限，URL/ID: ${contentUrl}, 延长时间: ${duration}秒`);

      // 从URL中提取对象ID
      const blobObjectId = this.extractObjectIdFromUrl(contentUrl);

      if (!blobObjectId) {
        throw new Error(`无法从URL [${contentUrl}] 中提取有效的对象ID`);
      }

      console.log(`成功提取对象ID: ${blobObjectId}`);

      // 准备交易参数
      const owner = signer.toSuiAddress();

      // 根据options决定使用哪种模式构造ExtendBlobOptions参数
      let transactionParams: ExtendBlobOptions & { signer: any };

      if (options?.useEndEpoch && options?.endEpoch !== undefined) {
        // 使用endEpoch模式
        const endEpoch = options.endEpoch;
        console.log(`使用endEpoch模式延长存储期限，目标结束epoch: ${endEpoch}`);

        // 构造使用endEpoch的参数
        transactionParams = {
          blobObjectId,
          owner,
          endEpoch,
          signer: signer as any // 使用类型断言解决类型兼容性问题
        };
      } else {
        // 使用epochs模式（增加存储时间）
        const epochs = Math.ceil(duration / (24 * 60 * 60));
        const durationDays = duration / (24 * 60 * 60);
        console.log(`使用epochs模式延长存储期限，增加 ${epochs} 个epochs（约${epochs}天），原始时长: ${durationDays.toFixed(2)}天 (${duration}秒)`);

        // 构造使用epochs的参数
        transactionParams = {
          blobObjectId,
          owner,
          epochs,
          signer: signer as any // 使用类型断言解决类型兼容性问题
        };
      }

      try {
        // 创建并执行延长存储期限的交易
        console.log('准备执行延长存储期限交易，参数:', {
          blobObjectId: transactionParams.blobObjectId,
          owner: transactionParams.owner,
          ...(transactionParams.epochs !== undefined ? { epochs: transactionParams.epochs } : {}),
          ...(transactionParams.endEpoch !== undefined ? { endEpoch: transactionParams.endEpoch } : {})
        });

        // 执行延长存储期限交易
        const result = await this.client.executeExtendBlobTransaction(transactionParams);

        if (!result) {
          throw new Error('延长存储期限失败：未获取到有效的响应');
        }

        console.log('Walrus存储期限延长成功，交易摘要:', result.digest);
        return true;
      } catch (txError) {
        console.error('执行延长存储期限交易失败:', txError);

        // 检查是否是toJSON错误
        if (txError instanceof Error && txError.message.includes('toJSON is not a function')) {
          console.log('检测到toJSON错误，这可能是由于SDK版本不兼容导致的');

          // 尝试使用替代方法
          console.log('尝试使用替代方法延长存储期限...');

          // 这里可以添加替代实现，例如直接调用Walrus API
          // 由于无法直接修改Walrus SDK，我们可以提供一个友好的错误消息
          throw new Error('当前版本的Walrus SDK与应用不兼容，请联系管理员更新SDK');
        }

        // 检查是否是权限错误
        if (txError instanceof Error &&
            (txError.message.includes('authority') ||
             txError.message.includes('permission') ||
             txError.message.includes('owner'))) {
          throw new Error(`延长存储期限失败：您没有权限操作此Blob。只有Blob的所有者才能延长其存储期限。`);
        }

        // 检查是否是gas不足错误
        if (txError instanceof Error && txError.message.includes('gas')) {
          throw new Error(`延长存储期限失败：Gas不足。请确保您的钱包中有足够的SUI代币支付交易费用。`);
        }

        // 重新抛出原始错误
        throw txError;
      }
    } catch (error) {
      console.error('延长Walrus存储期限失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      throw new Error(`延长存储期限失败: ${errorMessage}`);
    }
  }

}

// 创建单例实例
export const walrusService = new WalrusService();