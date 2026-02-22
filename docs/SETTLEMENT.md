# Forward Settlement

Forward contracts on Tenor expire at a predetermined timestamp. At expiration, the market is settled using the Chainlink oracle price, and all open positions are closed with PnL calculated against that settlement price.

---

## How Forwards Expire

Each market has an `expiration` timestamp set at creation. Once `block.timestamp >= expiration`, the market can be settled. Settlement is a two-phase process:

1. **Market settlement** -- Lock the oracle price as the definitive settlement price
2. **Position settlement** -- Close each position and distribute payouts

Both phases are permissionless: anyone can call the settlement functions. In practice, the keeper bot handles this automatically.

---

## Settlement Flow

```mermaid
sequenceDiagram
    participant Keeper as Keeper Bot
    participant FM as ForwardMarket
    participant Oracle as ChainlinkOracle
    participant CL as Chainlink Feed
    participant PM as PositionManager
    participant USDC as MockUSDC
    actor Alice as Alice (LONG)
    actor Bob as Bob (SHORT)

    Note over FM: Market #1: ETH/USDC Forward<br/>Expiration: March 15, 2026<br/>Alice: LONG 5 @ $2,500 (collat: $25,000)<br/>Bob: SHORT 5 @ $2,500 (collat: $25,000)

    Note over Keeper: Keeper detects expiration

    rect rgb(59, 93, 210, 0.1)
        Note over FM: Phase 1: Market Settlement
        Keeper->>FM: settleMarket(1)
        FM->>FM: Verify: market exists ✓
        FM->>FM: Verify: not already settled ✓
        FM->>FM: Verify: block.timestamp >= expiration ✓
        FM->>Oracle: getPrice("ETH")
        Oracle->>CL: latestRoundData()
        CL-->>Oracle: answer = $2,800 (8 decimals)
        Oracle-->>FM: (280000000000, timestamp)
        FM->>FM: market.settlePrice = 280000000000
        FM->>FM: market.settled = true
        FM-->>Keeper: MarketSettled(1, 280000000000)
    end

    rect rgb(76, 175, 80, 0.1)
        Note over PM: Phase 2: Position Settlement
        Keeper->>PM: settlePosition(Position #1 — Alice LONG)
        PM->>PM: Verify: position is open ✓
        PM->>FM: getMarket(1)
        FM-->>PM: market (settled=true, settlePrice=$2,800)
        PM->>PM: Verify: market.settled == true ✓
        PM->>PM: PnL = ($2,800 - $2,500) * 5<br/>= +$1,500 USDC
        PM->>PM: payout = $25,000 + $1,500 = $26,500
        PM->>PM: Cap payout at contract balance
        PM->>USDC: transfer(Alice, $26,500)
        PM->>FM: updateOI(LONG, -5, decrease)
        PM->>PM: position.isOpen = false
        PM-->>Keeper: PositionSettled(#1, +$1,500)
        PM-->>Alice: $26,500 USDC received

        Keeper->>PM: settlePosition(Position #2 — Bob SHORT)
        PM->>PM: PnL = ($2,500 - $2,800) * 5<br/>= -$1,500 USDC
        PM->>PM: payout = $25,000 - $1,500 = $23,500
        PM->>USDC: transfer(Bob, $23,500)
        PM->>FM: updateOI(SHORT, -5, decrease)
        PM->>PM: position.isOpen = false
        PM-->>Keeper: PositionSettled(#2, -$1,500)
        PM-->>Bob: $23,500 USDC received
    end

    Note over Alice, Bob: Market fully settled<br/>$50,000 total collateral redistributed<br/>Alice: +$1,500 profit<br/>Bob: -$1,500 loss
```

---

## Settlement Price

The settlement price is determined by a single call to the ChainlinkOracle at the moment `settleMarket()` is executed. This price is:

- Read from the Chainlink AggregatorV3 on-chain price feed (if registered for the asset)
- Normalized to 8 decimals
- Stored permanently in `market.settlePrice`
- Used for all subsequent position settlements on that market

Once set, the settlement price is immutable. The `settled` flag prevents re-settlement.

### Oracle Price Path

```mermaid
flowchart LR
    CL["Chainlink<br/>AggregatorV3<br/>(on Fuji)"]
    CO["ChainlinkOracle<br/>Contract"]
    FM["ForwardMarket"]

    CL -->|"latestRoundData()"| CO
    CO -->|"Normalize to 8 decimals<br/>if feed.decimals != 8"| CO
    CO -->|"getPrice(asset)"| FM
    FM -->|"Store as<br/>market.settlePrice"| FM

    style CL fill:#375BD2,color:#fff
    style CO fill:#375BD2,color:#fff
    style FM fill:#4A90D9,color:#fff
```

If no Chainlink feed is registered for the asset, the oracle falls back to a manually-set fallback price (admin-controlled). For production markets, Chainlink feeds should always be registered.

---

## PnL Calculation at Settlement

PnL is calculated using the MathLib library with the market's settlement price as the exit price:

```solidity
// For LONG positions:
PnL = (settlePrice - entryPrice) * size * COLLATERAL_PRECISION / PRICE_PRECISION

// For SHORT positions:
PnL = (entryPrice - settlePrice) * size * COLLATERAL_PRECISION / PRICE_PRECISION
```

### Payout Logic

```
if PnL >= 0:
    payout = collateral + PnL
    payout = min(payout, contract USDC balance)  // safety cap
else:
    loss = |PnL|
    payout = max(collateral - loss, 0)           // cannot go negative
```

The safety cap ensures a payout never exceeds the actual USDC held by the PositionManager. In a well-collateralized system, this cap should never be binding.

### Worked Example

| Parameter | Alice (LONG) | Bob (SHORT) |
|---|---|---|
| Entry price | $2,500.00 | $2,500.00 |
| Settlement price | $2,800.00 | $2,800.00 |
| Size | 5 contracts | 5 contracts |
| Collateral deposited | $25,000 USDC | $25,000 USDC |
| PnL | +$1,500 | -$1,500 |
| Payout | $26,500 | $23,500 |
| Return | +6.0% | -6.0% |

---

## Batch Settlement

The keeper bot automates settlement in its regular polling cycle. The `checkAndSettle()` service handles both phases:

```mermaid
flowchart TD
    Start["Keeper Cycle"] --> FetchMarkets["Fetch all markets<br/>forwardMarket.getAllMarkets()"]
    FetchMarkets --> FetchPositions["Fetch all open positions"]
    FetchPositions --> Phase1["Phase 1: Settle Expired Markets"]

    Phase1 --> LoopMarkets{"For each market"}
    LoopMarkets -->|"settled = true"| SkipMarket["Skip (already settled)"]
    LoopMarkets -->|"expiration > now"| SkipMarket2["Skip (not expired yet)"]
    LoopMarkets -->|"expiration <= now<br/>AND not settled"| Settle["Call settleMarket(marketId)<br/>with retry (3 attempts)"]

    Settle -->|Success| MarkSettled["Mark market as settled locally"]
    Settle -->|Failed| LogError["Log error, continue"]
    MarkSettled --> LoopMarkets
    SkipMarket --> LoopMarkets
    SkipMarket2 --> LoopMarkets
    LogError --> LoopMarkets

    LoopMarkets -->|"Done"| Phase2["Phase 2: Settle Positions"]
    Phase2 --> CollectSettled["Collect all settled market IDs"]
    CollectSettled --> LoopPositions{"For each open position"}

    LoopPositions -->|"Not on a settled market"| SkipPos["Skip"]
    LoopPositions -->|"On a settled market"| SettlePos["Call settlePosition(positionId)<br/>with retry (3 attempts)"]

    SettlePos -->|Success| LogSuccess["Log: Position settled"]
    SettlePos -->|Failed| LogPosError["Log error, continue"]
    LogSuccess --> LoopPositions
    LogPosError --> LoopPositions
    SkipPos --> LoopPositions

    LoopPositions -->|"Done"| End["Cycle complete"]

    style Phase1 fill:#4A90D9,color:#fff
    style Phase2 fill:#4CAF50,color:#fff
    style Settle fill:#E8832A,color:#fff
    style SettlePos fill:#E8832A,color:#fff
```

### Settlement Order

1. **Markets first** -- All expired, unsettled markets are settled before any positions
2. **Positions second** -- Only positions on settled markets are processed
3. **Sequential execution** -- Each settlement call waits for confirmation before proceeding to the next
4. **Retry logic** -- Each call has 3 retry attempts with exponential backoff (1s, 2s, 3s)

This ordering guarantees that `settlePosition()` is never called before `settleMarket()` has recorded the settlement price.

---

## Settlement Guards

The contracts enforce several safety checks:

### ForwardMarket.settleMarket()

| Check | Error Message |
|---|---|
| Market exists | `ForwardMarket: market not found` |
| Market not already settled | `ForwardMarket: already settled` |
| Market is expired | `ForwardMarket: not expired` |
| Oracle returns valid price | `ChainlinkOracle: invalid price from feed` |

### PositionManager.settlePosition()

| Check | Error Message |
|---|---|
| Position is open | `PositionManager: position closed` |
| Market is settled | `PositionManager: market not settled` |

### Pre-Expiry Guards

Before expiration, these functions are blocked:
- `settleMarket()` -- Reverts with "not expired"
- `settlePosition()` -- Reverts with "market not settled"

Before expiration, positions must be closed via `closePosition()` (early exit at mark price) rather than settled.

---

## Settlement vs Other Exit Methods

| Method | Trigger | Price Source | When Available |
|---|---|---|---|
| **Settlement** | Market expired + `settleMarket()` called | Locked settlement price | After expiration only |
| **Early Close** | Trader calls `closePosition()` | Live oracle mark price | Before expiration only |
| **TP/SL Close** | Keeper detects price trigger | Live oracle mark price | Before expiration only |
| **Liquidation** | Health factor < 100% | Live oracle mark price | Before expiration only |

After a market is settled, the only way to close a position is through `settlePosition()`. The `closePosition()` function explicitly requires `!market.settled`, directing users to the settlement path instead.
