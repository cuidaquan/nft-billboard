import { Transaction } from '@mysten/sui/transactions';
import { SuiClient, PaginatedObjectsResponse } from '@mysten/sui/client';
import { CONTRACT_CONFIG, NETWORKS, DEFAULT_NETWORK } from '../config/config';
import { BillboardNFT, AdSpace, PurchaseAdSpaceParams, UpdateNFTContentParams, RenewNFTParams, CreateAdSpaceParams, RemoveGameDevParams, NFTStatus } from '../types';



// 创建 SUI 客户端
export const createSuiClient = (network = DEFAULT_NETWORK) => {
  return new SuiClient({ url: NETWORKS[network].fullNodeUrl });
};

// 获取所有可用的广告位
export async function getAvailableAdSpaces(): Promise<AdSpace[]> {

  // 实际从链上获取数据
  try {
    console.log('从链上获取可用广告位数据');

    // 导入getAllAdSpaces函数
    const { getAllAdSpaces } = await import('./tableUtils');

    // 使用新的方法获取所有广告位
    const allAdSpaces = await getAllAdSpaces(CONTRACT_CONFIG.FACTORY_OBJECT_ID);
    console.log('使用Table API获取到广告位列表:', allAdSpaces);

    if (!allAdSpaces || allAdSpaces.length === 0) {
      console.log('广告位列表为空，返回空状态提示');
      return [{
        id: '0x0',
        name: '暂无可用广告位',
        description: '目前没有可用的广告位，请稍后再来查看，或联系游戏开发者创建新的广告位。',
        imageUrl: 'https://via.placeholder.com/300x250?text=暂无可用广告位',
        price: '0',
        duration: 365,
        dimension: { width: 300, height: 250 },
        owner: null,
        available: false,
        location: '无',
        isExample: true,
        price_description: '价格为每日租赁价格'
      }];
    }

    // 过滤出可用的广告位
    const availableAdSpaces = allAdSpaces.filter(adSpace => adSpace.available);

    console.log('可用广告位数量:', availableAdSpaces.length);

    if (availableAdSpaces.length === 0) {
      console.log('没有可用的广告位');
      // 如果没有可用的广告位，返回友好提示
      return [{
        id: '0x0',
        name: '暂无可用广告位',
        description: '目前没有可用的广告位，请稍后再来查看，或联系游戏开发者创建新的广告位。',
        imageUrl: 'https://via.placeholder.com/300x250?text=暂无可用广告位',
        price: '0',
        duration: 365,
        dimension: { width: 300, height: 250 },
        owner: null,
        available: false,
        location: '无',
        isExample: true,
        price_description: '价格为每日租赁价格'
      }];
    }

    // 规范化广告位数据
    return availableAdSpaces.map(adSpace => ({
      ...adSpace,
      name: adSpace.name || `广告位 ${adSpace.id.substring(0, 8)}`,
      description: adSpace.description || `位于 ${adSpace.location || '未知位置'} 的广告位`,
      imageUrl: adSpace.imageUrl || `https://via.placeholder.com/${adSpace.dimension.width}x${adSpace.dimension.height}?text=${encodeURIComponent(adSpace.name || 'AdSpace')}`,
      duration: 365, // 确保都是365天
      price_description: '价格为每日租赁价格'
    }));
  } catch (error) {
    console.error('获取可用广告位失败:', error);
    // 出错时返回友好提示
    return [{
      id: '0x0',
      name: '数据加载失败',
      description: '加载广告位数据时发生错误，请刷新页面重试。',
      imageUrl: 'https://via.placeholder.com/300x250?text=加载失败',
      price: '0',
      duration: 30,
      dimension: { width: 300, height: 250 },
      owner: null,
      available: false,
      location: '无',
      isExample: true // 标记这是示例数据
    }];
  }
}

