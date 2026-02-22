# Order Matching Engine

The Tenor OrderBook implements a fully on-chain Central Limit Order Book (CLOB) with automatic matching. When an order is placed, the matching engine immediately attempts to fill it against resting orders on the opposite side. Unfilled quantities rest in the book until matched or cancelled.

---

## Order Book Structure

The order book maintains two arrays per market:

- **Bids** (`bidOrderIds[marketId]`) -- LONG orders, representing buy interest
- **Asks** (`askOrderIds[marketId]`) -- SHORT orders, representing sell interest

Each order stores:
- **price** -- Limit price in 8 decimals (e.g., `250000000000` = $2,500.00)
- **amount** -- Number of contracts (integer)
- **filled** -- How many contracts have been filled so far
- **collateral** -- USDC locked (6 decimals)
- **status** -- OPEN, FILLED, PARTIALLY_FILLED, or CANCELLED

---

## Order Types

### Limit Orders

A limit order specifies an exact price. The trader deposits collateral calculated as:

```
collateral = amount * price / PRICE_PRECISION * COLLATERAL_PRECISION * PERCENT_BASE / ltv
```

For a market with 50% LTV (ltv = 5000), buying 5 contracts of ETH at $2,500:
```
collateral = 5 * 250000000000 / 1e8 * 1e6 * 10000 / 5000
           = 5 * 2500 * 1e6 * 2
           = $25,000 USDC (25,000,000,000 in 6 decimals)
```

The collateral must meet the market's `minCollateral` requirement.

### Market Orders

Market orders use extreme price bounds to ensure execution:
- **LONG market order:** price = `type(uint256).max / 2` (willing to buy at any price)
- **SHORT market order:** price = `1` (willing to sell at any price)

Collateral is calculated at `2x the oracle price` to ensure sufficient coverage. After matching, any unused collateral from unfilled contracts is refunded to the trader. If no fills occur, the order is cancelled and the full deposit is returned.

---

## Order Lifecycle

```mermaid
stateDiagram-v2
    [*] --> OPEN: placeLimitOrder() / placeMarketOrder()

    OPEN --> FILLED: Fully matched
    OPEN --> PARTIALLY_FILLED: Partially matched
    OPEN --> CANCELLED: cancelOrder() or unfilled market order

    PARTIALLY_FILLED --> FILLED: Remaining matched
    PARTIALLY_FILLED --> CANCELLED: cancelOrder()

    FILLED --> [*]
    CANCELLED --> [*]

    note right of OPEN
        Collateral transferred
        from trader to OrderBook.
        Matching attempted immediately.
    end note

    note right of FILLED
        Collateral forwarded to
        PositionManager. Positions
        created for both parties.
    end note

    note right of CANCELLED
        Remaining collateral
        refunded to trader.
    end note
```

---

## Matching Algorithm

