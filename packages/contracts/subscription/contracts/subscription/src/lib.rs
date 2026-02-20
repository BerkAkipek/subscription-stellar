#![no_std]

use soroban_sdk::{
    contract, contractclient, contractevent, contractimpl, contracttype, Address, Env,
};

#[contract]
pub struct SubscriptionContract;

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub admin: Address,
    pub token_contract: Address,
    pub treasury: Address,
}

#[contracttype]
#[derive(Clone)]
pub struct Subscription {
    pub plan_id: u32,
    pub expires_at: u64,
}

#[contracttype]
pub enum DataKey {
    Config,
    Subscription(Address),
}

#[contractevent]
#[derive(Clone)]
pub struct Initialized {
    #[topic]
    pub admin: Address,
    #[topic]
    pub token_contract: Address,
    #[topic]
    pub treasury: Address,
}

#[contractevent]
#[derive(Clone)]
pub struct Subscribed {
    #[topic]
    pub user: Address,
    pub plan_id: u32,
    pub expires_at: u64,
    pub amount_charged: i128,
}

#[contractevent]
#[derive(Clone)]
pub struct Cancelled {
    #[topic]
    pub user: Address,
}

#[contractclient(name = "TokenClient")]
pub trait TokenizationContract {
    fn transfer(env: Env, from: Address, to: Address, amount: i128);
}

#[contractimpl]
impl SubscriptionContract {
    pub fn init(env: Env, admin: Address, token_contract: Address, treasury: Address) {
        if env.storage().instance().has(&DataKey::Config) {
            panic!("already initialized");
        }

        admin.require_auth();

        let cfg = Config {
            admin: admin.clone(),
            token_contract: token_contract.clone(),
            treasury: treasury.clone(),
        };
        env.storage().instance().set(&DataKey::Config, &cfg);

        Initialized {
            admin,
            token_contract,
            treasury,
        }
        .publish(&env);
    }

    pub fn subscribe(env: Env, user: Address, plan_id: u32, duration_seconds: u64, amount: i128) {
        user.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let cfg: Config = env
            .storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized");

        TokenClient::new(&env, &cfg.token_contract).transfer(&user, &cfg.treasury, &amount);

        let now = env.ledger().timestamp();

        let sub = Subscription {
            plan_id,
            expires_at: now + duration_seconds,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Subscription(user.clone()), &sub);

        Subscribed {
            user,
            plan_id,
            expires_at: sub.expires_at,
            amount_charged: amount,
        }
        .publish(&env);
    }

    pub fn get_subscription(env: Env, user: Address) -> Option<Subscription> {
        env.storage().persistent().get(&DataKey::Subscription(user))
    }

    pub fn cancel(env: Env, user: Address) {
        user.require_auth();

        env.storage()
            .persistent()
            .remove(&DataKey::Subscription(user.clone()));

        Cancelled { user }.publish(&env);
    }

    pub fn get_config(env: Env) -> Config {
        env.storage()
            .instance()
            .get(&DataKey::Config)
            .expect("not initialized")
    }
}