export async function getUserNFTs(owner: string): Promise<BillboardNFT[]> {

  // 实际从链上获取数据
  try {
    console.log('从链上获取用户NFT数据，所有者地址:', owner);

    if (!owner || !owner.startsWith('0x')) {
      console.error('所有者地址无效:', owner);
      return [];
    }

    // 生成一个唯一的请求ID，用于日志跟踪
    const requestId = new Date().getTime().toString();
    console.log(`[${requestId}] 开始获取用户NFT数据`);

    const client = createSuiClient();

    // 构建NFT类型字符串，用于过滤
    const nftTypeStr = `${CONTRACT_CONFIG.PACKAGE_ID}::nft::AdBoardNFT`;
    console.log(`[${requestId}] 使用类型过滤:`, nftTypeStr);

    // 使用分页方式获取所有NFT对象
    let hasNextPage = true;
    let cursor: string | null = null;
    const pageSize = 50; // 每页获取的数量（Sui SDK的最大限制是50）
    const allNftObjects: any[] = [];

    // 循环获取所有页面的数据
    while (hasNextPage) {
      console.log(`[${requestId}] 获取页面数据，cursor:`, cursor);

      // 使用类型过滤直接查询用户拥有的NFT对象
      const ownedObjects: PaginatedObjectsResponse = await client.getOwnedObjects({
        owner,
        filter: {
          StructType: nftTypeStr
        },
        options: {
          showContent: true,
          showDisplay: true,
          showType: true,
        },
        cursor,
        limit: pageSize
      });

      console.log(`[${requestId}] 当前页获取到对象数量:`, ownedObjects.data?.length || 0);

      // 添加当前页的对象到结果集
      if (ownedObjects.data && ownedObjects.data.length > 0) {
        allNftObjects.push(...ownedObjects.data);
      }

      // 检查是否有下一页
      if (ownedObjects.hasNextPage && ownedObjects.nextCursor) {
        cursor = ownedObjects.nextCursor;
        console.log(`[${requestId}] 存在下一页，nextCursor:`, cursor);
      } else {
        hasNextPage = false;
        console.log(`[${requestId}] 已获取所有页面数据`);
      }
    }

    console.log(`[${requestId}] 获取到用户拥有的NFT对象总数:`, allNftObjects.length);

    // 如果没有找到任何对象，直接返回空数组
    if (allNftObjects.length === 0) {
      console.log(`[${requestId}] 用户没有拥有任何NFT对象`);
      return [];
    }

    // 转换为前端使用的NFT数据结构
    const nfts: BillboardNFT[] = [];

    for (const nftObj of allNftObjects) {
      try {
        if (!nftObj.data?.content || nftObj.data.content.dataType !== 'moveObject') {
          console.warn(`[${requestId}] NFT对象不是moveObject类型:`, nftObj.data?.objectId);
          continue;
        }

        // 类型断言为含有fields的对象
        const moveObject = nftObj.data.content as { dataType: 'moveObject', fields: Record<string, any> };
        if (!moveObject.fields) {
          console.warn(`[${requestId}] NFT对象没有fields字段:`, nftObj.data?.objectId);
          continue;
        }

        const fields = moveObject.fields;
        console.log(`[${requestId}] NFT对象字段:`, nftObj.data.objectId, Object.keys(fields));

        // 记录完整字段内容以便调试
        console.log(`[${requestId}] NFT字段详细内容:`, JSON.stringify(fields, null, 2));

        // 使用辅助函数构建NFT对象
        const nft = buildBillboardNFTFromObject(nftObj, requestId);

        console.log(`[${requestId}] 成功解析NFT:`, nftObj.data.objectId, 'adSpaceId:', nft.adSpaceId);
        nfts.push(nft);
      } catch (err) {
        console.error(`[${requestId}] 解析NFT时出错:`, nftObj.data?.objectId, err);
      }
    }

    console.log(`[${requestId}] 成功获取用户NFT数量:`, nfts.length);
    return nfts;
  } catch (error) {
    console.error('获取用户NFT失败:', error);
    return [];
  }
}

// 获取单个广告位详情
export async function getAdSpaceDetails(adSpaceId: string): Promise<AdSpace | null> {

  // 实际从链上获取数据
  try {
    console.log('从链上获取广告位详情数据, ID:', adSpaceId);

    // 获取广告位基本信息（现在已包含创建者信息）
    const adSpace = await getAdSpaceById(adSpaceId);
    if (!adSpace) {
      console.error('未找到广告位:', adSpaceId);
      return null;
    }

    return adSpace;
  } catch (error) {
    console.error('获取广告位详情失败:', error);
    return null;
  }
}

// 获取单个NFT详情
export async function getNFTDetails(nftId: string): Promise<BillboardNFT | null> {

  // 实际从链上获取数据
  try {
    // 生成一个唯一的请求ID，用于日志跟踪
    const requestId = new Date().getTime().toString();
    console.log(`[${requestId}] 从链上获取NFT详情, ID: ${nftId}`);

    if (!nftId || !nftId.startsWith('0x')) {
      console.error(`[${requestId}] NFT ID格式无效:`, nftId);
      return null;
    }

    const client = createSuiClient();

    // 获取NFT对象
    const nftObject = await client.getObject({
      id: nftId,
      options: {
        showContent: true,
        showDisplay: true,
        showType: true,
        showOwner: true
      }
    });

    console.log(`[${requestId}] 获取到NFT对象:`, nftObject.data?.objectId);
    console.log(`[${requestId}] NFT对象类型:`, nftObject.data?.type);

    // 检查对象是否存在且是NFT类型
    if (!nftObject.data || !nftObject.data.content) {
      console.error(`[${requestId}] NFT对象不存在或内容为空:`, nftObject);
      return null;
    }

    // 检查对象类型是否为AdBoardNFT
    const typeStr = nftObject.data.type || '';
    console.log(`[${requestId}] 正在检查NFT类型: "${typeStr}"`);

    // 支持多种可能的类型名称
    const isNftType = typeStr.includes(`${CONTRACT_CONFIG.PACKAGE_ID}::nft::AdBoardNFT`) ||
                      typeStr.includes(`${CONTRACT_CONFIG.PACKAGE_ID}::nft_billboard::AdBoardNFT`) ||
                      typeStr.includes(`::nft::AdBoardNFT`);

    console.log(`[${requestId}] NFT类型检查结果:`, isNftType ? "✓" : "✗");

    if (!isNftType || nftObject.data.content.dataType !== 'moveObject') {
      console.error(`[${requestId}] 对象不是AdBoardNFT类型:`, {
        type: typeStr,
        contentType: nftObject.data.content.dataType
      });
      return null;
    }

    // 提取NFT字段
    const moveObject = nftObject.data.content as { dataType: 'moveObject', fields: Record<string, any> };
    const fields = moveObject.fields;

    console.log(`[${requestId}] NFT字段:`, Object.keys(fields || {}));
    console.log(`[${requestId}] NFT完整字段内容:`, JSON.stringify(fields, null, 2));

    // 提取广告位ID用于获取关联信息
    let adSpaceId = '';
    if (fields.ad_space_id) {
      adSpaceId = typeof fields.ad_space_id === 'string' ? fields.ad_space_id :
                  (fields.ad_space_id.id ? fields.ad_space_id.id : '');
    }

    // 尝试获取关联的广告位信息
    let gameId = '';
    let location = '';
    let size = { width: 300, height: 250 };

    if (adSpaceId) {
      try {
        const adSpace = await getAdSpaceById(adSpaceId);
        if (adSpace) {
          gameId = adSpace.name.replace(' 广告位', '');
          location = adSpace.location;
          size = adSpace.dimension;
        }
      } catch (error) {
        console.log(`[${requestId}] 获取关联广告位信息失败:`, error);
      }
    }

    // 使用辅助函数构建NFT对象，传入额外字段
    const nft = buildBillboardNFTFromObject(nftObject, requestId, {
      size,
      gameId,
      location
    });

    console.log(`[${requestId}] 成功解析NFT: ${nftId}`);
    return nft;
  } catch (error) {
    console.error('获取NFT详情失败:', error);
    return null;
  }
}

