# Factory结构优化方案

## 当前问题

Factory结构中使用了两个vector：
- `ad_spaces: vector<AdSpaceEntry>`：存储所有广告位信息
- `game_devs: vector<address>`：存储所有游戏开发者地址

当这些vector的大小增长到1000以上时，会出现性能问题，主要体现在：
1. 查找操作需要O(n)时间复杂度，随着数据量增加，性能下降明显
2. 修改操作（如添加、删除）也需要O(n)时间复杂度
3. 当数据量大时，遍历整个vector会消耗大量gas

## 优化方案

将vector结构改为Table结构，具体修改如下：

### 1. 数据结构修改

```move
// 修改前
public struct AdSpaceEntry has store, copy, drop {
    ad_space_id: ID,
    creator: address,
    nft_ids: vector<ID>  // 存储广告位中的所有NFT ID
}

public struct Factory has key {
    id: UID,
    admin: address,
    ad_spaces: vector<AdSpaceEntry>,  // 改为vector<AdSpaceEntry>，更容易在JSON中显示
    game_devs: vector<address>, // 游戏开发者地址列表
    platform_ratio: u8   // 平台分成比例，百分比
}

// 修改后
public struct Factory has key {
    id: UID,
    admin: address,
    ad_spaces: Table<ID, vector<ID>>,  // 使用广告位ID作为key，值为NFT ID列表
    game_devs: Table<address, bool>,     // 使用地址作为key，值为bool表示存在
    platform_ratio: u8   // 平台分成比例，百分比
}
```

### 2. 函数修改

#### 2.1 初始化函数

```move
// 修改前
public fun init_factory(ctx: &mut TxContext) {
    let factory = Factory {
        id: object::new(ctx),
        admin: tx_context::sender(ctx),
        ad_spaces: vector::empty<AdSpaceEntry>(),
        game_devs: vector::empty<address>(),
        platform_ratio: DEFAULT_PLATFORM_RATIO
    };

    transfer::share_object(factory);

    event::emit(FactoryCreated {
        admin: tx_context::sender(ctx),
        platform_ratio: DEFAULT_PLATFORM_RATIO
    });
}

// 修改后
public fun init_factory(ctx: &mut TxContext) {
    let factory = Factory {
        id: object::new(ctx),
        admin: tx_context::sender(ctx),
        ad_spaces: table::new<ID, vector<ID>>(ctx),
        game_devs: table::new<address, bool>(ctx),
        platform_ratio: DEFAULT_PLATFORM_RATIO
    };

    transfer::share_object(factory);

    event::emit(FactoryCreated {
        admin: tx_context::sender(ctx),
        platform_ratio: DEFAULT_PLATFORM_RATIO
    });
}
```

#### 2.2 注册广告位

```move
// 修改前
public fun register_ad_space(
    factory: &mut Factory,
    ad_space_id: ID,
    creator: address
) {
    let entry = AdSpaceEntry {
        ad_space_id,
        creator,
        nft_ids: vector::empty<ID>()
    };
    vector::push_back(&mut factory.ad_spaces, entry);

    event::emit(AdSpaceRegistered {
        ad_space_id,
        creator
    });
}

// 修改后
public fun register_ad_space(
    factory: &mut Factory,
    ad_space_id: ID,
    creator: address
) {
    table::add(&mut factory.ad_spaces, ad_space_id, vector::empty<ID>());

    event::emit(AdSpaceRegistered {
        ad_space_id,
        creator
    });
}
```

#### 2.3 获取广告位创建者

