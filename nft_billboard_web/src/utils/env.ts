/**
 * 环境配置工具
 * 用于获取和检查当前环境配置
 */

/**
 * 环境类型
 */
export type EnvType = 'development' | 'production';

/**
 * 网络类型
 */
export type NetworkType = 'testnet' | 'mainnet';

/**
 * 获取当前环境
 * @returns 当前环境类型
 */
export const getEnv = (): EnvType => {
  return (process.env.REACT_APP_ENV as EnvType) || 'development';
};

/**
 * 检查是否为开发环境
 * @returns 是否为开发环境
 */
export const isDevelopment = (): boolean => {
  return getEnv() === 'development';
};

/**
 * 检查是否为生产环境
 * @returns 是否为生产环境
 */
export const isProduction = (): boolean => {
  return getEnv() === 'production';
};

/**
 * 获取当前网络
 * @returns 当前网络类型
 */
export const getNetwork = (): NetworkType => {
  return (process.env.REACT_APP_DEFAULT_NETWORK as NetworkType) || 'testnet';
};

/**
 * 检查是否为测试网
 * @returns 是否为测试网
 */
export const isTestnet = (): boolean => {
  return getNetwork() === 'testnet';
};

/**
 * 检查是否为主网
 * @returns 是否为主网
 */
export const isMainnet = (): boolean => {
  return getNetwork() === 'mainnet';
};

/**
 * 获取合约包ID
 * @returns 合约包ID
 */
export const getContractPackageId = (): string => {
  return process.env.REACT_APP_CONTRACT_PACKAGE_ID || '';
};

/**
 * 获取合约模块名称
 * @returns 合约模块名称
 */
export const getContractModuleName = (): string => {
  return process.env.REACT_APP_CONTRACT_MODULE_NAME || '';
};

/**
 * 获取工厂对象ID
 * @returns 工厂对象ID
 */
export const getFactoryObjectId = (): string => {
  return process.env.REACT_APP_FACTORY_OBJECT_ID || '';
};

/**
 * 获取NFT显示配置ID
 * @returns NFT显示配置ID
 */
export const getNftDisplayConfigId = (): string => {
  return process.env.REACT_APP_NFT_DISPLAY_CONFIG_ID || '';
};

/**
 * 获取时钟ID
 * @returns 时钟ID
 */
export const getClockId = (): string => {
  return process.env.REACT_APP_CLOCK_ID || '';
};

/**
 * 获取Walrus环境
 * @returns Walrus环境
 */
export const getWalrusEnvironment = (): NetworkType => {
  return (process.env.REACT_APP_WALRUS_ENVIRONMENT as NetworkType) || 'testnet';
};

/**
 * 获取Walrus聚合器URL
 * @returns Walrus聚合器URL
 */
export const getWalrusAggregatorUrl = (): string => {
  return isMainnet()
    ? process.env.REACT_APP_WALRUS_AGGREGATOR_URL_MAINNET || ''
    : process.env.REACT_APP_WALRUS_AGGREGATOR_URL_TESTNET || '';
};

/**
 * 获取API超时时间
 * @returns API超时时间（毫秒）
 */
export const getApiTimeout = (): number => {
  return parseInt(process.env.REACT_APP_API_TIMEOUT || '30000', 10);
};

/**
 * 检查是否使用模拟数据
 * @returns 是否使用模拟数据
 */
export const useMockData = (): boolean => {
  return process.env.REACT_APP_USE_MOCK_DATA === 'true';
};

/**
 * 环境配置
 */
const env = {
  getEnv,
  isDevelopment,
  isProduction,
  getNetwork,
  isTestnet,
  isMainnet,
  getContractPackageId,
  getContractModuleName,
  getFactoryObjectId,
  getNftDisplayConfigId,
  getClockId,
  getWalrusEnvironment,
  getWalrusAggregatorUrl,
  getApiTimeout,
  useMockData,
};

export default env; 