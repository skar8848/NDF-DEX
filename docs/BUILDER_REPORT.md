# Builder Experience Report — Tenor Protocol

**Date:** 2026-02-22
**Builder:** Automated agent (Claude) building a forward/futures DEX on Avalanche Fuji

---

## What We Built

Tenor Protocol is a decentralized forward exchange with:
- **On-chain CLOB** (Central Limit Order Book) with price-time priority matching
- **Cash-settled forwards** (NDF-style) — PnL settled in USDC
- **Physically-delivered forwards** (classic) — long receives underlying token (WETH) at expiry
- **TP/SL orders** — stored on-chain, triggered by keeper bot
- **Chainlink oracle integration** — live price feeds for ETH, BTC, AVAX
- **Full CLI** — trade, manage positions, settle, view order books
- **React frontend** with real-time order book and position management

---

## Stack Assessment

### What Works Well

| Component | Rating | Notes |
|-----------|--------|-------|
| **Foundry/Forge** | Excellent | Compilation in 3-4s, tests in <20ms for 46 tests. `forge script` for deployment is clean. `cast` CLI for on-chain interaction is invaluable. |
| **OpenZeppelin** | Excellent | ReentrancyGuard, SafeERC20, IERC20 — drop-in, zero friction. |
| **Solidity structs** | Good | Adding `SettlementType` and `underlyingToken` to `MarketInfo` was straightforward. Backward-compatible with cash markets. |
| **Viem (TypeScript)** | Good | Type-safe, good BigInt support. ABI-typed contract reads/writes are clean. |
| **Chainlink on Fuji** | Mixed | Price feeds work but update infrequently. Had to increase `maxStaleness` to 24h for testnet. Not ideal for live testing. |
| **Avalanche Fuji RPC** | Poor | `publicnode.com` returns null responses frequently. `api.avax-test.network` is better but rate-limits after ~10 rapid txs. Had to add 3-5s delays between operations. |

### What's Slow

1. **RPC Reliability** — The biggest friction point. Both public Fuji RPCs are unreliable:
   - `publicnode.com`: Returns null responses ~20% of the time
   - `api.avax-test.network`: Rate-limits (Cloudflare 1015) after rapid txs, blocks for ~30s
   - **Impact**: Order book filling that should take 2 min takes 10+ min due to retries and sleeps

2. **Chainlink Feed Staleness** — Fuji feeds update every ~1h (sometimes longer). Our 1h staleness check was too aggressive. In production on mainnet this wouldn't be an issue, but for testnet development it forced us to either:
   - Set very permissive staleness (24h) — defeats the safety purpose
   - Use MockOracle for development — loses integration testing value

3. **Stack Too Deep** — Hit this in the deploy script when creating physical markets. Had to refactor into helper functions. The Solidity compiler limitation is well-known but still annoying for complex deploy scripts.

4. **ABI Management** — Manually maintaining ABI arrays in TypeScript is error-prone. When we added `settlementType` and `underlyingToken` to `MarketInfo`, we had to update the ABI in `contracts.ts` manually. Forge generates full ABIs in `out/`, but integrating them into the keeper/frontend is manual work.

### What's Missing

1. **No event indexing** — We rely on `getAllMarkets()` and `getUserPositions()` view functions, which iterate over all data. At scale, this would be gas-prohibitive for read calls and slow. Need a subgraph or event-based indexer.

2. **No partial fill notifications** — When a market order partially fills, there's no easy way for the user to know how much filled without checking the position after the fact.

3. **No cross-margin** — Each position has isolated collateral. Hyperliquid's unified account model would reduce capital requirements.

4. **No funding rate** — Classic perpetual DEXes use funding rates to keep prices anchored to spot. Our forwards expire instead, but for longer-dated contracts a carry/funding mechanism would help.

5. **No oracle for physical delivery pricing** — Physical delivery uses the same Chainlink oracle price for both settlement and delivery amount calculation. In a real system, the delivery price should come from a separate feed or be determined by market dynamics.

---

## Physical Delivery — Implementation Notes

### Design Choices