```mermaid
flowchart TD
    Start["Incoming Order Placed"] --> CalcCollat["Calculate required collateral<br/>Transfer USDC from trader"]
    CalcCollat --> CreateOrder["Create Order record<br/>status = OPEN"]
    CreateOrder --> GetOpposite["Get opposite side orders<br/>(LONG incoming → scan asks)<br/>(SHORT incoming → scan bids)"]

    GetOpposite --> Loop{"Any resting orders<br/>remaining?"}
    Loop -->|No| CheckRemaining{"Unfilled amount<br/>remaining?"}
    Loop -->|Yes| CheckStatus{"Resting order<br/>OPEN or<br/>PARTIALLY_FILLED?"}

    CheckStatus -->|No| SkipOrder["Skip to next order"]
    SkipOrder --> Loop
    CheckStatus -->|Yes| CheckPrice{"Price crossing?<br/><br/>LONG: incoming.price >= resting.price<br/>SHORT: incoming.price <= resting.price"}

    CheckPrice -->|No| SkipOrder2["Skip to next order"]
    SkipOrder2 --> Loop
    CheckPrice -->|Yes| CalcMatch["matchAmount = min(<br/>  remaining,<br/>  resting.amount - resting.filled<br/>)"]

    CalcMatch --> ExecMatch["Execute Match at resting price:<br/>1. Calculate proportional collateral<br/>2. Deduct taker fee<br/>3. Create LONG position<br/>4. Create SHORT position<br/>5. Transfer collateral to PositionManager<br/>6. Update fill amounts"]
    ExecMatch --> UpdateStatus["Update order statuses"]
    UpdateStatus --> DecRemaining["remaining -= matchAmount"]
    DecRemaining --> Loop

    CheckRemaining -->|"Yes (limit order)"| RestInBook["Add to order book<br/>(bids or asks array)"]
    CheckRemaining -->|"Yes (market order)"| RefundMarket["Refund unused collateral<br/>Set CANCELLED or<br/>PARTIALLY_FILLED"]
    CheckRemaining -->|No| Done["Order fully filled"]

    RestInBook --> CleanBook["Clean filled orders<br/>from opposite side"]
    RefundMarket --> CleanBook
    Done --> CleanBook
    CleanBook --> End["Done"]

    style Start fill:#7B68EE,color:#fff
    style ExecMatch fill:#E8832A,color:#fff
    style Done fill:#4CAF50,color:#fff
    style RestInBook fill:#4A90D9,color:#fff
    style RefundMarket fill:#F44336,color:#fff
```

---

## Full Trade Flow

```mermaid
sequenceDiagram
    actor Alice as Alice (Long Trader)
    actor Bob as Bob (Short Trader)
    participant UI as Frontend
    participant USDC as MockUSDC
    participant OB as OrderBook
    participant PM as PositionManager
    participant FM as ForwardMarket
    participant Oracle as ChainlinkOracle
    participant CL as Chainlink Feed

    Note over Bob: Bob places a SHORT limit order first
    Bob->>UI: Place SHORT limit order<br/>ETH @ $2,500, 5 contracts
    UI->>USDC: transferFrom(Bob, OrderBook, collateral)
    USDC-->>OB: USDC transferred
    OB->>OB: Create Order #1 (SHORT, OPEN)
    OB->>OB: _matchOrder(#1) — no bids, no match
    OB->>OB: Add to askOrderIds[marketId]
    OB-->>UI: OrderPlaced event

    Note over Alice: Alice places a LONG limit order
    Alice->>UI: Place LONG limit order<br/>ETH @ $2,510, 5 contracts
    UI->>USDC: transferFrom(Alice, OrderBook, collateral)
    USDC-->>OB: USDC transferred
    OB->>OB: Create Order #2 (LONG, OPEN)

    Note over OB: Matching Engine runs
    OB->>OB: _matchOrder(#2)<br/>Scan asks: Order #1 @ $2,500
    OB->>OB: Price crossing? $2,510 >= $2,500 ✓
    OB->>OB: matchAmount = min(5, 5) = 5
    OB->>OB: Match price = $2,500 (resting order price)

    Note over OB: Execute Match
    OB->>OB: Calculate proportional collateral
    OB->>OB: Deduct taker fee (0.10% of Alice's collateral)
    OB->>USDC: Transfer fee to feeCollector
    OB->>PM: openPosition(LONG, Alice, $2,500, 5, collatLong)
    PM->>PM: Create Position #1 (Alice, LONG)
    PM->>FM: updateOI(LONG, +5)
    PM-->>OB: positionId #1

    OB->>PM: openPosition(SHORT, Bob, $2,500, 5, collatShort)
    PM->>PM: Create Position #2 (Bob, SHORT)
    PM->>FM: updateOI(SHORT, +5)
    PM-->>OB: positionId #2

    OB->>USDC: transfer(PositionManager, collatLong + collatShort)
    OB->>OB: Update fills: #1 FILLED, #2 FILLED
    OB-->>UI: OrderMatched event

    Note over Alice, Bob: Both positions are now open
    Note over Alice: Alice can set TP/SL, add collateral, or close early
    Note over Bob: Bob can set TP/SL, add collateral, or close early

    Note over FM: At expiration...
    FM->>Oracle: getPrice("ETH")
    Oracle->>CL: latestRoundData()
    CL-->>Oracle: price = $2,800
    Oracle-->>FM: ($2,800, timestamp)
    FM->>FM: market.settlePrice = $2,800<br/>market.settled = true

    Note over PM: Settlement
    PM->>PM: settlePosition(#1)<br/>PnL = ($2,800 - $2,500) * 5 = +$1,500
    PM->>USDC: transfer(Alice, collateral + $1,500)

    PM->>PM: settlePosition(#2)<br/>PnL = ($2,500 - $2,800) * 5 = -$1,500
    PM->>USDC: transfer(Bob, collateral - $1,500)
```

