import { createSuiClient } from './contract';
import { CONTRACT_CONFIG } from '../config/config';
import { AdSpace } from '../types';
import { PaginatedDynamicFieldInfos } from '@mysten/sui/client';

/**
 * 获取Table中的所有键
 * @param tableId Table的ID
 * @param limit 每页的数量限制
 * @returns Table中的所有键
 */
export async function getTableKeys(tableId: string, limit: number = 50): Promise<any[]> {
  try {
    const client = createSuiClient();
    let hasNextPage = true;
    let cursor: string | null | undefined = null;
    const allKeys = [];

    // 循环获取所有页
    while (hasNextPage) {
      const response: PaginatedDynamicFieldInfos = await client.getDynamicFields({
        parentId: tableId,
        cursor,
        limit
      });

      allKeys.push(...response.data);

      // 更新分页信息
      hasNextPage = response.hasNextPage;
      cursor = response.nextCursor;

      if (!hasNextPage) break;
    }

    return allKeys;
  } catch (error) {
    console.error('获取Table键失败:', error);
    return [];
  }
}

/**
 * 获取Table中特定键的值
 * @param tableId Table的ID
 * @param keyName 键名
 * @returns 键对应的值
 */
export async function getTableValue(tableId: string, keyName: any) {
  try {
    const client = createSuiClient();

    // 获取动态字段对象
    const fieldObject = await client.getDynamicFieldObject({
      parentId: tableId,
      name: keyName
    });

    if (!fieldObject.data || !fieldObject.data.content || fieldObject.data.content.dataType !== 'moveObject') {
      console.error('无法获取Table值');
      return null;
    }

    // 打印完整的字段对象，以便调试
    console.log('Table值字段对象:', fieldObject.data.content.fields);

    // 返回值
    const fields = fieldObject.data.content.fields as any;

    // 处理不同格式的值
    if (fields.value !== undefined) {
      return fields.value;
    } else if (fields.name && fields.value === undefined) {
      // 某些情况下，值可能直接在fields中
      return fields;
    } else {
      console.warn('无法从字段中提取值:', fields);
      return null;
    }
  } catch (error) {
    console.error('获取Table值失败:', error);
    return null;
  }
}

/**
 * 获取所有游戏开发者地址
 * @param factoryId Factory对象的ID
 * @returns 所有游戏开发者地址
 */
export async function getAllGameDevs(factoryId: string): Promise<string[]> {
  try {
    console.log('获取所有游戏开发者地址, 工厂ID:', factoryId);

    // 获取Factory对象
    const client = createSuiClient();
    const factoryObj = await client.getObject({
      id: factoryId,
      options: { showContent: true, showType: true }
    });

    if (!factoryObj.data || !factoryObj.data.content || factoryObj.data.content.dataType !== 'moveObject') {
      console.error('无法获取Factory对象');
      return [];
    }

    // 获取game_devs表的ID
    const fields = factoryObj.data.content.fields as any;

    // 检查game_devs字段的结构
    console.log('Factory game_devs字段:', fields.game_devs);

    // 确保game_devs字段存在且格式正确
    if (!fields.game_devs || !fields.game_devs.fields || !fields.game_devs.fields.id || !fields.game_devs.fields.id.id) {
      console.error('Factory对象中game_devs字段结构不正确:', fields.game_devs);
      return [];
    }

    const gameDevsTableId = fields.game_devs.fields.id.id;
    const tableSize = parseInt(fields.game_devs.fields.size || '0');

    console.log('游戏开发者表ID:', gameDevsTableId, '表大小:', tableSize);

    // 如果表为空，直接返回
    if (tableSize === 0) {
      console.log('游戏开发者表为空');
      return [];
    }

    // 获取game_devs表中的所有键
    const gameDevKeys = await getTableKeys(gameDevsTableId);
    console.log('获取到游戏开发者键:', gameDevKeys);

    // 提取游戏开发者地址
    const gameDevs = gameDevKeys.map(key => {
      // 打印键的详细信息以便调试
      console.log('游戏开发者键详情:', key);

      // 确保值是字符串类型
      if (!key || !key.name) {
        console.warn('无效的键格式:', key);
        return null;
      }

      // 处理不同格式的键
      let address: string;
      if (typeof key.name === 'string') {
        address = key.name;
      } else if (key.name.value) {
        address = typeof key.name.value === 'string' ? key.name.value : String(key.name.value);
      } else {
        console.warn('无法提取地址:', key.name);
        return null;
      }

      return address;
    }).filter(Boolean) as string[]; // 过滤掉null值

    console.log('获取到游戏开发者列表:', gameDevs);
    return gameDevs;
  } catch (error) {
    console.error('获取所有游戏开发者失败:', error);
    return [];
  }
}

/**
 * 获取所有广告位
 * @param factoryId Factory对象的ID
 * @returns 所有广告位
 */
