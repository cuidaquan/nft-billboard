/**
 * Walrus存储服务配置
 */

import { NetworkName } from './config';

/**
 * Walrus网络聚合器URL配置
 */
export const WALRUS_AGGREGATOR_URLS: Record<NetworkName, string> = {
  mainnet: process.env.REACT_APP_WALRUS_AGGREGATOR_URL_MAINNET || 'https://walrus.globalstake.io/v1/blobs/by-object-id/',
  testnet: process.env.REACT_APP_WALRUS_AGGREGATOR_URL_TESTNET || 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/by-object-id/'
};

/**
 * Walrus服务配置
 */
export const WALRUS_CONFIG = {
  /**
   * 请求重试次数
   */
  MAX_RETRIES: 3,
  
  /**
   * 重试间隔时间（毫秒）
   */
  RETRY_DELAY: 1000,
  
  /**
   * 请求超时时间（毫秒）
   */
  REQUEST_TIMEOUT: 60_000,
  
  /**
   * Walrus WASM CDN URL
   */
  WASM_URL: 'https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm',
  
  /**
   * 默认存储时长（天）
   */
  DEFAULT_LEASE_DAYS: 30,
  
  /**
   * Walrus环境
   * 可通过环境变量REACT_APP_WALRUS_ENVIRONMENT指定
   */
  ENVIRONMENT: (process.env.REACT_APP_WALRUS_ENVIRONMENT || 'testnet') as NetworkName
};

/**
 * 根据网络环境获取Walrus聚合器URL
 * @param network 网络环境
 * @returns 聚合器URL
 */
export function getWalrusAggregatorUrl(network: NetworkName): string {
  return WALRUS_AGGREGATOR_URLS[network];
} 