---

## Collateral Calculation

Collateral is the USDC deposit required to open a position. It is determined by the order price, position size, and the market's Loan-to-Value (LTV) ratio.

### Formula

```
collateral = (amount * price / PRICE_PRECISION) * COLLATERAL_PRECISION * PERCENT_BASE / ltv
```

Where:
- `PRICE_PRECISION = 1e8` (8 decimal places for prices)
- `COLLATERAL_PRECISION = 1e6` (6 decimal places for USDC)
- `PERCENT_BASE = 1e4` (10000 = 100%)
- `ltv` is in basis points (e.g., 5000 = 50%)

### Example

| Parameter | Value |
|---|---|
| Asset | ETH |
| Order price | $2,500.00 |
| Size | 10 contracts |
| Market LTV | 50% (5000 bps) |

```
collateral = (10 * 250000000000 / 1e8) * 1e6 * 10000 / 5000
           = 25000 * 1e6 * 2
           = 50,000,000,000  (= $50,000 USDC)
```

The higher the LTV, the less collateral is required (more leverage). At 50% LTV, the trader effectively has 2x leverage.

### Minimum Collateral

Each market defines a `minCollateral` floor. Orders whose calculated collateral falls below this minimum are rejected.

---

## Liquidation

Positions can be liquidated when their health factor drops below 100% (10000 in basis points).

### Health Factor Formula

```
equity = collateral + PnL
maintenanceMargin = size * entryPrice * liquidationThreshold * COLLATERAL_PRECISION / (PRICE_PRECISION * PERCENT_BASE)
healthFactor = equity * PERCENT_BASE / maintenanceMargin
```

- `healthFactor >= 10000` -- Position is healthy
- `healthFactor < 10000` -- Position is liquidatable

### Liquidation Incentive

The liquidator receives a 5% bonus (`LIQUIDATION_BONUS = 500 bps`) from the position's remaining collateral. The rest is returned to the position's trader.

```
liquidatorBonus = min(remaining_collateral * 5%, remaining_collateral)
traderRefund = remaining_collateral - liquidatorBonus
```

---

## Partial Fills

Both limit and market orders support partial fills. When an incoming order is larger than a resting order, the engine:

1. Fills the resting order completely
2. Continues scanning the next resting order
3. Repeats until the incoming order is fully filled or no more matching resting orders exist

Collateral is allocated proportionally to the filled amount:

```
collatForFill = order.collateral * matchAmount / (order.amount - order.filled)
```

After a partial fill:
- The resting order updates to `PARTIALLY_FILLED` and remains in the book
- The incoming order may also become `PARTIALLY_FILLED` and rest in the book (for limit orders) or refund the remainder (for market orders)

---

## Fee Structure

| Fee | Rate | Description |
|---|---|---|
| Taker fee | 10 bps (0.10%) | Charged on the taker (incoming) order's collateral at match time |
| Maker fee | 0 bps | No fee for resting (maker) orders |

The taker fee is calculated on the collateral portion corresponding to the matched amount and is immediately transferred to the `feeCollector` address. The fee is deducted from the taker's collateral before it is forwarded to the PositionManager, meaning the taker's resulting position has slightly less collateral than a maker's equivalent position.

The fee rate is configurable by the contract owner (max 10% / 1000 bps). The `feeCollector` address is also configurable.