export async function getAllAdSpaces(factoryId: string): Promise<AdSpace[]> {
  try {
    console.log('获取所有广告位, 工厂ID:', factoryId);

    // 获取Factory对象
    const client = createSuiClient();
    const factoryObj = await client.getObject({
      id: factoryId,
      options: { showContent: true, showType: true }
    });

    if (!factoryObj.data || !factoryObj.data.content || factoryObj.data.content.dataType !== 'moveObject') {
      console.error('无法获取Factory对象');
      return [];
    }

    // 获取ad_spaces表的ID
    const fields = factoryObj.data.content.fields as any;

    // 检查ad_spaces字段的结构
    console.log('Factory ad_spaces字段:', fields.ad_spaces);

    // 确保ad_spaces字段存在且格式正确
    if (!fields.ad_spaces || !fields.ad_spaces.fields || !fields.ad_spaces.fields.id || !fields.ad_spaces.fields.id.id) {
      console.error('Factory对象中ad_spaces字段结构不正确:', fields.ad_spaces);
      return [];
    }

    const adSpacesTableId = fields.ad_spaces.fields.id.id;
    const tableSize = parseInt(fields.ad_spaces.fields.size || '0');

    console.log('广告位表ID:', adSpacesTableId, '表大小:', tableSize);

    // 如果表为空，直接返回
    if (tableSize === 0) {
      console.log('广告位表为空');
      return [];
    }

    // 获取ad_spaces表中的所有键
    const adSpaceKeys = await getTableKeys(adSpacesTableId);
    console.log('获取到广告位键:', adSpaceKeys);

    // 获取所有广告位详情和NFT ID列表
    const adSpacePromises = adSpaceKeys.map(async key => {
      // 打印键的详细信息以便调试
      console.log('广告位键详情:', key);

      // 确保键格式正确
      if (!key || !key.name) {
        console.warn('无效的键格式:', key);
        return null;
      }

      // 处理不同格式的键
      let adSpaceId: string;
      if (typeof key.name === 'string') {
        adSpaceId = key.name;
      } else if (key.name.value) {
        adSpaceId = typeof key.name.value === 'string' ? key.name.value : String(key.name.value);
      } else {
        console.warn('无法提取广告位ID:', key.name);
        return null;
      }

      try {
        // 获取广告位详情
        const adSpace = await import('./contract').then(module => module.getAdSpaceById(adSpaceId));

        if (adSpace) {
          // 获取广告位对应的NFT ID列表
          const nftIdsData = await getTableValue(adSpacesTableId, {
            type: '0x2::object::ID',
            value: adSpaceId
          });
          console.log(`广告位 ${adSpaceId} 的NFT ID列表原始数据:`, nftIdsData);

          // 处理NFT ID列表
          let nftIds: string[] = [];
          if (nftIdsData) {
            // 如果是数组，直接使用
            if (Array.isArray(nftIdsData)) {
              nftIds = nftIdsData.map(id => {
                // 处理可能的ID对象
                if (typeof id === 'string') {
                  return id;
                } else if (id && id.id) {
                  return id.id;
                } else {
                  return String(id);
                }
              });
            } else if (nftIdsData.fields && nftIdsData.fields.contents && Array.isArray(nftIdsData.fields.contents)) {
              // 处理可能的特殊格式
              nftIds = nftIdsData.fields.contents.map((id: any) => {
                if (typeof id === 'string') {
                  return id;
                } else if (id && id.id) {
                  return id.id;
                } else {
                  return String(id);
                }
              });
            } else {
              console.warn(`广告位 ${adSpaceId} 的NFT ID列表格式不支持:`, nftIdsData);
            }
          }

          console.log(`广告位 ${adSpaceId} 的处理后NFT ID列表:`, nftIds);

          // 将NFT ID列表添加到广告位对象中
          (adSpace as any).nft_ids = nftIds;

          return adSpace;
        }
        return null;
      } catch (err) {
        console.error(`获取广告位 ${adSpaceId} 详情或NFT ID列表失败:`, err);
        return null;
      }
    });

    const adSpaces = await Promise.all(adSpacePromises);
    const validAdSpaces = adSpaces.filter(Boolean) as AdSpace[];

    console.log('获取到广告位列表:', validAdSpaces);
    return validAdSpaces;
  } catch (error) {
    console.error('获取所有广告位失败:', error);
    return [];
  }
}

/**
 * 获取广告位的NFT列表（从Factory的ad_spaces字段获取）
 * @param adSpaceId 广告位ID
 * @returns NFT ID列表
 */