```move
// 修改前
public fun get_ad_space_creator(factory: &Factory, ad_space_id: ID): address {
    let len = vector::length(&factory.ad_spaces);
    let mut i = 0;

    while (i < len) {
        let entry = vector::borrow(&factory.ad_spaces, i);
        if (entry.ad_space_id == ad_space_id) {
            return entry.creator
        };
        i = i + 1;
    };

    abort EAdSpaceNotFound
}

// 修改后 - 由于我们不再在Factory中存储创建者信息，这个函数需要修改
// 可以直接从AdSpace对象中获取创建者信息
public fun get_ad_space_creator(factory: &Factory, ad_space_id: ID): address {
    // 确保广告位存在
    assert!(table::contains(&factory.ad_spaces, ad_space_id), EAdSpaceNotFound);

    // 注意：这里需要从AdSpace对象中获取创建者信息
    // 由于我们不再在Factory中存储创建者信息，这个函数的实现需要修改
    // 可能需要传入AdSpace对象或从其他地方获取创建者信息
    abort ENotImplemented
}
```

#### 2.4 注册游戏开发者

```move
// 修改前
public fun register_game_dev(factory: &mut Factory, game_dev: address, ctx: &mut TxContext) {
    // 只有管理员可以注册
    assert!(tx_context::sender(ctx) == factory.admin, ENotAuthorized);

    // 检查是否已存在
    let mut i = 0;
    let len = vector::length(&factory.game_devs);
    while (i < len) {
        let dev = *vector::borrow(&factory.game_devs, i);
        if (dev == game_dev) {
            return
        };
        i = i + 1;
    };
    vector::push_back(&mut factory.game_devs, game_dev);
}

// 修改后
public fun register_game_dev(factory: &mut Factory, game_dev: address, ctx: &mut TxContext) {
    // 只有管理员可以注册
    assert!(tx_context::sender(ctx) == factory.admin, ENotAuthorized);

    // 如果已存在，直接返回
    if (table::contains(&factory.game_devs, game_dev)) {
        return
    };

    // 添加到Table中
    table::add(&mut factory.game_devs, game_dev, true);

    // 同时更新game_dev_addresses列表，方便前端获取
    vector::push_back(&mut factory.game_dev_addresses, game_dev);
}
```

#### 2.5 移除游戏开发者

```move
// 修改前
public fun remove_game_dev(factory: &mut Factory, game_dev: address, ctx: &mut TxContext) {
    // 只有管理员可以移除
    assert!(tx_context::sender(ctx) == factory.admin, ENotAuthorized);

    // 查找开发者的索引
    let mut i = 0;
    let len = vector::length(&factory.game_devs);
    let mut found = false;
    let mut index = 0;

    while (i < len) {
        let dev = *vector::borrow(&factory.game_devs, i);
        if (dev == game_dev) {
            found = true;
            index = i;
            break
        };
        i = i + 1;
    };

    // 确保开发者存在
    assert!(found, EGameDevNotFound);

    // 移除开发者
    vector::remove(&mut factory.game_devs, index);

    // 发送事件
    event::emit(GameDevRemoved {
        game_dev
    });
}

// 修改后
public fun remove_game_dev(factory: &mut Factory, game_dev: address, ctx: &mut TxContext) {
    // 只有管理员可以移除
    assert!(tx_context::sender(ctx) == factory.admin, ENotAuthorized);

    // 确保开发者存在
    assert!(table::contains(&factory.game_devs, game_dev), EGameDevNotFound);

    // 移除开发者
    table::remove(&mut factory.game_devs, game_dev);

    // 发送事件
    event::emit(GameDevRemoved {
        game_dev
    });
}
```

#### 2.6 获取游戏开发者列表

```move
// 修改前
public fun get_game_devs(factory: &Factory): vector<address> {
    let mut devs = vector::empty<address>();
    let mut i = 0;
    let len = vector::length(&factory.game_devs);
    while (i < len) {
        let dev = *vector::borrow(&factory.game_devs, i);
        vector::push_back(&mut devs, dev);
        i = i + 1;
    };
    devs
}

// 修改后
public fun get_game_devs(factory: &Factory): vector<address> {
    let mut devs = vector::empty<address>();
    let size = table::length(&factory.game_devs);

    // 如果Table为空，直接返回空vector
    if (size == 0) {
        return devs
    };

    // 获取Table中的所有key（游戏开发者地址）
    // 遍历Table中的所有key
    let mut i = 0;
    let keys = table::keys(&factory.game_devs);
    let len = vector::length(&keys);

    while (i < len) {
        let dev = *vector::borrow(&keys, i);
        vector::push_back(&mut devs, dev);
        i = i + 1;
    };

    devs
}
```

