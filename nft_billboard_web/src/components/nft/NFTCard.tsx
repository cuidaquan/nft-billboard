import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Tag, Space } from 'antd';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BillboardNFT } from '../../types';
// import { formatDate } from '../../utils/format';
import { ClockCircleOutlined, LinkOutlined } from '@ant-design/icons';
import './NFTCard.scss';

const { Text, Title } = Typography;

interface NFTCardProps {
  nft: BillboardNFT;
}

const NFTCard: React.FC<NFTCardProps> = ({ nft }) => {
  const { t } = useTranslation();
  // 媒体类型状态
  const [isVideo, setIsVideo] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  // 计算是否过期
  const isExpired = new Date(nft.leaseEnd) < new Date();

  // 计算是否即将过期（小于7天）
  const isAboutToExpire = () => {
    const now = new Date();
    const expiryDate = new Date(nft.leaseEnd);
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays > 0;
  };

  // 检测媒体类型
  useEffect(() => {
    if (!nft.contentUrl) return;

    // 先通过URL扩展名检查
    const lowerCaseUrl = nft.contentUrl.toLowerCase();
    const hasVideoExt = lowerCaseUrl.endsWith('.mp4') ||
                        lowerCaseUrl.endsWith('.webm') ||
                        lowerCaseUrl.endsWith('.ogg') ||
                        lowerCaseUrl.endsWith('.mov');

    if (hasVideoExt) {
      setIsVideo(true);
      setIsLoading(false);
      return;
    }

    // 如果没有明确的扩展名，尝试加载为视频
    // 如果视频加载失败，会触发error事件，然后尝试加载为图片
    setIsVideo(true);

    // 创建一个隐藏的视频元素来测试URL
    const videoTest = document.createElement('video');
    videoTest.style.display = 'none';
    videoTest.preload = 'metadata';

    videoTest.onloadedmetadata = () => {
      // 视频加载成功
      setIsVideo(true);
      setIsLoading(false);
      setHasError(false);
    };

    videoTest.onerror = () => {
      // 视频加载失败，尝试作为图片
      setIsVideo(false);
      setIsLoading(false);
    };

    videoTest.src = nft.contentUrl;
    document.body.appendChild(videoTest);

    return () => {
      if (document.body.contains(videoTest)) {
        document.body.removeChild(videoTest);
      }
    };
  }, [nft.contentUrl]);

  // 自定义租期显示格式
  const formatLeaseDate = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return t('common.messages.invalidDate');

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${year}/${month}/${day} ${hours}:${minutes}`;
    } catch (error) {
      console.error('日期格式化错误:', error);
      return t('common.messages.invalidDate');
    }
  };

  return (
    <Card
      hoverable
      className="nft-card"
      cover={
        <div className="nft-image-container">
          {isLoading ? (
            <div className="loading-media">{t('common.messages.loading')}...</div>
          ) : isVideo ? (
            <video
              src={nft.contentUrl}
              controls
              preload="metadata"
              onError={() => setHasError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <img
              alt={nft.brandName}
              src={nft.contentUrl}
              onError={() => setHasError(true)}
            />
          )}
          {hasError && (
            <div className="media-error">{t('nftDetail.mediaLoadError')}</div>
          )}
        </div>
      }
    >
      <Title level={5} className="nft-title">{nft.brandName}</Title>

      <div className="nft-info">
        <div className="info-row">
          <Text type="secondary">{t('nftDetail.fields.adSpaceId')}:</Text>
          <Link to={`/ad-spaces/${nft.adSpaceId}`} className="ad-space-link">
            <Text>{nft.adSpaceId.substring(0, 8)}...</Text>
            <LinkOutlined style={{ marginLeft: 4, fontSize: '12px' }} />
          </Link>
        </div>

        <div className="info-row lease-period">
          <Text type="secondary"><ClockCircleOutlined /> {t('nftDetail.leasePeriod')}:</Text>
          <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
            <Text style={{ fontSize: '12px' }}>{t('nftDetail.from')}: {formatLeaseDate(nft.leaseStart)}</Text>
            <Text style={{ fontSize: '12px' }}>{t('nftDetail.to')}: {formatLeaseDate(nft.leaseEnd)}</Text>
          </Space>
        </div>

        <div className="nft-status">
          <Tag color={isExpired ? "red" : new Date() < new Date(nft.leaseStart) ? "blue" : isAboutToExpire() ? "orange" : "green"}>
            {isExpired
              ? t('nftDetail.status.expired')
              : new Date() < new Date(nft.leaseStart)
                ? t('nftDetail.status.pending')
                : isAboutToExpire()
                  ? t('nftDetail.status.expiring')
                  : t('nftDetail.status.active')
            }
          </Tag>
        </div>
      </div>

      <Link to={`/my-nfts/${nft.id}`}>
        <Button type="primary" block>{t('adSpaces.buttons.viewDetails')}</Button>
      </Link>
    </Card>
  );
};

export default NFTCard;