// 创建购买广告位交易
export function createPurchaseAdSpaceTx(params: PurchaseAdSpaceParams): Transaction {
  const tx = new Transaction();

  console.log('构建购买广告位交易', params);

  // 获取Clock对象
  const clockObj = tx.object(CONTRACT_CONFIG.CLOCK_ID);

  // @ts-ignore
  // 创建SUI支付对象
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(params.price)]);

  // 准备blob_id参数
  const blobIdBytes = params.blobId
    ? tx.pure.string(params.blobId)
    : tx.pure.string('');

  // 调用合约的purchase_ad_space函数
  // @ts-ignore
  tx.moveCall({
    target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::purchase_ad_space`,
    arguments: [
      tx.object(CONTRACT_CONFIG.FACTORY_OBJECT_ID),
      tx.object(params.adSpaceId),
      payment,
      tx.pure.string(params.brandName),
      tx.pure.string(params.contentUrl),
      tx.pure.string(params.projectUrl),
      tx.pure.u64(params.leaseDays),
      clockObj,
      tx.pure.u64(params.startTime || 0),
      blobIdBytes,
      tx.pure.string(params.storageSource || 'none')
    ],
  });

  return tx;
}

// 创建更新广告内容交易
export function createUpdateAdContentTx(params: UpdateNFTContentParams): Transaction {
  const tx = new Transaction();

  console.log('构建更新广告内容交易');

  // 准备blob_id参数
  const blobIdBytes = params.blobId
    ? tx.pure.string(params.blobId)
    : tx.pure.string('');

  // 调用合约的update_ad_content函数
  // @ts-ignore
  tx.moveCall({
    target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::update_ad_content`,
    arguments: [
      tx.object(params.nftId), // nft
      tx.pure.string(params.contentUrl), // content_url
      blobIdBytes, // blob_id
      tx.pure.string(params.storageSource || 'none'), // storage_source
      tx.object(CONTRACT_CONFIG.CLOCK_ID) // clock
    ],
  });

  return tx;
}

// 创建续租交易
export function createRenewLeaseTx(params: RenewNFTParams): Transaction {
  const tx = new Transaction();

  console.log('构建续租交易，参数:', params);

  // 确保价格是字符串，并检查是否需要转换单位
  let priceAmount = params.price;
  if (Number(priceAmount) < 1000000) {
    priceAmount = (Number(priceAmount) * 1000000000).toString();
    console.log('价格单位转换:', params.price, '->', priceAmount);
  }

  // @ts-ignore
  // 创建SUI支付对象
  const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(priceAmount)]);

  // 调用合约的renew_lease函数
  // @ts-ignore
  tx.moveCall({
    target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::renew_lease`,
    arguments: [
      tx.object(CONTRACT_CONFIG.FACTORY_OBJECT_ID), // factory
      tx.object(params.adSpaceId), // ad_space
      tx.object(params.nftId), // nft
      payment, // payment
      tx.pure.u64(params.leaseDays), // lease_days
      tx.object(CONTRACT_CONFIG.CLOCK_ID) // clock
    ],
  });

  return tx;
}

// 创建广告位的交易
export function createAdSpaceTx(params: CreateAdSpaceParams): Transaction {
  const tx = new Transaction();

  // 获取必要的对象
  const factoryObj = tx.object(CONTRACT_CONFIG.FACTORY_OBJECT_ID);

  // 调用合约的create_ad_space函数
  // @ts-ignore
  tx.moveCall({
    target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::create_ad_space`,
    arguments: [
      factoryObj,                 // Factory 对象
      tx.pure.string(params.gameId),     // 游戏ID
      tx.pure.string(params.location),   // 位置信息
      tx.pure.string(params.size),       // 尺寸信息
      tx.pure.u64(params.price),      // 价格 - 使用u64类型
      tx.object(CONTRACT_CONFIG.CLOCK_ID) // Clock对象
    ],
  });

  return tx;
}

