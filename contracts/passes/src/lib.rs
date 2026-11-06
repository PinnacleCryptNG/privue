use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise};

const FEE_BPS: u128 = 1_000;
const MS_PER_DAY: u64 = 86_400_000;

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Offer {
    pub handle: String,
    pub owner: AccountId,
    pub tier: String,
    pub price: NearToken,
    pub supply: u32,
    pub sold: u32,
    pub period_days: u32,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Pass {
    pub handle: String,
    pub tier: String,
    pub holder: String,
    pub buyer: AccountId,
    pub expires_at_ms: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    admin: AccountId,
    offers: IterableMap<String, Offer>,
    passes: LookupMap<String, Pass>,
}

fn offer_key(handle: &str, tier: &str) -> String {
    format!("{handle}:{tier}")
}

fn pass_key(handle: &str, tier: &str, holder: &str) -> String {
    format!("{handle}:{tier}:{}", holder.to_lowercase())
}

#[near]
impl Contract {
    #[init]
    pub fn new(admin: AccountId) -> Self {
        Self {
            admin,
            offers: IterableMap::new(b"o"),
            passes: LookupMap::new(b"p"),
        }
    }

    pub fn set_offer(&mut self, handle: String, tier: String, price: NearToken, supply: u32, period_days: u32, owner: Option<AccountId>) {
        require!(tier == "view" || tier == "copy", "tier must be view or copy");
        require!(supply > 0 && supply <= 10_000, "supply must be 1..10000");
        require!(period_days > 0 && period_days <= 365, "period must be 1..365 days");
        let caller = env::predecessor_account_id();
        let key = offer_key(&handle, &tier);
        let sold = match self.offers.get(&key) {
            Some(existing) => {
                require!(caller == existing.owner || caller == self.admin, "not the offer owner");
                require!(supply >= existing.sold, "supply below passes sold");
                existing.sold
            }
            None => 0,
        };
        let owner = match owner {
            Some(o) => {
                require!(caller == self.admin, "only admin can set another owner");
                o
            }
            None => caller,
        };
        self.offers.insert(key, Offer { handle, owner, tier, price, supply, sold, period_days });
    }

    #[payable]
    pub fn buy_pass(&mut self, handle: String, tier: String, holder: String) -> Pass {
        require!(!holder.is_empty() && holder.len() <= 128, "bad holder id");
        let key = offer_key(&handle, &tier);
        let mut offer = self.offers.get(&key).cloned().unwrap_or_else(|| env::panic_str("no such offer"));
        let deposit = env::attached_deposit();
        require!(deposit >= offer.price, "deposit below price");
        let now = env::block_timestamp_ms();
        let pk = pass_key(&handle, &tier, &holder);
        let current = self.passes.get(&pk).cloned();
        let renewing = current.as_ref().is_some_and(|p| p.expires_at_ms > now);
        if !renewing {
            require!(offer.sold < offer.supply, "sold out");
            offer.sold += 1;
        }
        let start = current.as_ref().map(|p| p.expires_at_ms.max(now)).unwrap_or(now);
        let pass = Pass {
            handle,
            tier,
            holder: holder.to_lowercase(),
            buyer: env::predecessor_account_id(),
            expires_at_ms: start + offer.period_days as u64 * MS_PER_DAY,
        };
        self.passes.insert(pk, pass.clone());
        let price = offer.price.as_yoctonear();
        let payout = price - price * FEE_BPS / 10_000;
        let owner = offer.owner.clone();
        self.offers.insert(key, offer);
        if payout > 0 {
            Promise::new(owner).transfer(NearToken::from_yoctonear(payout)).detach();
        }
        let change = deposit.as_yoctonear() - price;
        if change > 0 {
            Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(change)).detach();
        }
        env::log_str(&format!("EVENT_JSON:{{\"standard\":\"privue\",\"version\":\"1\",\"event\":\"pass_bought\",\"data\":{{\"handle\":\"{}\",\"tier\":\"{}\",\"expires_at_ms\":{}}}}}", pass.handle, pass.tier, pass.expires_at_ms));
        pass
    }

    pub fn has_pass(&self, handle: String, tier: String, holder: String) -> bool {
        self.passes
            .get(&pass_key(&handle, &tier, &holder))
            .is_some_and(|p| p.expires_at_ms > env::block_timestamp_ms())
    }

    pub fn get_pass(&self, handle: String, tier: String, holder: String) -> Option<Pass> {
        self.passes.get(&pass_key(&handle, &tier, &holder)).cloned()
    }

    pub fn get_offer(&self, handle: String, tier: String) -> Option<Offer> {
        self.offers.get(&offer_key(&handle, &tier)).cloned()
    }

    pub fn list_offers(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Offer> {
        self.offers
            .values()
            .skip(from.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn ctx(pred: &str, deposit: u128, ts_ms: u64) {
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(pred.parse().unwrap())
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(ts_ms * 1_000_000);
        testing_env!(b.build());
    }

    #[test]
    fn buy_check_expire_and_sell_out() {
        ctx("admin.testnet", 0, 1_000);
        let mut c = Contract::new("admin.testnet".parse().unwrap());
        c.set_offer("atlas".into(), "view".into(), NearToken::from_near(1), 1, 30, Some("atlas.testnet".parse().unwrap()));
        ctx("buyer.testnet", NearToken::from_near(1).as_yoctonear(), 1_000);
        c.buy_pass("atlas".into(), "view".into(), "0xABC".into());
        assert!(c.has_pass("atlas".into(), "view".into(), "0xabc".into()));
        assert_eq!(c.get_offer("atlas".into(), "view".into()).unwrap().sold, 1);
        ctx("buyer.testnet", 0, 1_000 + 31 * MS_PER_DAY);
        assert!(!c.has_pass("atlas".into(), "view".into(), "0xabc".into()));
    }

    #[test]
    #[should_panic(expected = "sold out")]
    fn sold_out() {
        ctx("admin.testnet", 0, 1_000);
        let mut c = Contract::new("admin.testnet".parse().unwrap());
        c.set_offer("atlas".into(), "copy".into(), NearToken::from_near(1), 1, 30, None);
        ctx("a.testnet", NearToken::from_near(1).as_yoctonear(), 1_000);
        c.buy_pass("atlas".into(), "copy".into(), "h1".into());
        ctx("b.testnet", NearToken::from_near(1).as_yoctonear(), 1_000);
        c.buy_pass("atlas".into(), "copy".into(), "h2".into());
    }

    #[test]
    #[should_panic(expected = "deposit below price")]
    fn underpay() {
        ctx("admin.testnet", 0, 1_000);
        let mut c = Contract::new("admin.testnet".parse().unwrap());
        c.set_offer("atlas".into(), "view".into(), NearToken::from_near(1), 5, 30, None);
        ctx("a.testnet", 1, 1_000);
        c.buy_pass("atlas".into(), "view".into(), "h1".into());
    }
}
