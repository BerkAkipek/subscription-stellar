#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype,
    Env, Address, Symbol
};

#[contract]
pub struct SubscriptionContract;

#[contracttype]
#[derive(Clone)]
pub struct Subscription {
    pub plan_id: u32,
    pub expires_at: u64,
}

#[contracttype]
pub enum DataKey {
    Subscription(Address),
}

#[contractimpl]
impl SubscriptionContract {

    pub fn subscribe(
        env: Env,
        user: Address,
        plan_id: u32,
        duration_seconds: u64,
    ) {
        user.require_auth();

        let now = env.ledger().timestamp();

        let sub = Subscription {
            plan_id,
            expires_at: now + duration_seconds,
        };

        env.storage().instance().set(
            &DataKey::Subscription(user.clone()),
            &sub
        );

        env.events().publish(
            (Symbol::new(&env, "subscribed"), user),
            plan_id
        );
    }

    pub fn get_subscription(
        env: Env,
        user: Address,
    ) -> Option<Subscription> {

        env.storage().instance().get(
            &DataKey::Subscription(user)
        )
    }

    pub fn cancel(env: Env, user: Address) {
        user.require_auth();

        env.storage().instance().remove(
            &DataKey::Subscription(user.clone())
        );

        env.events().publish(
            (Symbol::new(&env, "cancelled"), user),
            Symbol::new(&env, "ok")
        );
    }
}