export async function getNFTsByAdSpace(adSpaceId: string): Promise<string[]> {
  try {
    console.log('从Factory对象的ad_spaces字段获取广告位的NFT列表，广告位ID:', adSpaceId);

    if (!adSpaceId || !adSpaceId.startsWith('0x')) {
      console.error('广告位ID无效:', adSpaceId);
      return [];
    }

    // 生成一个唯一的请求ID，用于日志跟踪
    const requestId = new Date().getTime().toString();
    console.log(`[${requestId}] 开始从Factory获取广告位的NFT列表`);

    const client = createSuiClient();

    // 首先获取Factory对象
    const factoryObj = await client.getObject({
      id: CONTRACT_CONFIG.FACTORY_OBJECT_ID,
      options: { showContent: true, showType: true }
    });

    if (!factoryObj.data || !factoryObj.data.content || factoryObj.data.content.dataType !== 'moveObject') {
      console.error(`[${requestId}] 无法获取Factory对象`);
      return [];
    }

    const factoryContent = factoryObj.data.content as { dataType: 'moveObject', fields: Record<string, any> };
    const factoryFields = factoryContent.fields;

    console.log(`[${requestId}] Factory对象字段:`, Object.keys(factoryFields));

    // 获取ad_spaces字段
    const adSpacesField = factoryFields.ad_spaces;
    if (!adSpacesField || !adSpacesField.fields || !adSpacesField.fields.id) {
      console.log(`[${requestId}] Factory中没有ad_spaces字段或字段为空`);
      return [];
    }

    // 使用getTableValue获取广告位的NFT列表
    let nftIds: string[] = [];
    try {
      const nftList = await getTableValue(adSpacesField.fields.id.id, {
        type: '0x2::object::ID',
        value: adSpaceId
      });

      console.log(`[${requestId}] 从Table获取到的NFT列表:`, nftList);

      if (Array.isArray(nftList)) {
        nftIds = nftList.map(id => typeof id === 'string' ? id : id.toString());
      } else if (nftList && typeof nftList === 'object') {
        // 处理可能的其他格式
        console.log(`[${requestId}] NFT列表格式:`, nftList);
        // 如果返回的是对象，可能需要进一步处理
        nftIds = [];
      }
    } catch (error) {
      console.log(`[${requestId}] 广告位 ${adSpaceId} 不在ad_spaces列表中或没有NFT:`, error);
      return [];
    }

    console.log(`[${requestId}] 从Factory获取到广告位的NFT ID列表:`, nftIds);
    return nftIds;
  } catch (error) {
    console.error('获取广告位NFT列表失败:', error);
    return [];
  }
}

/**
 * 获取开发者的广告位列表（从Factory的game_devs字段获取）
 * @param developerAddress 开发者地址
 * @returns 广告位ID列表
 */
export async function getGameDevAdSpaces(developerAddress: string): Promise<string[]> {
  try {
    console.log('从Factory对象的game_devs字段获取开发者的广告位ID列表，开发者地址:', developerAddress);

    if (!developerAddress || !developerAddress.startsWith('0x')) {
      console.error('开发者地址无效:', developerAddress);
      return [];
    }

    // 生成一个唯一的请求ID，用于日志跟踪
    const requestId = new Date().getTime().toString();
    console.log(`[${requestId}] 开始从Factory获取开发者的广告位ID列表`);

    const client = createSuiClient();

    // 首先获取Factory对象
    const factoryObj = await client.getObject({
      id: CONTRACT_CONFIG.FACTORY_OBJECT_ID,
      options: { showContent: true, showType: true }
    });

    if (!factoryObj.data || !factoryObj.data.content || factoryObj.data.content.dataType !== 'moveObject') {
      console.error(`[${requestId}] 无法获取Factory对象`);
      return [];
    }

    const factoryContent = factoryObj.data.content as { dataType: 'moveObject', fields: Record<string, any> };
    const factoryFields = factoryContent.fields;

    console.log(`[${requestId}] Factory对象字段:`, Object.keys(factoryFields));

    // 获取game_devs字段
    const gameDevsField = factoryFields.game_devs;
    if (!gameDevsField || !gameDevsField.fields || !gameDevsField.fields.id) {
      console.log(`[${requestId}] Factory中没有game_devs字段或字段为空`);
      return [];
    }

    // 使用getTableValue获取开发者的广告位列表
    let adSpaceIds: string[] = [];
    try {
      const adSpaceList = await getTableValue(gameDevsField.fields.id.id, {
        type: 'address',
        value: developerAddress
      });

      console.log(`[${requestId}] 从Table获取到的广告位列表:`, adSpaceList);

      if (Array.isArray(adSpaceList)) {
        adSpaceIds = adSpaceList.map(id => typeof id === 'string' ? id : id.toString());
      } else if (adSpaceList && typeof adSpaceList === 'object') {
        // 处理可能的其他格式
        console.log(`[${requestId}] 广告位列表格式:`, adSpaceList);
        // 如果返回的是对象，可能需要进一步处理
        adSpaceIds = [];
      }
    } catch (error) {
      console.log(`[${requestId}] 开发者 ${developerAddress} 不在game_devs列表中或没有广告位:`, error);
      return [];
    }

    console.log(`[${requestId}] 从Factory获取到开发者的广告位ID列表:`, adSpaceIds);
    return adSpaceIds;
  } catch (error) {
    console.error('获取开发者广告位列表失败:', error);
    return [];
  }
}