#### 2.7 检查是否是游戏开发者

```move
// 修改前
public fun is_game_dev(factory: &Factory, game_dev: address): bool {
    let mut i = 0;
    let len = vector::length(&factory.game_devs);
    while (i < len) {
        let dev = *vector::borrow(&factory.game_devs, i);
        if (dev == game_dev) {
            return true
        };
        i = i + 1;
    };
    false
}

// 修改后
public fun is_game_dev(factory: &Factory, game_dev: address): bool {
    table::contains(&factory.game_devs, game_dev)
}
```

#### 2.8 获取所有广告位

```move
// 修改前
public fun get_all_ad_spaces(factory: &Factory): vector<AdSpaceEntry> {
    let mut result = vector::empty<AdSpaceEntry>();
    let len = vector::length(&factory.ad_spaces);
    let mut i = 0;

    while (i < len) {
        let entry = *vector::borrow(&factory.ad_spaces, i);
        vector::push_back(&mut result, entry);
        i = i + 1;
    };

    result
}

// 修改后
// 由于结构变化，需要返回不同的结构
public struct AdSpaceInfo has store, copy, drop {
    ad_space_id: ID,
    nft_ids: vector<ID>
}

public fun get_all_ad_spaces(factory: &Factory): vector<AdSpaceInfo> {
    let mut result = vector::empty<AdSpaceInfo>();
    let size = table::length(&factory.ad_spaces);

    // 如果Table为空，直接返回空vector
    if (size == 0) {
        return result
    };

    // 获取Table中的所有key（广告位ID）
    let ad_space_ids = table::keys(&factory.ad_spaces);

    let mut i = 0;
    let len = vector::length(&ad_space_ids);
    while (i < len) {
        let ad_space_id = *vector::borrow(&ad_space_ids, i);
        let nft_ids = *table::borrow(&factory.ad_spaces, ad_space_id);

        let info = AdSpaceInfo {
            ad_space_id,
            nft_ids
        };
        vector::push_back(&mut result, info);
        i = i + 1;
    };

    result
}
```

## 前端修改需求

由于后端数据结构发生变化，前端代码也需要相应调整。但是由于我们在合约中提供了`get_game_devs`和`get_all_ad_spaces`函数，前端可以直接调用这些函数获取数据，而不需要直接访问Table结构。

### 具体修改点

1. **获取广告位列表**：
   ```typescript
   // 修改前
   if (fields && fields.ad_spaces) {
     let adSpaceEntries = [];
     if (Array.isArray(fields.ad_spaces)) {
       adSpaceEntries = fields.ad_spaces;
     } else {
       adSpaceEntries = [fields.ad_spaces];
     }
     // 处理adSpaceEntries...
   }

   // 修改后 - 调用合约函数获取
   const client = createSuiClient();

   // 调用get_all_ad_spaces函数获取所有广告位
   const txb = new TransactionBlock();
   txb.moveCall({
     target: `${CONTRACT_CONFIG.PACKAGE_ID}::factory::get_all_ad_spaces`,
     arguments: [txb.object(CONTRACT_CONFIG.FACTORY_OBJECT_ID)]
   });

   const response = await client.devInspectTransactionBlock({
     transactionBlock: txb,
     sender: account.address
   });

   // 解析返回的广告位列表
   const adSpaceEntries = response.results[0].returnValues[0];

   // 如果需要创建者信息，需要额外获取广告位对象
   for (const entry of adSpaceEntries) {
     // 获取广告位对象
     const adSpaceObj = await getAdSpaceById(entry.ad_space_id);
     if (adSpaceObj) {
       entry.creator = adSpaceObj.creator;
     }
   }
   ```

