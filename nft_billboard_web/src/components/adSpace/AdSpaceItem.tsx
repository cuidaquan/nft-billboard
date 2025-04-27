import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Tag, Spin, Popconfirm, Col } from 'antd';
import { ColumnWidthOutlined, DollarOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { AdSpace, BillboardNFT } from '../../types';
import { getNFTDetails } from '../../utils/contract';
import MediaContent from '../nft/MediaContent';

const { Text } = Typography;

interface AdSpaceItemProps {
  adSpace: AdSpace;
  onUpdatePrice: (adSpace: AdSpace) => void;
  onDeleteAdSpace: (adSpaceId: string) => void;
  deleteLoading: boolean;
}

const AdSpaceItem: React.FC<AdSpaceItemProps> = ({
  adSpace,
  onUpdatePrice,
  onDeleteAdSpace,
  deleteLoading
}) => {
  const { t } = useTranslation();
  const [loadingNft, setLoadingNft] = useState(false);
  const [activeNft, setActiveNft] = useState<BillboardNFT | null>(null);

  // useEffect需要在组件顶层调用
  useEffect(() => {
    // 只有当不是示例数据且有NFT IDs时才执行
    if (adSpace.isExample || !adSpace.nft_ids?.length) {
      return;
    }

    const getActiveNft = async () => {
      try {
        setLoadingNft(true);

        // 确保nft_ids存在
        const nftIds = adSpace.nft_ids || [];

        // 尝试获取每个NFT详情，找到活跃的
        for (const nftId of nftIds) {
          const nft = await getNFTDetails(nftId);
          if (nft && nft.isActive) {
            setActiveNft(nft);
            break;
          }
        }
      } catch (error) {
        console.error('获取活跃NFT失败:', error);
      } finally {
        setLoadingNft(false);
      }
    };

    getActiveNft();
  }, [adSpace.nft_ids, adSpace.isExample]);

  // 如果这是示例数据，不要显示完整卡片
  if (adSpace.isExample) {
    return (
      <Col xs={24}>
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f9f9f9', borderRadius: '8px' }}>
          <ColumnWidthOutlined style={{ fontSize: '48px', color: '#4e63ff', marginBottom: '16px' }} />
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>{adSpace.name}</div>
          <div style={{ color: 'rgba(0, 0, 0, 0.45)', marginBottom: '24px' }}>{adSpace.description}</div>
        </div>
      </Col>
    );
  }

  return (
    <Col xs={24} sm={12} md={8}>
      <Card className="ad-space-card">
        <div className="card-cover">
          {loadingNft ? (
            <div className="loading-container">
              <Spin />
            </div>
          ) : activeNft && activeNft.contentUrl ? (
            <div className="active-nft-cover">
              <MediaContent
                contentUrl={activeNft.contentUrl}
                brandName={activeNft.brandName || '广告内容'}
                className="ad-space-image"
              />
              <Tag className="active-tag" color="green">{t('adSpaces.status.active')}</Tag>
            </div>
          ) : (
            <div className="empty-ad-space-placeholder">
              <ColumnWidthOutlined />
              <Text>{adSpace.dimension.width} x {adSpace.dimension.height}</Text>
              <Text>{t('adSpaces.status.waiting')}</Text>
            </div>
          )}
          <div className="availability-badge">
            <span className={adSpace.available ? "available" : "unavailable"}>
              {adSpace.available ? t('adSpaces.status.available') : t('adSpaces.status.occupied')}
            </span>
          </div>
        </div>
        <Card.Meta
          title={adSpace.name}
          className="ad-space-meta"
        />
        <div className="ad-space-info">
          <div className="info-item">
            <span className="label">{t('manage.createAdSpace.form.location')}:</span>
            <span className="value">{adSpace.location}</span>
          </div>
          <div className="info-item">
            <span className="label">{t('manage.createAdSpace.form.dimension')}:</span>
            <span className="value">{`${adSpace.dimension.width}x${adSpace.dimension.height}`}</span>
          </div>
          <div className="info-item">
            <span className="label">{t('manage.createAdSpace.form.price')}:</span>
            <span className="value price">
              {parseFloat((Number(adSpace.price) / 1000000000).toFixed(9))} SUI/{t('common.time.day')}
            </span>
          </div>
        </div>
        <div className="action-buttons">
          <Button
            className="edit-button"
            onClick={() => onUpdatePrice(adSpace)}
            icon={<DollarOutlined />}
          >
            {t('manage.buttons.changePrice')}
          </Button>
          <Popconfirm
            title={t('manage.confirmDelete.title')}
            description={t('manage.confirmDelete.description')}
            onConfirm={() => onDeleteAdSpace(adSpace.id)}
            okText={t('common.buttons.confirm')}
            cancelText={t('common.buttons.cancel')}
            okButtonProps={{ loading: deleteLoading }}
          >
            <Button
              className="delete-button"
              icon={<DeleteOutlined />}
            >
              {t('common.buttons.delete')}
            </Button>
          </Popconfirm>
        </div>
      </Card>
    </Col>
  );
};

export default AdSpaceItem;