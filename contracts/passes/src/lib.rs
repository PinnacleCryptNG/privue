use near_sdk::borsh::BorshDeserialize;
use near_sdk::store::{IterableMap, LookupMap, Vector};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise};

const FEE_BPS: u128 = 1_000;
const MS_PER_DAY: u64 = 86_400_000;
const TIERS: [&str; 3] = ["view", "copy", "delayed"];

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

/// Append-only log of pass changes, so an indexer can follow the contract by sequence number.
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct PassEvent {
    pub seq: u64,
    pub kind: String,
    pub handle: String,
    pub tier: String,
    pub holder: String,
    pub from: Option<String>,
    pub expires_at_ms: u64,
    pub at_ms: u64,
}

/// Head of a trader's fill hash chain: sha256 over every fill in order. Counts only grow.
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Commitment {
    pub handle: String,
    pub count: u64,
    pub head: String,
    pub at_ms: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    admin: AccountId,
    operator: AccountId,
    paused: bool,
    fees: NearToken,
    offers: IterableMap<String, Offer>,
    passes: LookupMap<String, Pass>,
    log: Vector<PassEvent>,
    commitments: LookupMap<String, Commitment>,
    commit_log: Vector<Commitment>,
}

#[derive(BorshDeserialize)]
#[borsh(crate = "near_sdk::borsh")]
struct ContractV1 {
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

fn is_hex64(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
}

#[near]
impl Contract {
    #[init]
    pub fn new(admin: AccountId, operator: Option<AccountId>) -> Self {
        Self {
            operator: operator.unwrap_or_else(|| admin.clone()),
            admin,
            paused: false,
            fees: NearToken::from_yoctonear(0),
            offers: IterableMap::new(b"o"),
            passes: LookupMap::new(b"p"),
            log: Vector::new(b"l"),
            commitments: LookupMap::new(b"c"),
            commit_log: Vector::new(b"k"),
        }
    }

    /// Upgrades v1 state in place: keeps every offer and pass, adds the new fields.
    #[private]
    #[init(ignore_state)]
    pub fn migrate(operator: AccountId) -> Self {
        let old: ContractV1 = env::state_read().unwrap_or_else(|| env::panic_str("no v1 state"));
        Self {
            admin: old.admin,
            operator,
            paused: false,
            fees: NearToken::from_yoctonear(0),
            offers: old.offers,
            passes: old.passes,
            log: Vector::new(b"l"),
            commitments: LookupMap::new(b"c"),
            commit_log: Vector::new(b"k"),
        }
    }

    fn assert_live(&self) {
        require!(!self.paused, "contract is paused");
    }

    fn assert_admin(&self) {
        require!(env::predecessor_account_id() == self.admin, "admin only");
    }

    fn is_staff(&self, who: &AccountId) -> bool {
        *who == self.admin || *who == self.operator
    }