We chose a simple model:
- **Long positions** receive the underlying ERC20 token (`WETH`) at settlement
- **Short positions** receive USDC (as in cash settlement)
- The `PositionManager` holds both USDC (protocol pool) and WETH (delivery pool)

This is simpler than true bilateral delivery (where the short would need to deposit the underlying), but works well for a testnet demo:

```
CASH settlement:     LONG gets USDC +/- PnL
PHYSICAL settlement: LONG gets underlying tokens + excess USDC collateral
                     SHORT gets USDC +/- PnL (same as cash)
```

### Test Results

Successfully tested on Fuji:
- Market #4 (ETH/USDC Physical, 10min expiry) — created, traded, expired, settled
- LONG position #3: Received **3 WETH** (physical delivery!) + $1,462.50 excess USDC
- SHORT position #4: Received $7,305.53 USDC (cash only, no WETH)
- All 46 Forge tests pass (40 original + 6 physical delivery tests)

### What Went Wrong

1. **Forgot to update keeper .env** — The keeper's `.env` had old v4 contract addresses, overriding the updated defaults in `config.ts`. Caused 15 min of debugging.

2. **Oracle staleness on Fuji** — Chainlink feeds on Fuji testnet update infrequently. Our 1h staleness check (a security feature we added) caused `getHealthFactor` to revert. Fixed by setting `maxStaleness` to 24h via `setMaxStaleness()`.

3. **Trade command picked wrong market** — When multiple markets share the same base asset (e.g., 3 ETH markets: cash, physical 10min, physical 1h), `trade long ETH` always picked market #1. Fixed by adding `--mid <marketId>` flag.

---

## Feature Testing Matrix

| Feature | Tested | Method | Result |
|---------|--------|--------|--------|
| Limit orders | Yes | CLI `trade` | Works |
| Market orders | Yes | CLI `trade --market` | Works |
| Order matching | Yes | Self-match (same wallet) | Works |
| Position opening | Yes | Matched orders create positions | Works |
| Close position (trader) | Yes | CLI `close` | Works |
| Partial close | Yes | CLI `close --percent 50` | Works |
| TP/SL set | Yes | CLI `tpsl --tp --sl` | Works |
| TP/SL keeper trigger | Yes | Keeper bot monitors positions | Works |
| Cash settlement | Yes | Market expire + settleMarket + settlePosition | Works |
| Physical delivery | Yes | Long receives WETH, short receives USDC | Works |
| Liquidation | Yes | Forge test + on-chain | Works |
| Add/remove collateral | Yes | Forge test | Works |
| Order cancellation | Yes | Forge test | Works |
| Oracle staleness check | Yes | Chainlink feed validation | Works |
| ReentrancyGuard | Yes | Forge test (46/46 pass) | Works |
| SafeERC20 | Yes | All ERC20 calls use safe wrappers | Works |
| Access control | Yes | createMarket restricted to owner | Works |
| Order book view | Yes | CLI `book <marketId>` | Works |
| Balance check | Yes | CLI `balance` (USDC + WETH + AVAX) | Works |

---

## Versions Deployed

| Version | Key Changes | Status |
|---------|-------------|--------|
| v1-v3 | Initial contracts, mock oracle | Deprecated |
| v4 | Chainlink oracle, TP/SL, closePosition | Deprecated |
| v5 | ReentrancyGuard, SafeERC20, access control, staleness check | Deprecated |
| v6 | Physical delivery forwards, 5 markets (3 cash + 2 physical) | **Active** |

---

## Recommendations for Production

1. **Use a dedicated RPC** — Alchemy, Infura, or QuickNode. Public RPCs are unacceptable for any serious use.
2. **Deploy a subgraph** — For efficient position/order queries at scale.
3. **Implement cross-margin** — Unified account model like Hyperliquid.
4. **Add insurance fund** — For when the protocol pool can't cover payouts.
5. **Implement funding rates** — For longer-dated contracts.
6. **Use CREATE2 for deterministic deploys** — Makes address management easier.
7. **ABI generation pipeline** — Automatically generate TypeScript types from Forge output.
8. **Multi-oracle system** — Chainlink + Pyth for redundancy and freshness.
