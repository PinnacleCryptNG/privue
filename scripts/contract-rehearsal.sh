#!/usr/bin/env bash
# Rehearses the v1 -> v2 passes upgrade on a fresh NEAR testnet account, then exercises every v2 method.
# Usage: scripts/contract-rehearsal.sh   (needs near-cli-rs and cargo-near; uses the testnet faucet)
set -euo pipefail
cd "$(dirname "$0")/../contracts/passes"
NET="network-config testnet"
ACCT="privue-rehearsal-$(date +%s).testnet"
BUYER="${BUYER:-$ACCT}"
call() { near contract call-function as-transaction "$ACCT" "$1" json-args "$2" prepaid-gas '100.0 Tgas' attached-deposit "$3" sign-as "${4:-$ACCT}" $NET sign-with-legacy-keychain send 2>&1 | sed 's/\x1b\[[0-9;]*m//g'; }
view() { near contract call-function as-read-only "$ACCT" "$1" json-args "$2" $NET now 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | sed '/Here is your console command/,$d' | grep -v '^Function execution\|^$\|Logs:\|No logs'; }
expect_fail() { local out; out=$(call "$@" || true); if grep -q "Smart contract panicked" <<<"$out"; then echo "  ok (rejected)"; else echo "  FAIL: expected rejection"; exit 1; fi; }

cargo near build non-reproducible-wasm >/dev/null 2>&1
near account create-account sponsor-by-faucet-service "$ACCT" autogenerate-new-keypair save-to-legacy-keychain $NET create >/dev/null 2>&1
sleep 3
echo "== v1 on $ACCT"
near contract deploy "$ACCT" use-file tests/fixtures/passes_v1.wasm with-init-call new json-args "{\"admin\":\"$ACCT\"}" prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' $NET sign-with-legacy-keychain send >/dev/null 2>&1
call set_offer '{"handle":"atlas","tier":"view","price":"100000000000000000000000","supply":5,"period_days":30}' '0 NEAR' >/dev/null
call buy_pass '{"handle":"atlas","tier":"view","holder":"guest-1"}' '0.1 NEAR' >/dev/null
echo "== upgrade to v2 + migrate"
near contract deploy "$ACCT" use-file target/near/passes.wasm with-init-call migrate json-args "{\"operator\":\"$ACCT\"}" prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' $NET sign-with-legacy-keychain send >/dev/null 2>&1
echo "-- v1 pass survived:"; view get_pass '{"handle":"atlas","tier":"view","holder":"guest-1"}' | grep -q '"guest-1"' && echo "  ok"
echo "-- buy without storage is rejected:"; expect_fail buy_pass '{"handle":"atlas","tier":"view","holder":"guest-2"}' '0.1 NEAR'
echo "-- buy with storage:"; call buy_pass '{"handle":"atlas","tier":"view","holder":"guest-2"}' '0.12 NEAR' >/dev/null && view has_pass '{"handle":"atlas","tier":"view","holder":"guest-2"}'
echo "-- delayed tier:"; call set_offer '{"handle":"atlas","tier":"delayed","price":"50000000000000000000000","supply":5,"period_days":30}' '0.02 NEAR' >/dev/null && view get_offer '{"handle":"atlas","tier":"delayed"}' | grep -q delayed && echo "  ok"
echo "-- transfer:"; call transfer_pass '{"handle":"atlas","tier":"view","holder":"guest-1","to":"alice.testnet"}' '0.02 NEAR' >/dev/null && view has_pass '{"handle":"atlas","tier":"view","holder":"alice.testnet"}'
echo "-- commit + monotonic:"; call commit "{\"handle\":\"atlas\",\"count\":3,\"head\":\"$(printf 'ab%.0s' {1..32})\"}" '0.01 NEAR' >/dev/null; expect_fail commit "{\"handle\":\"atlas\",\"count\":2,\"head\":\"$(printf 'cd%.0s' {1..32})\"}" '0.01 NEAR'
echo "-- commit log:"; view commit_log '{"from":0}' | grep -c '"count"'
echo "-- pass log:"; view pass_log '{"from":0}' | tr -d ' \n' | grep -o '"kind":"[a-z]*"' | tr '\n' ' '; echo
echo "-- withdraw fees:"; call withdraw_fees '{}' '0 NEAR' | grep -o '"[0-9]*"' | tail -1
echo "-- pause blocks buys:"; call set_paused '{"paused":true}' '0 NEAR' >/dev/null; expect_fail buy_pass '{"handle":"atlas","tier":"view","holder":"guest-3"}' '0.12 NEAR'
call set_paused '{"paused":false}' '0 NEAR' >/dev/null
echo "-- info:"; view info '{}'
echo "REHEARSAL OK on https://testnet.nearblocks.io/address/$ACCT"