    /// Charges the caller for storage written since `before`, on top of `spent`, and refunds the rest.
    fn settle_storage(&self, before: u64, spent: u128) {
        let after = env::storage_usage();
        let cost = after.saturating_sub(before) as u128 * env::storage_byte_cost().as_yoctonear();
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit >= spent + cost, format!("attach {} yoctoNEAR (price {} + storage {})", spent + cost, spent, cost));
        let change = deposit - spent - cost;
        if change > 0 {
            Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(change)).detach();
        }
    }

    fn push_event(&mut self, kind: &str, pass: &Pass, from: Option<String>) {
        let seq = self.log.len() as u64;
        let ev = PassEvent {
            seq,
            kind: kind.into(),
            handle: pass.handle.clone(),
            tier: pass.tier.clone(),
            holder: pass.holder.clone(),
            from,
            expires_at_ms: pass.expires_at_ms,
            at_ms: env::block_timestamp_ms(),
        };
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"privue\",\"version\":\"2\",\"event\":\"pass_{}\",\"data\":{{\"seq\":{},\"handle\":\"{}\",\"tier\":\"{}\",\"expires_at_ms\":{}}}}}",
            kind, seq, ev.handle, ev.tier, ev.expires_at_ms
        ));
        self.log.push(ev);
    }

    #[payable]
    pub fn set_offer(&mut self, handle: String, tier: String, price: NearToken, supply: u32, period_days: u32, owner: Option<AccountId>) {
        self.assert_live();
        let before = env::storage_usage();
        require!(TIERS.contains(&tier.as_str()), "tier must be view, copy or delayed");
        require!(!handle.is_empty() && handle.len() <= 32, "bad handle");
        require!(supply > 0 && supply <= 10_000, "supply must be 1..10000");
        require!(period_days > 0 && period_days <= 365, "period must be 1..365 days");
        let caller = env::predecessor_account_id();
        let key = offer_key(&handle, &tier);
        let (sold, current_owner) = match self.offers.get(&key) {
            Some(existing) => {
                require!(caller == existing.owner || self.is_staff(&caller), "not the offer owner");
                require!(supply >= existing.sold, "supply below passes sold");
                (existing.sold, Some(existing.owner.clone()))
            }
            None => (0, None),
        };
        let owner = match owner {
            Some(o) => {
                require!(self.is_staff(&caller), "only Privue staff can set another owner");
                o
            }
            None => current_owner.unwrap_or(caller),
        };
        self.offers.insert(key, Offer { handle, owner, tier, price, supply, sold, period_days });
        self.offers.flush();
        self.settle_storage(before, 0);
    }

    #[payable]
    pub fn buy_pass(&mut self, handle: String, tier: String, holder: String) -> Pass {
        self.assert_live();
        let before = env::storage_usage();
        require!(!holder.is_empty() && holder.len() <= 128, "bad holder id");
        let key = offer_key(&handle, &tier);
        let mut offer = self.offers.get(&key).cloned().unwrap_or_else(|| env::panic_str("no such offer"));
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
        let fee = price * FEE_BPS / 10_000;
        let owner = offer.owner.clone();
        self.offers.insert(key, offer);
        self.push_event(if renewing { "renewed" } else { "bought" }, &pass, None);
        self.fees = NearToken::from_yoctonear(self.fees.as_yoctonear() + fee);
        self.offers.flush();
        self.passes.flush();
        self.log.flush();
        self.settle_storage(before, price);
        if price - fee > 0 {
            Promise::new(owner).transfer(NearToken::from_yoctonear(price - fee)).detach();
        }
        pass
    }

    /// Moves an active pass to a new holder. Allowed for the holder, the account that paid, or Privue staff.
    #[payable]
    pub fn transfer_pass(&mut self, handle: String, tier: String, holder: String, to: String) -> Pass {
        self.assert_live();
        let before = env::storage_usage();
        require!(!to.is_empty() && to.len() <= 128, "bad holder id");
        let caller = env::predecessor_account_id();
        let from_key = pass_key(&handle, &tier, &holder);
        let mut pass = self.passes.get(&from_key).cloned().unwrap_or_else(|| env::panic_str("no such pass"));
        let now = env::block_timestamp_ms();
        require!(pass.expires_at_ms > now, "pass has expired");
        require!(caller.as_str() == pass.holder || caller == pass.buyer || self.is_staff(&caller), "not allowed to move this pass");
        let to_key = pass_key(&handle, &tier, &to);
        require!(from_key != to_key, "already held by that account");
        require!(self.passes.get(&to_key).is_none_or(|p| p.expires_at_ms <= now), "recipient already holds this pass");
        self.passes.remove(&from_key);
        let from = pass.holder.clone();
        pass.holder = to.to_lowercase();
        self.passes.insert(to_key, pass.clone());
        self.push_event("transferred", &pass, Some(from));
        self.passes.flush();
        self.log.flush();
        self.settle_storage(before, 0);
        pass
    }

    /// Anchors the head of a trader's fill hash chain. Counts can only grow, so history can't be rewritten silently.
    #[payable]
    pub fn commit(&mut self, handle: String, count: u64, head: String) -> Commitment {
        self.assert_live();
        let before = env::storage_usage();
        require!(self.is_staff(&env::predecessor_account_id()), "Privue staff only");
        require!(is_hex64(&head), "head must be 64 hex chars");
        if let Some(prev) = self.commitments.get(&handle) {
            require!(count > prev.count, "commitment count must grow");
        }
        let c = Commitment { handle: handle.clone(), count, head: head.to_lowercase(), at_ms: env::block_timestamp_ms() };
        self.commitments.insert(handle, c.clone());
        self.commit_log.push(c.clone());
        self.commitments.flush();
        self.commit_log.flush();
        env::log_str(&format!(
            "EVENT_JSON:{{\"standard\":\"privue\",\"version\":\"2\",\"event\":\"commit\",\"data\":{{\"handle\":\"{}\",\"count\":{},\"head\":\"{}\"}}}}",
            c.handle, c.count, c.head
        ));
        self.settle_storage(before, 0);
        c
    }

    pub fn set_paused(&mut self, paused: bool) {
        self.assert_admin();
        self.paused = paused;
    }

    pub fn set_operator(&mut self, operator: AccountId) {
        self.assert_admin();
        self.operator = operator;
    }

    /// Sends the accrued 10% platform fee to `to` (default: admin).
    pub fn withdraw_fees(&mut self, to: Option<AccountId>) -> NearToken {
        self.assert_admin();
        let amount = self.fees;
        require!(amount.as_yoctonear() > 0, "no fees to withdraw");
        self.fees = NearToken::from_yoctonear(0);
        Promise::new(to.unwrap_or_else(|| self.admin.clone())).transfer(amount).detach();
        amount
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

    pub fn pass_log(&self, from: u64, limit: Option<u32>) -> Vec<PassEvent> {
        let end = (from + limit.unwrap_or(50).min(100) as u64).min(self.log.len() as u64);
        (from..end).filter_map(|i| self.log.get(i as u32).cloned()).collect()
    }

    pub fn pass_log_len(&self) -> u64 {
        self.log.len() as u64
    }

    /// Every checkpoint ever anchored, in order, so a verifier can check old heads against the current chain.
    pub fn commit_log(&self, from: u64, limit: Option<u32>) -> Vec<Commitment> {
        let end = (from + limit.unwrap_or(50).min(100) as u64).min(self.commit_log.len() as u64);
        (from..end).filter_map(|i| self.commit_log.get(i as u32).cloned()).collect()
    }

    pub fn get_commitment(&self, handle: String) -> Option<Commitment> {
        self.commitments.get(&handle).cloned()
    }

    pub fn info(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({
            "admin": self.admin,
            "operator": self.operator,
            "paused": self.paused,
            "fees": self.fees,
            "fee_bps": FEE_BPS,
            "passes_logged": self.log.len(),
            "commits_logged": self.commit_log.len(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    const ONE: u128 = 1_000_000_000_000_000_000_000_000;
    const STORAGE: u128 = ONE / 10;

    fn ctx(pred: &str, deposit: u128, ts_ms: u64) {
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(pred.parse().unwrap())
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(ts_ms * 1_000_000);
        testing_env!(b.build());
    }

    fn setup(supply: u32) -> Contract {
        ctx("admin.testnet", STORAGE, 1_000);
        let mut c = Contract::new("admin.testnet".parse().unwrap(), Some("ops.testnet".parse().unwrap()));
        c.set_offer("atlas".into(), "view".into(), NearToken::from_near(1), supply, 30, Some("atlas.testnet".parse().unwrap()));
        c
    }

    #[test]
    fn buy_check_expire_and_log() {
        let mut c = setup(1);
        ctx("buyer.testnet", ONE + STORAGE, 1_000);
        c.buy_pass("atlas".into(), "view".into(), "0xABC".into());
        assert!(c.has_pass("atlas".into(), "view".into(), "0xabc".into()));
        assert_eq!(c.get_offer("atlas".into(), "view".into()).unwrap().sold, 1);
        assert_eq!(c.pass_log_len(), 1);
        assert_eq!(c.pass_log(0, None)[0].kind, "bought");
        assert_eq!(c.fees.as_yoctonear(), ONE / 10);
        ctx("buyer.testnet", 0, 1_000 + 31 * MS_PER_DAY);
        assert!(!c.has_pass("atlas".into(), "view".into(), "0xabc".into()));
    }

    #[test]
    #[should_panic(expected = "sold out")]
    fn sold_out() {
        let mut c = setup(1);
        ctx("a.testnet", ONE + STORAGE, 1_000);
        c.buy_pass("atlas".into(), "view".into(), "h1".into());
        ctx("b.testnet", ONE + STORAGE, 1_000);
        c.buy_pass("atlas".into(), "view".into(), "h2".into());
    }

    #[test]
    #[should_panic(expected = "storage")]
    fn price_without_storage_is_rejected() {
        let mut c = setup(5);
        ctx("a.testnet", ONE, 1_000);
        c.buy_pass("atlas".into(), "view".into(), "h1".into());
    }

    #[test]
    #[should_panic(expected = "storage")]
    fn offers_need_storage() {
        ctx("admin.testnet", 0, 1_000);
        let mut c = Contract::new("admin.testnet".parse().unwrap(), None);
        c.set_offer("atlas".into(), "view".into(), NearToken::from_near(1), 5, 30, None);
    }

    #[test]
    fn delayed_tier_and_renewal() {
        let mut c = setup(5);
        ctx("ops.testnet", STORAGE, 1_000);
        c.set_offer("atlas".into(), "delayed".into(), NearToken::from_near(1), 5, 10, Some("atlas.testnet".parse().unwrap()));
        ctx("a.testnet", ONE + STORAGE, 1_000);
        let p1 = c.buy_pass("atlas".into(), "delayed".into(), "h1".into());
        ctx("a.testnet", ONE + STORAGE, 2_000);
        let p2 = c.buy_pass("atlas".into(), "delayed".into(), "h1".into());
        assert_eq!(p2.expires_at_ms, p1.expires_at_ms + 10 * MS_PER_DAY);
        assert_eq!(c.get_offer("atlas".into(), "delayed".into()).unwrap().sold, 1);
        assert_eq!(c.pass_log(0, None).iter().map(|e| e.kind.clone()).collect::<Vec<_>>(), vec!["bought", "renewed"]);
    }

    #[test]
    #[should_panic(expected = "tier must be")]
    fn unknown_tier() {
        ctx("admin.testnet", STORAGE, 1_000);
        let mut c = Contract::new("admin.testnet".parse().unwrap(), None);
        c.set_offer("atlas".into(), "vip".into(), NearToken::from_near(1), 5, 30, None);
    }

    #[test]
    fn transfer_by_buyer_moves_pass() {
        let mut c = setup(5);
        ctx("ops.testnet", ONE + STORAGE, 1_000);
        c.buy_pass("atlas".into(), "view".into(), "guest-1".into());
        ctx("ops.testnet", STORAGE, 1_500);
        c.transfer_pass("atlas".into(), "view".into(), "guest-1".into(), "alice.testnet".into());
        assert!(!c.has_pass("atlas".into(), "view".into(), "guest-1".into()));
        assert!(c.has_pass("atlas".into(), "view".into(), "alice.testnet".into()));
        let ev = &c.pass_log(1, None)[0];
        assert_eq!((ev.kind.as_str(), ev.from.as_deref()), ("transferred", Some("guest-1")));
        ctx("alice.testnet", STORAGE, 1_600);
        c.transfer_pass("atlas".into(), "view".into(), "alice.testnet".into(), "bob.testnet".into());
        assert!(c.has_pass("atlas".into(), "view".into(), "bob.testnet".into()));
    }

    #[test]
    #[should_panic(expected = "not allowed")]
    fn stranger_cannot_transfer() {
        let mut c = setup(5);
        ctx("a.testnet", ONE + STORAGE, 1_000);
        c.buy_pass("atlas".into(), "view".into(), "h1".into());
        ctx("mallory.testnet", STORAGE, 1_000);
        c.transfer_pass("atlas".into(), "view".into(), "h1".into(), "mallory.testnet".into());
    }

    #[test]
    fn commitments_only_grow() {
        let mut c = setup(5);
        let head = "ab".repeat(32);
        ctx("ops.testnet", STORAGE, 1_000);
        c.commit("atlas".into(), 3, head.clone());
        assert_eq!(c.get_commitment("atlas".into()).unwrap().count, 3);
        assert_eq!(c.commit_log(0, None).len(), 1);
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let mut c2 = setup(5);
            ctx("ops.testnet", STORAGE, 1_000);
            c2.commit("atlas".into(), 3, "ab".repeat(32));
            c2.commit("atlas".into(), 2, "cd".repeat(32));
        }));
        assert!(r.is_err());
    }

    #[test]
    #[should_panic(expected = "staff only")]
    fn strangers_cannot_commit() {
        let mut c = setup(5);
        ctx("mallory.testnet", STORAGE, 1_000);
        c.commit("atlas".into(), 1, "ab".repeat(32));
    }

    #[test]
    fn pause_and_withdraw() {
        let mut c = setup(5);
        ctx("a.testnet", ONE + STORAGE, 1_000);
        c.buy_pass("atlas".into(), "view".into(), "h1".into());
        ctx("admin.testnet", 0, 1_000);
        assert_eq!(c.withdraw_fees(None).as_yoctonear(), ONE / 10);
        c.set_paused(true);
        ctx("b.testnet", ONE + STORAGE, 1_000);
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.buy_pass("atlas".into(), "view".into(), "h2".into());
        }));
        assert!(r.is_err());
    }

    #[test]
    #[should_panic(expected = "admin only")]
    fn operator_cannot_pause() {
        let mut c = setup(5);
        ctx("ops.testnet", 0, 1_000);
        c.set_paused(true);
    }
}