// 注册游戏开发者的交易
export function registerGameDevTx(params: { factoryId: string, developer: string }): Transaction {
  const tx = new Transaction();

  // 调用合约的 register_game_dev 函数
  // @ts-ignore
  tx.moveCall({
    target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::register_game_dev`,
    arguments: [
      tx.object(params.factoryId),  // Factory 对象
      tx.pure.address(params.developer) // 开发者地址
    ],
  });

  return tx;
}

// 更新平台分成比例的交易
export function updatePlatformRatioTx(params: { factoryId: string, ratio: number }): Transaction {
  const tx = new Transaction();

  // 调用合约的 update_platform_ratio 函数
  // @ts-ignore
  tx.moveCall({
    target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::update_platform_ratio`,
    arguments: [
      tx.object(params.factoryId), // Factory 对象
      tx.pure.u8(params.ratio)    // 新的平台分成比例 - 使用u8类型匹配合约参数
    ],
  });

  return tx;
}

// 更新广告位价格的交易
export function updateAdSpacePriceTx(params: { adSpaceId: string, price: string }): Transaction {
  const tx = new Transaction();

  // 调用合约的 update_ad_space_price 函数
  // @ts-ignore
  tx.moveCall({
    target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::update_ad_space_price`,
    arguments: [
      tx.object(params.adSpaceId), // AdSpace 对象
      tx.pure.u64(params.price) // 新的价格 - 使用u64类型
    ],
  });

  return tx;
}

// 计算广告位租赁价格
export async function calculateLeasePrice(adSpaceId: string, leaseDays: number): Promise<string> {

  console.log('计算广告位租赁价格，广告位ID:', adSpaceId, '租赁天数:', leaseDays);

  // 验证租赁天数在有效范围内
  if (leaseDays <= 0 || leaseDays > 365) {
    throw new Error('租赁天数必须在1-365天之间');
  }

  try {
    // 获取广告位信息
    const adSpace = await getAdSpaceById(adSpaceId);

    if (!adSpace) {
      throw new Error(`未找到广告位: ${adSpaceId}`);
    }

    console.log('广告位基础价格:', adSpace.price);

    // 使用几何级数公式计算租赁价格，与合约保持一致
    const dailyPrice = BigInt(adSpace.price);  // Y - 一天的租赁价格
    const ratio = BigInt(977000); // a - 比例因子，这里设为0.977000
    const base = BigInt(1000000); // 用于表示小数的基数
    const minDailyFactor = BigInt(500000); // 最低日因子(1/2)

    // 如果只租一天，直接返回每日价格
    if (leaseDays === 1) {
      return dailyPrice.toString();
    }

    // 计算租赁总价
    let totalPrice = dailyPrice; // 第一天的价格
    let factor = base; // 初始因子为1.0

    // 从第二天开始计算
    for (let i = 1; i < leaseDays; i++) {
      // 计算当前因子
      factor = (factor * ratio) / base;

      // 如果因子低于最低值，则使用最低值
      if (factor < minDailyFactor) {
        // 增加(租赁天数-i)天的最低价格
        const remainingDays = BigInt(leaseDays - i);
        totalPrice = totalPrice + ((dailyPrice * minDailyFactor * remainingDays) / base);
        break;
      }

      // 否则增加当前因子对应的价格
      totalPrice = totalPrice + ((dailyPrice * factor) / base);
    }

    console.log('几何级数计算的总租赁价格:', totalPrice.toString(), '(', formatSuiAmount(totalPrice.toString()), 'SUI)');

    return totalPrice.toString();
  } catch (error) {
    console.error('计算租赁价格失败:', error);
    throw new Error(`计算租赁价格失败: ${error}`);
  }
}

// 格式化SUI金额
export function formatSuiAmount(amount: string): string {
  console.log('格式化SUI金额:', amount);

  if (!amount) {
    console.warn('SUI金额为空');
    return '0';
  }

  try {
    // 将字符串转换为数字
    const amountInMist = BigInt(amount);
    console.log('转换为BigInt后的金额:', amountInMist.toString());

    // 转换为SUI单位 (1 SUI = 10^9 MIST)
    const amountInSui = Number(amountInMist) / 1000000000;
    console.log('转换为SUI单位后的金额:', amountInSui);

    // 检查结果是否为NaN
    if (isNaN(amountInSui)) {
      console.warn('SUI金额格式化后为NaN');
      return '0';
    }

    // 格式化为最多9位小数
    return amountInSui.toFixed(9);
  } catch (error) {
    console.error('格式化SUI金额时出错:', error);

    // 尝试直接将字符串解析为数字
    try {
      const numAmount = Number(amount) / 1000000000;
      if (!isNaN(numAmount)) {
        console.log('使用Number直接解析成功:', numAmount);
        return numAmount.toFixed(9);
      }
    } catch (e) {
      console.error('尝试直接解析也失败:', e);
    }

    return '0';
  }
}

// 更新NFT内容
export async function updateNFTContent(params: UpdateNFTContentParams): Promise<boolean> {
  try {
    console.log('更新NFT内容');
    // 这里是真实代码，应该调用合约更新NFT内容
    // 由于实际代码需要根据合约结构实现，这里只是一个示例框架

    // TODO: 实现实际的合约调用逻辑

    return true; // 返回true作为示例
  } catch (error) {
    console.error('更新NFT内容失败:', error);
    return false;
  }
}

// 辅助函数：从NFT对象构建BillboardNFT对象
function buildBillboardNFTFromObject(
  nftObject: any,
  requestId?: string,
  extraFields?: {
    size?: { width: number; height: number };
    gameId?: string;
    location?: string;
  }
): BillboardNFT {
  const logPrefix = requestId ? `[${requestId}]` : '';

  // 提取基本信息
  const nftId = nftObject.data.objectId;
  const fields = nftObject.data.content.fields;

  // 提取所有者地址
  let owner = '';
  if (nftObject.data.owner && typeof nftObject.data.owner === 'object') {
    const ownerObj = nftObject.data.owner as any;
    owner = ownerObj.AddressOwner || ownerObj.ObjectOwner || '';
  }

  // 提取广告位ID - 适配不同字段名称
  let adSpaceId = '';
  if (fields.ad_space_id) {
    adSpaceId = typeof fields.ad_space_id === 'string' ? fields.ad_space_id :
              (fields.ad_space_id.id ? fields.ad_space_id.id : '');
  } else if (fields.ad_space) {
    // 适配可能的替代字段名称
    adSpaceId = typeof fields.ad_space === 'string' ? fields.ad_space :
              (fields.ad_space.id ? fields.ad_space.id :
               (typeof fields.ad_space === 'object' ? JSON.stringify(fields.ad_space) : ''));
  }

  console.log(`${logPrefix} 提取的广告位ID:`, adSpaceId);

  // 提取到期时间 - 适配不同字段名称
  let expiryTimestamp = 0;
  if (fields.expiry_timestamp) {
    expiryTimestamp = parseInt(fields.expiry_timestamp);
  } else if (fields.expiry) {
    expiryTimestamp = parseInt(fields.expiry);
  } else if (fields.expire_timestamp) {
    expiryTimestamp = parseInt(fields.expire_timestamp);
  } else if (fields.lease_end) {
    // 合约中使用的lease_end字段
    expiryTimestamp = parseInt(fields.lease_end);
  }

  console.log(`${logPrefix} 提取的到期时间:`, expiryTimestamp);

  // 提取创建时间 - 适配不同字段名称
  let createdTimestamp = 0;
  if (fields.created_timestamp) {
    createdTimestamp = parseInt(fields.created_timestamp);
  } else if (fields.created) {
    createdTimestamp = parseInt(fields.created);
  } else if (fields.create_timestamp) {
    createdTimestamp = parseInt(fields.create_timestamp);
  } else if (fields.lease_start) {
    // 合约中使用的lease_start字段
    createdTimestamp = parseInt(fields.lease_start);
  }

  console.log(`${logPrefix} 提取的创建时间:`, createdTimestamp);

  // 提取其他字段 - 适配不同字段名称
  const brandName = fields.brand_name || fields.brand || '';
  const contentUrl = fields.content_url || fields.content || fields.url || '';
  const projectUrl = fields.project_url || fields.project || fields.website || '';
  const storageSource = fields.storage_source || '';
  const blobId = fields.blob_id || '';
  const price = fields.price || fields.amount || '';

  console.log(`${logPrefix} 提取的品牌名称:`, brandName);
  console.log(`${logPrefix} 提取的内容URL:`, contentUrl);
  console.log(`${logPrefix} 提取的项目URL:`, projectUrl);
  console.log(`${logPrefix} 提取的存储来源:`, storageSource, '，Blob ID:', blobId);

  // 如果无法获取创建时间，使用当前时间减去30天作为默认值
  if (createdTimestamp === 0) {
    createdTimestamp = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    console.log(`${logPrefix} 使用默认创建时间:`, createdTimestamp);
  }

  // 如果无法获取到期时间，使用当前时间加上30天作为默认值
  if (expiryTimestamp === 0) {
    expiryTimestamp = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000);
    console.log(`${logPrefix} 使用默认到期时间:`, expiryTimestamp);
  }

  // 计算租赁开始和结束日期
  const now = Date.now();
  const leaseStart = new Date(createdTimestamp * 1000).toISOString();
  const leaseEnd = new Date(expiryTimestamp * 1000).toISOString();

  // 判断NFT是否有效
  const isActive = expiryTimestamp * 1000 > now;

  // 计算NFT状态
  const leaseStartTime = createdTimestamp * 1000;
  const leaseEndTime = expiryTimestamp * 1000;
  let status: NFTStatus;

  if (now < leaseStartTime) {
    status = NFTStatus.PENDING;  // 待展示
  } else if (now >= leaseStartTime && now <= leaseEndTime) {
    status = NFTStatus.ACTIVE;   // 活跃中
  } else {
    status = NFTStatus.EXPIRED;  // 已过期
  }

  // 提取创建时间/最后续约时间
  const creationTime = fields.creation_time ? new Date(Number(fields.creation_time) * 1000).toISOString() :
                      new Date(leaseStartTime).toISOString();

  const lastRenewalTime = fields.last_renewal_time ? new Date(Number(fields.last_renewal_time) * 1000).toISOString() :
                         fields.renewal_time ? new Date(Number(fields.renewal_time) * 1000).toISOString() : undefined;

  // 提取初始创建者地址
  const originalOwner = fields.original_owner || fields.creator || '';

  // 构建NFT对象
  const nft: BillboardNFT = {
    id: nftId,
    adSpaceId,
    owner: owner || '',
    brandName,
    contentUrl,
    projectUrl,
    leaseStart,
    leaseEnd,
    isActive,
    status,
    creationTime,
    lastRenewalTime,
    price,
    originalOwner,
    storageSource: storageSource as 'walrus' | 'external' | undefined,
    blobId,
    // 添加额外字段（如果提供）
    ...(extraFields?.size && { size: extraFields.size }),
    ...(extraFields?.gameId && { gameId: extraFields.gameId }),
    ...(extraFields?.location && { location: extraFields.location })
  };

  console.log(`${logPrefix} 成功构建NFT对象:`, nftId);
  return nft;
}

// 辅助函数：详细比较两个地址
export function compareAddresses(address1: string, address2: string): boolean {
  // 规范化两个地址
  const normalizedAddr1 = address1.toLowerCase();
  const normalizedAddr2 = address2.toLowerCase();

  const isEqual = normalizedAddr1 === normalizedAddr2;

  // 如果不相等，分析原因
  if (!isEqual) {
    // 长度比较
    if (normalizedAddr1.length !== normalizedAddr2.length) {
      console.log(`地址长度不同: ${normalizedAddr1.length} vs ${normalizedAddr2.length}`);
    }

    // 前缀比较
    if (!normalizedAddr1.startsWith('0x') || !normalizedAddr2.startsWith('0x')) {
      console.log(`地址前缀问题: "${normalizedAddr1.substring(0, 2)}" vs "${normalizedAddr2.substring(0, 2)}"`);
    }

    // 逐字符比较，找到第一个不同的位置
    for (let i = 0; i < Math.min(normalizedAddr1.length, normalizedAddr2.length); i++) {
      if (normalizedAddr1[i] !== normalizedAddr2[i]) {
        console.log(`地址第${i+1}个字符不同: "${normalizedAddr1[i]}" vs "${normalizedAddr2[i]}"`);
        console.log(`地址不同部分: "${normalizedAddr1.substring(i, i+10)}..." vs "${normalizedAddr2.substring(i, i+10)}..."`);
        break;
      }
    }
  }

  return isEqual;
}

export async function getGameDevsFromFactory(factoryId: string): Promise<string[]> {
  console.log('获取工厂中的游戏开发者列表, 工厂ID:', factoryId);

  try {
    // 导入getAllGameDevs函数
    const { getAllGameDevs } = await import('./tableUtils');

    // 使用新的方法获取游戏开发者列表
    const gameDevs = await getAllGameDevs(factoryId);
    console.log('使用Table API获取到开发者列表:', gameDevs);
    return gameDevs;
  } catch (error) {
    console.error('获取游戏开发者列表失败:', error);

    // 返回空数组
    return [];
  }
}

// 获取平台分成比例
export async function getPlatformRatio(factoryId: string): Promise<number> {
  console.log('获取平台分成比例, 工厂ID:', factoryId);

  try {
    const suiClient = createSuiClient();

    // 获取Factory对象
    const factoryObj = await suiClient.getObject({
      id: factoryId,
      options: {
        showContent: true,
      }
    });

    if (factoryObj.data && factoryObj.data.content && 'fields' in factoryObj.data.content) {
      const fields = factoryObj.data.content.fields as any;

      if ('platform_ratio' in fields) {
        const ratio = Number(fields.platform_ratio);
        console.log('获取到平台分成比例:', ratio);
        return ratio;
      } else {
        console.log('Factory对象中无平台分成比例字段或格式不正确');
        return 10; // 默认为10%
      }
    } else {
      console.error('无法获取Factory对象内容');
      return 10; // 默认为10%
    }
  } catch (error) {
    console.error('获取平台分成比例失败:', error);
    return 10; // 默认为10%
  }
}

// 通过ID直接获取广告位信息
export async function getAdSpaceById(adSpaceId: string): Promise<AdSpace | null> {
  try {
    console.log('开始获取广告位详情, ID:', adSpaceId);

    // 如果是无效ID或示例ID
    if (!adSpaceId || adSpaceId === '0x0') {
      console.log('无效的广告位ID');
      return null;
    }

    const client = createSuiClient();

    // 获取广告位对象
    const adSpaceObject = await client.getObject({
      id: adSpaceId,
      options: {
        showContent: true,
        showDisplay: true,
        showType: true,
        showOwner: true
      }
    });

    // 检查广告位对象是否存在
    if (!adSpaceObject.data || !adSpaceObject.data.content) {
      console.error('广告位对象不存在或内容为空:', adSpaceObject);
      return null;
    }

    console.log('获取到广告位对象');

    // 检查对象类型是否为AdSpace
    const typeStr = adSpaceObject.data.type || '';
    const isAdSpaceType = typeStr.includes(`${CONTRACT_CONFIG.PACKAGE_ID}::ad_space::AdSpace`);

    if (!isAdSpaceType || adSpaceObject.data.content.dataType !== 'moveObject') {
      console.error('对象不是AdSpace类型:', {
        type: typeStr,
        contentType: adSpaceObject.data.content.dataType
      });
      return null;
    }

    // 提取广告位字段
    const moveObject = adSpaceObject.data.content as { dataType: 'moveObject', fields: Record<string, any> };
    const fields = moveObject.fields;

    console.log('广告位字段:', fields);

    // 提取尺寸信息 - 从size字段解析
    let width = 300, height = 250;
    const aspectRatio = fields.size || "16:9";

    // 处理比例格式 (例如: "16:9")
    if (fields.size && typeof fields.size === 'string') {
      if (fields.size.includes(':')) {
        // 新的比例格式
        const [w, h] = fields.size.split(':').map(Number);
        if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
          // 设置基于比例的预览尺寸
          const baseSize = 300;
          if (w >= h) {
            width = baseSize;
            height = Math.round(baseSize * (h / w));
          } else {
            height = baseSize;
            width = Math.round(baseSize * (w / h));
          }
        }
      } else if (fields.size.includes('x')) {
        // 兼容旧的像素格式
        const sizeParts = fields.size.split('x');
        if (sizeParts.length === 2) {
          width = parseInt(sizeParts[0]) || 300;
          height = parseInt(sizeParts[1]) || 250;
        }
      }
    }

    // 提取价格信息 - 使用fixed_price字段
    const price = fields.fixed_price || '0';

    // 提取租期天数 - 保持默认30天
    const duration = 30;

    // 提取状态信息 - 使用is_available字段
    const available = fields.is_available === true;

    // 提取位置信息
    const location = fields.location || '未指定';

    // 提取game_id信息并构建名称
    const gameId = fields.game_id || '';
    const name = gameId ? `${gameId}` : `${adSpaceId.substring(0, 8)}`;

    // 提取描述信息
    const description = fields.location ? `位于 ${fields.location} 的广告位` : '广告位详情';

    // 提取创建者信息
    const creator = fields.creator || '';

    // 获取NFT ID列表
    const { getNFTsByAdSpace } = await import('./tableUtils');
    const nft_ids = await getNFTsByAdSpace(adSpaceId);

    // 构建广告位对象
    const adSpace: AdSpace = {
      id: adSpaceId,
      name,
      description,
      imageUrl: '', // 广告位没有实际图片
      price,
      duration,
      dimension: {
        width,
        height
      },
      aspectRatio, // 添加比例字段
      owner: null, // 暂不处理所有者
      available,
      location,
      creator, // 添加创建者字段
      nft_ids // 添加NFT ID列表
    };

    console.log('成功解析广告位详情:', adSpace.id, adSpace.name);

    return adSpace;
  } catch (error) {
    console.error('通过ID获取广告位失败:', error);
    return null;
  }
}

// 获取游戏开发者创建的广告位列表
export async function getCreatedAdSpaces(developerAddress: string): Promise<AdSpace[]> {

  // 实际从链上获取数据
  try {
    console.log('从Factory对象的game_devs字段获取开发者创建的广告位数据，开发者地址:', developerAddress);

    if (!developerAddress || !developerAddress.startsWith('0x')) {
      console.error('开发者地址无效:', developerAddress);
      return [];
    }

    // 生成一个唯一的请求ID，用于日志跟踪
    const requestId = new Date().getTime().toString();
    console.log(`[${requestId}] 开始获取开发者创建的广告位数据`);

    // 调用 getGameDevAdSpaces 获取开发者的广告位ID列表
    const { getGameDevAdSpaces } = await import('./tableUtils');
    const adSpaceIds = await getGameDevAdSpaces(developerAddress);

    console.log(`[${requestId}] 从getGameDevAdSpaces获取到开发者的广告位ID列表:`, adSpaceIds);

    if (adSpaceIds.length === 0) {
      console.log(`[${requestId}] 开发者没有创建任何广告位`);
      return [{
        id: '0x0',
        name: '您还没有创建广告位',
        description: '您尚未创建任何广告位，点击"创建广告位"按钮开始创建您的第一个广告位。',
        imageUrl: 'https://via.placeholder.com/300x250?text=创建您的第一个广告位',
        price: '0',
        duration: 30,
        dimension: { width: 0, height: 0 },
        owner: null,
        available: false,
        location: '',
        isExample: true,
        price_description: ''
      }];
    }

    // 根据广告位ID列表获取广告位详情
    const adSpaces: AdSpace[] = [];
    const client = createSuiClient();

    for (const adSpaceId of adSpaceIds) {
      try {
        console.log(`[${requestId}] 获取广告位详情:`, adSpaceId);

        // 获取广告位对象
        const adSpaceObj = await client.getObject({
          id: adSpaceId,
          options: { showContent: true, showType: true }
        });

        if (!adSpaceObj.data?.content || adSpaceObj.data.content.dataType !== 'moveObject') {
          console.warn(`[${requestId}] 广告位对象不是moveObject类型:`, adSpaceId);
          continue;
        }

        // 类型断言为含有fields的对象
        const moveObject = adSpaceObj.data.content as { dataType: 'moveObject', fields: Record<string, any> };
        if (!moveObject.fields) {
          console.warn(`[${requestId}] 广告位对象没有fields字段:`, adSpaceId);
          continue;
        }

        const fields = moveObject.fields;
        console.log(`[${requestId}] 广告位对象字段:`, adSpaceId, Object.keys(fields));

        // 记录完整字段内容以便调试
        console.log(`[${requestId}] 广告位字段详细内容:`, JSON.stringify(fields, null, 2));

        // 提取广告位信息
        const gameId = fields.game_id || '';
        const location = fields.location || '未知位置';
        const price = fields.fixed_price || '0';
        const isAvailable = fields.is_available !== undefined ? fields.is_available : true;
        const creator = fields.creator || '';

        // 安全地获取尺寸信息
        let width = 300, height = 250;
        const aspectRatio = fields.size || "16:9";

        // 处理比例格式 (例如: "16:9")
        if (fields.size && typeof fields.size === 'string') {
          if (fields.size.includes(':')) {
            // 新的比例格式
            const [w, h] = fields.size.split(':').map(Number);
            if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
              // 设置基于比例的预览尺寸
              const baseSize = 300;
              if (w >= h) {
                width = baseSize;
                height = Math.round(baseSize * (h / w));
              } else {
                height = baseSize;
                width = Math.round(baseSize * (w / h));
              }
            }
          } else if (fields.size.includes('x')) {
            // 兼容旧的像素格式
            const sizeParts = fields.size.split('x');
            if (sizeParts.length === 2) {
              width = parseInt(sizeParts[0]) || 300;
              height = parseInt(sizeParts[1]) || 250;
            }
          }
        }

        // 构建广告位数据
        const adSpace: AdSpace = {
          id: adSpaceId,
          name: gameId ? `${gameId}` : `${adSpaceId.substring(0, 8)}`,
          description: location ? `位于 ${location} 的广告位` : '广告位详情',
          imageUrl: `https://via.placeholder.com/${width}x${height}?text=${gameId || 'AdSpace'}`,
          price: price,
          duration: 30, // 默认30天
          dimension: {
            width,
            height,
          },
          aspectRatio, // 添加比例字段
          owner: developerAddress, // 开发者就是所有者
          available: isAvailable,
          location: location,
          creator, // 添加创建者字段
        };

        adSpaces.push(adSpace);
        console.log(`[${requestId}] 成功添加广告位:`, adSpace.id);
      } catch (err) {
        console.error(`[${requestId}] 解析广告位时出错:`, adSpaceId, err);
      }
    }

    console.log(`[${requestId}] 成功获取开发者广告位数量:`, adSpaces.length);
    return adSpaces;
  } catch (error) {
    console.error('获取开发者广告位失败:', error);

    // 返回友好的错误提示
    return [{
      id: '0x0',
      name: '数据加载失败',
      description: '加载广告位数据时发生错误，请刷新页面重试。',
      imageUrl: 'https://via.placeholder.com/300x250?text=加载失败',
      price: '0',
      duration: 30,
      dimension: { width: 300, height: 250 },
      owner: null,
      available: false,
      location: '无',
      isExample: true // 标记这是示例数据
    }];
  }
}

