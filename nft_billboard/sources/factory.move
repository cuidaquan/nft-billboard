module nft_billboard::factory {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use std::vector;
    use sui::event;
    use sui::table::{Self, Table};

    // 错误码
    const ENotAuthorized: u64 = 1;
    const EInvalidPlatformRatio: u64 = 2;
    const EGameDevNotFound: u64 = 3;
    const EAdSpaceNotFound: u64 = 4;
    const EGameDevHasAdSpaces: u64 = 6;



    // 工厂结构，用于管理广告位和分成比例
    public struct Factory has key {
        id: UID,
        admin: address,
        ad_spaces: Table<ID, vector<ID>>,  // 使用广告位ID作为key，值为NFT ID列表
        game_devs: Table<address, vector<ID>>,   // 使用地址作为key，值为该开发者创建的广告位ID列表
        platform_ratio: u8   // 平台分成比例，百分比
    }

    // 事件定义
    public struct FactoryCreated has copy, drop {
        admin: address,
        platform_ratio: u8
    }

    public struct AdSpaceRegistered has copy, drop {
        ad_space_id: ID,
        creator: address
    }

    public struct RatioUpdated has copy, drop {
        factory_id: ID,
        platform_ratio: u8
    }

    // 游戏开发者移除事件
    public struct GameDevRemoved has copy, drop {
        game_dev: address
    }

    // 广告位从工厂移除事件
    public struct AdSpaceRemoved has copy, drop {
        ad_space_id: ID,
        removed_by: address
    }

    // 默认分成比例
    const DEFAULT_PLATFORM_RATIO: u8 = 10;  // 平台默认分成 10%

    // 初始化工厂
    public fun init_factory(ctx: &mut TxContext) {
        let factory = Factory {
            id: object::new(ctx),
            admin: tx_context::sender(ctx),
            ad_spaces: table::new<ID, vector<ID>>(ctx),
            game_devs: table::new<address, vector<ID>>(ctx),
            platform_ratio: DEFAULT_PLATFORM_RATIO
        };

        transfer::share_object(factory);

        event::emit(FactoryCreated {
            admin: tx_context::sender(ctx),
            platform_ratio: DEFAULT_PLATFORM_RATIO
        });
    }

    // 注册广告位
    public fun register_ad_space(
        factory: &mut Factory,
        ad_space_id: ID,
        creator: address
    ) {
        // 检查开发者是否已注册，如果未注册则报错
        assert!(table::contains(&factory.game_devs, creator), EGameDevNotFound);

        // 添加到广告位Table中
        table::add(&mut factory.ad_spaces, ad_space_id, vector::empty<ID>());

        // 将广告位ID添加到开发者的广告位列表中
        let ad_space_list = table::borrow_mut(&mut factory.game_devs, creator);
        vector::push_back(ad_space_list, ad_space_id);

        event::emit(AdSpaceRegistered {
            ad_space_id,
            creator
        });
    }



    // 获取管理员地址
    public fun get_admin(factory: &Factory): address {
        factory.admin
    }

    // 注册游戏开发者
    public fun register_game_dev(factory: &mut Factory, game_dev: address, ctx: &mut TxContext) {
        // 只有管理员可以注册
        assert!(tx_context::sender(ctx) == factory.admin, ENotAuthorized);

        // 如果已存在，直接返回
        if (table::contains(&factory.game_devs, game_dev)) {
            return
        };

        // 添加到Table中，初始化为空的广告位列表
        table::add(&mut factory.game_devs, game_dev, vector::empty<ID>());
    }

    // 移除游戏开发者
    public fun remove_game_dev(factory: &mut Factory, game_dev: address, ctx: &mut TxContext) {
        // 只有管理员可以移除
        assert!(tx_context::sender(ctx) == factory.admin, ENotAuthorized);

        // 确保开发者存在
        assert!(table::contains(&factory.game_devs, game_dev), EGameDevNotFound);

        // 检查该开发者是否有广告位，如果有则不能删除
        let ad_space_list = table::borrow(&factory.game_devs, game_dev);
        assert!(vector::is_empty(ad_space_list), EGameDevHasAdSpaces);

        // 移除开发者
        table::remove(&mut factory.game_devs, game_dev);

        // 发送事件
        event::emit(GameDevRemoved {
            game_dev
        });
    }



    // 检查是否是游戏开发者
    public fun is_game_dev(factory: &Factory, game_dev: address): bool {
        table::contains(&factory.game_devs, game_dev)
    }

    // 更新分成比例
    public fun update_ratios(
        factory: &mut Factory,
        platform_ratio: u8,
        ctx: &mut TxContext
    ) {
        // 只有管理员可以更新
        assert!(tx_context::sender(ctx) == factory.admin, ENotAuthorized);

        // 验证分成比例的有效性
        assert!(platform_ratio <= 100, EInvalidPlatformRatio);

        factory.platform_ratio = platform_ratio;

        event::emit(RatioUpdated {
            factory_id: object::id(factory),
            platform_ratio
        });
    }

    // 获取平台分成比例
    public fun get_platform_ratio(factory: &Factory): u8 {
        factory.platform_ratio
    }



    // 从工厂中移除广告位
    public fun remove_ad_space(
        factory: &mut Factory,
        ad_space_id: ID,
        creator: address,
        ctx: &mut TxContext
    ) {
        // 确保广告位存在
        assert!(table::contains(&factory.ad_spaces, ad_space_id), EAdSpaceNotFound);


        // 从广告位Table中移除
        table::remove(&mut factory.ad_spaces, ad_space_id);

        // 从开发者的广告位列表中移除
        if (table::contains(&factory.game_devs, creator)) {
            let ad_space_list = table::borrow_mut(&mut factory.game_devs, creator);
            let (found, index) = vector::index_of(ad_space_list, &ad_space_id);
            if (found) {
                vector::remove(ad_space_list, index);
            };
        };

        // 发送事件
        event::emit(AdSpaceRemoved {
            ad_space_id,
            removed_by: tx_context::sender(ctx)
        });
    }

    // 添加NFT到广告位
    public fun add_nft_to_ad_space(
        factory: &mut Factory,
        ad_space_id: ID,
        nft_id: ID
    ) {
        // 确保广告位存在
        assert!(table::contains(&factory.ad_spaces, ad_space_id), EAdSpaceNotFound);

        // 获取NFT ID列表并添加新的NFT ID
        let nft_ids = table::borrow_mut(&mut factory.ad_spaces, ad_space_id);
        vector::push_back(nft_ids, nft_id);
    }

    
}