2. **获取游戏开发者列表**：
   ```typescript
   // 修改前
   if (fields.game_devs && Array.isArray(fields.game_devs)) {
     return fields.game_devs;
   }

   // 修改后 - 调用合约函数获取
   const client = createSuiClient();

   // 调用get_game_devs函数获取所有游戏开发者
   const txb = new TransactionBlock();
   txb.moveCall({
     target: `${CONTRACT_CONFIG.PACKAGE_ID}::factory::get_game_devs`,
     arguments: [txb.object(CONTRACT_CONFIG.FACTORY_OBJECT_ID)]
   });

   const response = await client.devInspectTransactionBlock({
     transactionBlock: txb,
     sender: account.address
   });

   // 解析返回的游戏开发者列表
   const gameDevelopers = response.results[0].returnValues[0];

   return gameDevelopers;
   ```

3. **获取广告位创建者**：
   ```typescript
   // 保留原来的方式
   // 从广告位对象中直接获取创建者信息
   // 不需要修改
   ```
```

## 工作量评估

1. **后端代码修改量**：
   - 修改Factory结构定义
   - 修改11个函数的实现
   - 添加`table::keys`函数的使用
   - 总计约150-200行代码需要修改

2. **前端代码修改量**：
   - 修改2个与Factory交互的函数（获取广告位列表和获取游戏开发者列表）
   - 使用`devInspectTransactionBlock`调用合约函数获取数据
   - 获取广告位创建者的方式保持不变
   - 总计约30-50行代码需要修改

3. **测试工作量**：
   - 对所有修改的后端函数进行单元测试
   - 对修改的前端函数进行功能测试
   - 进行集成测试，确保前后端交互正常
   - 进行性能测试，验证修改后的性能提升

4. **潜在风险**：
   - 数据结构变更可能影响现有数据的迁移
   - 前端调用合约函数的方式与之前不同，需要适应

## 性能提升预期

1. **查找操作**：从O(n)提升到O(1)，对于大数据量提升显著
2. **添加/删除操作**：从O(n)提升到O(1)
3. **遍历操作**：仍然是O(n)，但可以通过分页或其他方式优化

## 实施步骤

1. **准备工作**：
   - 备份当前代码
   - 创建新分支进行开发

2. **后端代码修改**：
   - 修改Factory结构定义
   - 逐个修改相关函数
   - 添加必要的错误处理

3. **前端代码修改**：
   - 修改与Factory交互的函数
   - 添加兼容性处理，支持新旧数据结构

4. **测试验证**：
   - 编写后端单元测试
   - 编写前端功能测试
   - 进行集成测试
   - 进行性能测试

5. **部署上线**：
   - 如果有现有数据，需要编写迁移脚本
   - 先部署后端修改
   - 再部署前端修改
   - 监控系统性能

## 总结

将Factory中的vector结构改为Table结构是一个值得考虑的优化，特别是当数据量预计会增长到1000以上时。这个修改可以显著提高查找、添加和删除操作的性能，从O(n)提升到O(1)。

主要挑战在于：

1. **后端实现**：Table结构不支持直接获取所有key的操作，需要额外的数据结构来维护所有key。

2. **前端适配**：前端可以通过调用合约中的`get_game_devs`和`get_all_ad_spaces`函数获取数据，不需要直接访问Table结构。这需要将前端获取数据的方式从直接读取对象字段改为调用合约函数。

3. **实现方式变化**：虽然功能保持不变，但实现方式有较大变化，需要同步修改前端和后端代码。

由于项目还在开发阶段，不需要考虑兼容老版本的问题，这简化了实施过程。前端性能问题可以在后续遇到时再解决，先专注于实现功能和提高后端性能。

建议在实施前进行充分的测试，特别是前端与后端的交互测试，确保修改后的代码正常工作。
