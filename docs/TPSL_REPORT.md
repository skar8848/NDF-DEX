# TP/SL Position Evolution Report

**Date:** 2026-02-22
**Network:** Avalanche Fuji (43113)
**Oracle:** Chainlink ETH/USD
**Keeper:** `0x38ed32a4cec85363DfC9414Eb6c950b4141cF6cD`

---

## Executive Summary

End-to-end test of the Tenor Protocol TP/SL system. Placed orders via CLI, set tight TP/SL levels, ran the keeper bot, and verified all state transitions on-chain.

**Result: Stop Loss triggered and executed automatically within 1 keeper poll cycle (~5s).**

---

## Timeline of Events

### 1. Initial State

| Position | Side | Entry Price | Size | Collateral | TP/SL |
|----------|------|-------------|------|------------|-------|
| #1 | LONG | $2,600.00 | 5 | ~$32,500 | SL set at $1,950 |

Oracle ETH price at test start: **$1,949.89**

Position #1 was deeply underwater (LONG at $2,600, market at $1,949) with a tight SL.

### 2. New Market Order — Position #3 Created

**Command:** `npx tsx src/cli.ts trade long ETH 5 --market`

The market order filled against the best ask in the order book:

| Field | Value |
|-------|-------|
| Position ID | #3 |
| Side | LONG |
| Entry Price | $1,955.00 |
| Size | 5 contracts |
| Collateral | $24,348.13 |
| Fill Block | 52068079 |

