import React from 'react';
import './AspectRatioContainer.scss';

interface AspectRatioContainerProps {
  aspectRatio: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * 根据广告位比例自动调整容器尺寸的组件
 */
const AspectRatioContainer: React.FC<AspectRatioContainerProps> = ({ 
  aspectRatio, 
  children, 
  className = '' 
}) => {
  // 解析比例字符串，例如 "16:9" => { width: 16, height: 9 }
  const parseRatio = (ratio: string): { width: number; height: number } => {
    const defaultRatio = { width: 16, height: 9 };
    
    if (!ratio || !ratio.includes(':')) {
      return defaultRatio;
    }

    try {
      const [width, height] = ratio.split(':').map(part => parseInt(part.trim(), 10));
      if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        return defaultRatio;
      }
      return { width, height };
    } catch (error) {
      console.error('解析广告位比例失败:', error);
      return defaultRatio;
    }
  };

  const { width, height } = parseRatio(aspectRatio || '16:9');
  const paddingBottom = `${(height / width) * 100}%`;

  return (
    <div 
      className={`aspect-ratio-container ${className}`}
      style={{ paddingBottom }}
    >
      <div className="aspect-ratio-content">
        {children}
      </div>
    </div>
  );
};

export default AspectRatioContainer;