// 移除游戏开发者的交易
export function removeGameDevTx(params: RemoveGameDevParams): Transaction {
  const tx = new Transaction();

  // @ts-ignore
  // 调用合约的 remove_game_dev 函数
  // @ts-ignore
  tx.moveCall({
    target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::remove_game_dev`,
    arguments: [
      tx.object(params.factoryId),  // Factory 对象
      tx.pure.address(params.developer) // 开发者地址
    ],
  });

  return tx;
}

// 创建删除广告位的交易
export function deleteAdSpaceTx(params: { factoryId: string, adSpaceId: string }): Transaction {
  const tx = new Transaction();

  // @ts-ignore
  tx.moveCall({
    target: `${CONTRACT_CONFIG.PACKAGE_ID}::${CONTRACT_CONFIG.MODULE_NAME}::delete_ad_space`,
    arguments: [
      tx.object(params.factoryId),
      tx.object(params.adSpaceId)
    ],
  });

  return tx;
}

// 检查广告位是否有活跃或待展示的NFT（根据NFT ID数组）
export async function checkAdSpaceHasActiveNFTs(nftIds: string[]): Promise<boolean> {
  try {
    if (!nftIds || nftIds.length === 0) {
      return false;
    }

    const client = createSuiClient();
    const now = Date.now();

    // 检查每个NFT的状态
    for (const nftId of nftIds) {
      try {
        // 获取NFT对象
        const nftObj = await client.getObject({
          id: nftId,
          options: { showContent: true, showType: true }
        });

        if (!nftObj.data?.content || nftObj.data.content.dataType !== 'moveObject') {
          console.warn('NFT对象不是moveObject类型:', nftId);
          continue;
        }

        // 类型断言为含有fields的对象
        const moveObject = nftObj.data.content as { dataType: 'moveObject', fields: Record<string, any> };
        if (!moveObject.fields) {
          console.warn('NFT对象没有fields字段:', nftId);
          continue;
        }

        const fields = moveObject.fields;

        // 获取租期信息
        const leaseStart = fields.lease_start ? Number(fields.lease_start) * 1000 : 0;
        const leaseEnd = fields.lease_end ? Number(fields.lease_end) * 1000 : 0;

        // 检查是否活跃或待展示
        // 活跃的NFT：当前时间 <= lease_end
        // 待展示的NFT：当前时间 <= lease_start
        const isActive = now <= leaseEnd;
        const isPending = now <= leaseStart;

        if (isActive || isPending) {
          console.log(`发现活跃或待展示的NFT: ${nftId}, 当前时间: ${now}, 租期开始: ${leaseStart}, 租期结束: ${leaseEnd}`);
          return true;
        }
      } catch (err) {
        console.error('检查NFT状态时出错:', nftId, err);
        // 如果无法获取NFT信息，为了安全起见，假设它是活跃的
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('检查广告位活跃NFT失败:', error);
    // 出错时为了安全起见，假设有活跃NFT
    return true;
  }
}

