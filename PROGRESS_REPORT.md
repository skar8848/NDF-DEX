# Progress Report — Tenor Protocol

**Last updated:** 2026-02-22 21:30 UTC

---

## STATUS OVERVIEW

| Task | Status | Details |
|------|--------|---------|
| **Physical delivery forwards** | DONE | `SettlementType.PHYSICAL` — long receives WETH at expiry |
| **E2E physical delivery test** | DONE | Market #4 expired, settled — LONG got 3 WETH, SHORT got USDC |
| **v6 deployment** | DONE | 5 markets: 3 cash + 2 physical (10min + 1h) |
| **CLI: settle, settle-market, book** | DONE | New commands for settlement + order book viewing |
| **Builder experience report** | DONE | `docs/BUILDER_REPORT.md` — stack assessment, what works, what's slow |
| Contract: ReentrancyGuard | DONE | OrderBook (3 fns) + PositionManager (5 fns) |
| Contract: SafeERC20 | DONE | 13 raw ERC20 calls replaced |
| Contract: Access control | DONE | `onlyOwner` on `createMarket()` |
| Contract: Oracle staleness | DONE | 24h for testnet (1h default) |
| Forge tests | DONE | **46/46** tests pass (40 original + 6 physical delivery) |
| Front: TP Price/Gain + SL Price/Loss | DONE | USD/% toggle |
| SDK | DONE | `sdk/` |
| All docs | DONE | Architecture, Matching, TP/SL, Settlement, CLI, Jury, Roadmap, Improvements |
| Order books filled | IN PROGRESS | Agent filling ETH, BTC, AVAX books |

---

## V6 DEPLOYMENT — Contract Addresses

| Contract | Address |
|----------|---------|
| MockUSDC | `0x2395F7aB842a3B91634214E5d1D841c7DD0D30D9` |
| MockWETH | `0x0eF47d0c930BF6D4ABbE165CeB8823139e1B8E97` |
| ChainlinkOracle | `0x2413750CA5c7a48048b1295C2397003057EAf2ab` |
| ForwardMarket | `0xf513AB1d36D179E9910070b6049249CD397Cd572` |
| OrderBook | `0xCe34E18C1Cd5A3E04B997592dBc3272A58beEcAC` |
| PositionManager | `0xe6a05bA11CD37A46E78eBE2f638b36dCA1c1ED17` |

### Markets

| ID | Pair | Type | Expiry |
|----|------|------|--------|
| 1 | ETH/USDC | CASH | 30 days |
| 2 | BTC/USDC | CASH | 30 days |
| 3 | AVAX/USDC | CASH | 7 days |
| 4 | ETH/USDC | PHYSICAL | **SETTLED** (10min test) |
| 5 | ETH/USDC | PHYSICAL | ~1 hour |

---

## WHAT CHANGED (this session)

### Contracts — Physical Delivery
- Added `SettlementType` enum (CASH, PHYSICAL) to `OrderLib`
- Added `underlyingToken` field to `MarketInfo` struct
- Added `createPhysicalMarket()` to `ForwardMarket`
- Added `_settlePhysical()` to `PositionManager` — long gets underlying token
- 6 new tests in `PhysicalDelivery.t.sol`

### CLI — New Commands
- `settle-market <id>` — settle an expired market
- `settle <positionId>` — settle position with before/after balance tracking
- `book <marketId>` — view order book (bids + asks)
- `balance` — now shows USDC + WETH + AVAX
- `trade --mid <marketId>` — target specific market
- `markets` — shows settlement type (CASH/PHYSICAL) and time remaining

### Builder Experience Report
- `docs/BUILDER_REPORT.md` — comprehensive assessment of the stack
- What works (Foundry, OpenZeppelin, Viem), what's slow (RPCs, Chainlink on testnet)
- Physical delivery design choices and test results

---

## WHAT'S LEFT
- [ ] Order book filling (agent running)
- [ ] Review at localhost:5174

---

## KEY FILES
- Physical delivery: `contracts/src/core/PositionManager.sol` (`_settlePhysical`)
- Structs: `contracts/src/libraries/OrderLib.sol` (SettlementType)
- Deploy: `contracts/script/Deploy.s.sol` (v6 with physical markets)
- CLI: `keeper/src/cli.ts` (settle, book, settle-market)
- Builder report: `docs/BUILDER_REPORT.md`
- Tests: `contracts/test/PhysicalDelivery.t.sol` (6 tests)