A counterparty SHORT position (#4) was automatically created at the same price.

### 3. TP/SL Configuration — Position #3

**Command:** `npx tsx src/cli.ts tpsl 3 --tp 1985 --sl 1935`

| Parameter | Value | Distance from Entry | Potential PnL (5 contracts) |
|-----------|-------|--------------------|-----------------------------|
| Take Profit | $1,985.00 | +$30.00 (+1.53%) | **+$150.00** |
| Stop Loss | $1,935.00 | -$20.00 (-1.02%) | **-$100.00** |
| Risk/Reward | | | 1:1.5 |

**On-chain verification (PositionManager.getTPSL(3)):**
```
takeProfitPrice: 198500000000 (0x2e3785a100) → $1,985.00 ✓
stopLossPrice:   193500000000 (0x2d0d7faf00) → $1,935.00 ✓
```

### 4. Keeper Bot Execution

**Command:** `npx tsx src/cli.ts keeper` (ran for 30 seconds)

```
[KEEPER] Keeper Bot Starting...
[MONITOR] Fetched 3 open positions
[TPSL] SL triggered for position #1 (LONG ETH) @ $1,949.8851
✅ [TPSL] Position #1 closed (SL) — tx: 0xc2f156cb...ca2286
[LOOP] Closed 1 positions via TP/SL
[MONITOR] Fetched 2 open positions
[MONITOR] Fetched 2 open positions  (no more triggers)
```

**Keeper behavior:**
1. First poll: detected 3 open positions
2. Checked TP/SL for each position against oracle price ($1,949.89)
3. Position #1: LONG at $2,600, SL at ~$1,950 → price ($1,949.89) <= SL → **TRIGGERED**
4. Position #3: LONG at $1,955, SL at $1,935, TP at $1,985 → price between SL and TP → no action
5. Subsequent polls: 2 remaining positions, no triggers

### 5. SL Close — On-Chain Analysis

**Transaction:** [`0xc2f156cb05572baa4b24b7bda51e0940b34f6873cc51258e03360a1f54ca2286`](https://testnet.snowtrace.io/tx/0xc2f156cb05572baa4b24b7bda51e0940b34f6873cc51258e03360a1f54ca2286)

| Field | Value |
|-------|-------|
| Block | 52,068,116 |
| From | Keeper (`0x38ed...F6cD`) |
| To | PositionManager (`0xAB6b...eaD7`) |
| Gas Used | 159,348 |
| Status | Success |

**Events emitted:**
1. **ERC20 Transfer** — USDC returned from PositionManager to trader: **$5,166.89**
2. **PositionClosed** — Position #1 closed with realized PnL

**Post-close on-chain state (Position #1):**
```
entryPrice: 260000000000 → $2,600.00 (preserved for history)
size:       0 (closed)
collateral: 0 (returned to trader)
isOpen:     false
```

---

## Current Position Snapshot

### Position #3 — LONG ETH (Active, TP/SL Armed)

```
┌─────────────────────────────────────────────────────────┐
│                    Position #3 — LONG ETH               │
├─────────────────────────────────────────────────────────┤
│  Entry:  $1,955.00                                      │
│  Size:   5 contracts                                    │
│  Margin: $24,348.13                                     │
│                                                         │
│  TP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ $1,985.00 (+$150.00)  │
│                                                         │
│  Current ━━━━━━━━━━━━━━━━━━━━━━━ $1,949.89 (-$25.55)   │
│                                                         │
│  Entry ━━━━━━━━━━━━━━━━━━━━━━━━━ $1,955.00              │
│                                                         │
│  SL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ $1,935.00 (-$100.00)  │
└─────────────────────────────────────────────────────────┘
```

| Metric | Value |
|--------|-------|
| Unrealized PnL | -$25.55 |
| ROE | -0.10% |
| Distance to TP | $35.11 (+1.80%) |
| Distance to SL | $14.89 (-0.76%) |
| Risk/Reward at current | 1:2.36 |

### Position #4 — SHORT ETH (Counterparty)

| Field | Value |
|-------|-------|
| Entry | $1,955.00 |
| Size | 5 contracts |
| Collateral | $12,218.75 |
| Unrealized PnL | +$25.55 (inverse of #3) |

---

## TP/SL Execution Flow (Verified)

```
1. User sets TP/SL via CLI
   └── setTPSL(positionId, tpPrice, slPrice) → stored on-chain

2. Keeper bot polls every 5 seconds
   └── For each open position with TP/SL:
       ├── Fetch oracle price (Chainlink)
       ├── LONG position:
       │   ├── price >= TP → close (take profit)
       │   └── price <= SL → close (stop loss)  ← TRIGGERED for #1
       └── SHORT position:
           ├── price <= TP → close (take profit)
           └── price >= SL → close (stop loss)

3. Close execution
   └── closePosition(positionId, 0) → full close
       ├── Calculate PnL at current oracle price
       ├── Return collateral ± PnL to trader
       └── Emit PositionClosed event
```

---

## Key Observations

1. **SL triggered correctly** — Position #1 (LONG $2,600) was closed when price ($1,949.89) was below its SL level. The keeper detected and executed within a single poll cycle.

2. **TP/SL stored on-chain** — Verified via `getTPSL(3)` that values match exactly what was set via CLI.

3. **Collateral returned** — $5,166.89 USDC was transferred back to the trader on SL close (remaining collateral after loss).

4. **Position #3 safe** — Current price ($1,949.89) is between SL ($1,935) and TP ($1,985), so the keeper correctly takes no action.

5. **Gas cost** — SL close consumed 159,348 gas (~$0.001 on Fuji), making keeper operation extremely cheap.

6. **Latency** — From keeper start to SL execution: < 5 seconds (single poll cycle).

---

## Contracts Verified

| Contract | Address | Verified |
|----------|---------|----------|
| PositionManager | `0xAB6b565384773C70da8D9e254aFB4B59d710eaD7` | Position state, TP/SL storage, close execution |
| OrderBook | `0x74AeE1AdBcE40B984beA4B09deAf581c6139cbC9` | Order matching, fill |
| ChainlinkOracle | `0x23196688CDc03348d712BBc2E74CeA4Eea1e60EB` | Live ETH price feed |
| MockUSDC | `0xA41BCF380ff358c849619538fda0Dd38214E019d` | Collateral transfers |
