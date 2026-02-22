# Progress Report — Tenor Protocol

**Last updated:** 2026-02-22 20:30 UTC

---

## STATUS OVERVIEW

| Task | Status | Details |
|------|--------|---------|
| Front: TP Price/Gain + SL Price/Loss | DONE | TP Price \| Gain (USD/%) toggle, SL Price \| Loss (USD/%) toggle |
| Front: Remove price slider | DONE | Slider removed from limit order |
| Contract: ReentrancyGuard | DONE | OrderBook (3 fns) + PositionManager (5 fns) |
| Contract: SafeERC20 | DONE | 13 raw ERC20 calls replaced across OrderBook + PositionManager |
| Contract: Access control | DONE | `onlyOwner` on `createMarket()` in ForwardMarket |
| Contract: Oracle staleness | DONE | `maxStaleness` (1h default) + `setMaxStaleness()` + revert on stale price |
| Forge tests | DONE | 40/40 tests pass (ClosePosition, ForwardMarket, OrderBook, Settlement) |
| SDK | DONE | `sdk/` — TenorClient class, types, utils |
| Docs: Architecture | DONE | `docs/ARCHITECTURE.md` — 300 lines, Mermaid |
| Docs: Matching | DONE | `docs/MATCHING.md` — 299 lines, 3 diagrams |
| Docs: TP/SL | DONE | `docs/TPSL.md` — 230 lines, 3 diagrams |
| Docs: Settlement | DONE | `docs/SETTLEMENT.md` — 246 lines |
| Docs: CLI reference | DONE | `docs/CLI.md` — 367 lines |
| Docs: Jury guide | DONE | `docs/JURY_GUIDE.md` — 449 lines |
| Docs: Roadmap | DONE | `docs/ROADMAP.md` — 975 lines |
| Docs: Improvements spec | DONE | `docs/IMPROVEMENTS.md` — 1,268 lines |
| Docs: TP/SL E2E report | DONE | `docs/TPSL_REPORT.md` — on-chain verified |
| Order books filled | DONE | ETH, BTC, AVAX — ~30 orders |
| E2E test | DONE | SL triggered, verified on-chain |

---

## WHAT CHANGED

### Frontend (`TradeForm.tsx`)
- Removed price slider for limit orders
- Redesigned TP/SL section:
  - Row 1: TP Price (input) | Gain (display, toggle USD/%)
  - Row 2: SL Price (input) | Loss (display, toggle USD/%)
  - Estimated gain/loss calculated from effectivePrice, size, collateral

### Contracts (security improvements — ALL VERIFIED, 40/40 tests pass)
- **OrderBook.sol**: `ReentrancyGuard` on `placeLimitOrder`, `placeMarketOrder`, `cancelOrder` + `SafeERC20` on all 7 raw ERC20 calls
- **PositionManager.sol**: `ReentrancyGuard` on `closePosition`, `settlePosition`, `liquidate`, `addCollateral`, `removeCollateral` + `SafeERC20` on all 6 raw ERC20 calls
- **ForwardMarket.sol**: `onlyOwner` on `createMarket()`
- **ChainlinkOracle.sol**: `maxStaleness` (1h default), `setMaxStaleness()` admin fn, staleness revert in `getPrice()`

### Branches
- `docs/full-release` — all docs + SDK + frontend + contract improvements (pushed)

---

## WHAT'S LEFT
- [ ] Redeploy contracts if you want the security improvements live on-chain (v5)
- [ ] Review the TP/SL UI at localhost:5174

---

## KEY FILES
- Frontend: `frontend/src/components/trading/TradeForm.tsx`
- Contracts: `contracts/src/core/OrderBook.sol`, `PositionManager.sol`, `ForwardMarket.sol`
- Oracle: `contracts/src/oracle/ChainlinkOracle.sol`
- All docs: `docs/` folder
- SDK: `sdk/` folder
