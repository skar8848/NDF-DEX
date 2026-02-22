# Take Profit / Stop Loss (TP/SL)

Tenor supports on-chain TP/SL orders that are stored in the PositionManager contract and executed by an off-chain keeper bot. This allows traders to set automatic exit conditions that trigger when the oracle price reaches specified levels.

---

## How TP/SL Works

1. **Trader sets TP/SL** -- After opening a position, the trader calls `setTPSL(positionId, tp, sl)` on the PositionManager. Both values are optional (pass 0 to skip).

2. **On-chain storage** -- TP/SL prices are stored in the `tpslOrders` mapping:
   ```solidity
   struct TPSLOrder {
       uint256 takeProfitPrice; // 8 decimals. 0 = not set
       uint256 stopLossPrice;   // 8 decimals. 0 = not set
   }
   ```

3. **Keeper monitors** -- The keeper bot polls all open positions every 5 seconds, batch-fetches their TP/SL values via `multicall`, and checks them against current oracle prices.

4. **Trigger conditions** -- When the oracle price crosses the threshold:
   - **LONG Take Profit:** `markPrice >= takeProfitPrice`
   - **LONG Stop Loss:** `markPrice <= stopLossPrice`
   - **SHORT Take Profit:** `markPrice <= takeProfitPrice`
   - **SHORT Stop Loss:** `markPrice >= stopLossPrice`

5. **Execution** -- The keeper calls `closePosition(positionId, 0)` which performs a full close at the current oracle mark price. The contract validates that the caller is either the position owner or that TP/SL conditions are actually met.

---

## Validation Rules

The contract enforces directional constraints when setting TP/SL:

| Position Side | Take Profit | Stop Loss |
|---|---|---|
| **LONG** | Must be **above** entry price | Must be **below** entry price |
| **SHORT** | Must be **below** entry price | Must be **above** entry price |

Setting either value to 0 disables that trigger. Both can be updated at any time by calling `setTPSL()` again.

---

## TP/SL Execution Flow

```mermaid
flowchart TD
    subgraph Keeper["Keeper Bot (every 5s)"]
        FetchPos["Fetch all open positions<br/>(paginated via multicall)"]
        FetchTPSL["Batch fetch TP/SL orders<br/>for all positions"]
        FetchPrices["Fetch oracle prices<br/>for all active assets"]
    end

    FetchPos --> FetchTPSL
    FetchTPSL --> FetchPrices
    FetchPrices --> Loop{"For each position<br/>with TP or SL set"}

    Loop --> GetPrice["Get current oracle price<br/>for position's base asset"]
    GetPrice --> CheckTP{"Take Profit<br/>triggered?"}

    CheckTP -->|"LONG: price >= TP"| Triggered["TP/SL Triggered"]
    CheckTP -->|"SHORT: price <= TP"| Triggered
    CheckTP -->|No| CheckSL{"Stop Loss<br/>triggered?"}

    CheckSL -->|"LONG: price <= SL"| Triggered
    CheckSL -->|"SHORT: price >= SL"| Triggered
    CheckSL -->|No| Skip["Skip — no trigger"]
    Skip --> Loop

    Triggered --> CallClose["Keeper calls<br/>closePosition(positionId, 0)"]
    CallClose --> Contract{"PositionManager<br/>validates trigger"}

    Contract --> CalcPnL["Calculate PnL at<br/>current mark price"]
    CalcPnL --> Payout["Transfer payout<br/>to trader"]
    Payout --> ClosePos["Mark position closed<br/>Update OI"]
    ClosePos --> EmitEvent["Emit PositionClosedEarly<br/>(positionId, closePrice, pnl, keeper)"]
    EmitEvent --> Log["Keeper logs success"]
    Log --> Loop

    style Triggered fill:#E8832A,color:#fff
    style Payout fill:#4CAF50,color:#fff
    style Skip fill:#999,color:#fff
```

---

## Position Lifecycle with TP/SL

```mermaid
stateDiagram-v2
    [*] --> Open: Order matched in OrderBook<br/>Position created by PositionManager

    Open --> TPSLSet: Trader calls setTPSL()<br/>TP and/or SL stored on-chain

    TPSLSet --> TPSLSet: Trader updates TP/SL<br/>(can call setTPSL() again)

    TPSLSet --> TPTriggered: Oracle price crosses TP<br/>(Keeper detects trigger)
    TPSLSet --> SLTriggered: Oracle price crosses SL<br/>(Keeper detects trigger)
    TPSLSet --> ManuallyClosed: Trader calls closePosition()
    TPSLSet --> Liquidated: Health factor < 100%<br/>(Keeper or anyone calls liquidate())
    TPSLSet --> Settled: Market expires<br/>settlePosition() called

    Open --> ManuallyClosed: Trader calls closePosition()
    Open --> Liquidated: Health factor < 100%
    Open --> Settled: Market expires

    TPTriggered --> Closed: Keeper calls closePosition()<br/>PnL calculated at mark price<br/>Payout sent to trader
    SLTriggered --> Closed: Keeper calls closePosition()<br/>PnL calculated at mark price<br/>Payout sent to trader
    ManuallyClosed --> Closed: PnL at mark price<br/>Payout sent to trader
    Liquidated --> Closed: 5% bonus to liquidator<br/>Remainder to trader
    Settled --> Closed: PnL at settlement price<br/>Payout sent to trader

    Closed --> [*]

    note right of TPSLSet
        On-chain storage:
        tpslOrders[positionId] = {
            takeProfitPrice,
            stopLossPrice
        }
    end note

    note right of Closed
        Position marked isOpen=false
        Removed from open list
        OI decremented
    end note
```

---

## TP/SL Sequence Diagram

```mermaid
sequenceDiagram
    actor Trader
    participant PM as PositionManager
    participant Oracle as ChainlinkOracle
    participant Keeper as Keeper Bot

    Note over Trader: Position #42 is open<br/>LONG ETH @ $2,500, 5 contracts

    Trader->>PM: setTPSL(42, $3,000, $2,200)
    PM->>PM: Validate: TP $3,000 > entry $2,500 ✓
    PM->>PM: Validate: SL $2,200 < entry $2,500 ✓
    PM->>PM: Store tpslOrders[42] = {tp: 3000e8, sl: 2200e8}
    PM-->>Trader: TPSLUpdated event

    Note over Keeper: Keeper polling cycle

    loop Every 5 seconds
        Keeper->>PM: getOpenPositionIds(0, 50)
        PM-->>Keeper: [42, ...]
        Keeper->>PM: multicall: getPosition(42), getTPSL(42)
        PM-->>Keeper: position data, {tp: 3000e8, sl: 2200e8}
        Keeper->>Oracle: getPrice("ETH")
        Oracle-->>Keeper: ($2,600, timestamp)
        Keeper->>Keeper: Check: $2,600 < $3,000 (TP not hit)<br/>Check: $2,600 > $2,200 (SL not hit)
        Note over Keeper: No trigger — skip
    end

    Note over Oracle: ETH price rises to $3,050

    Keeper->>Oracle: getPrice("ETH")
    Oracle-->>Keeper: ($3,050, timestamp)
    Keeper->>Keeper: Check: $3,050 >= $3,000 (TP HIT!)

    Keeper->>PM: closePosition(42, 0)
    PM->>PM: msg.sender != trader → check TP/SL
    PM->>Oracle: getPrice("ETH")
    Oracle-->>PM: ($3,050, timestamp)
    PM->>PM: TP triggered: $3,050 >= $3,000 ✓
    PM->>PM: PnL = ($3,050 - $2,500) * 5 * 1e6 / 1e8 = +$2,750
    PM->>PM: payout = collateral + $2,750
    PM-->>Trader: Transfer USDC payout
    PM-->>Keeper: PositionClosedEarly(42, $3,050, +$2,750, keeper)
```

---

## Frontend Integration

The trading UI integrates TP/SL directly into the order placement flow:

1. The `TradeForm` component includes TP and SL input fields alongside the order form
2. When a new position is detected (via `useUserOpenPositions` polling), the component automatically calls `setTPSL()` on the new position with the values from the form
3. Estimated gain/loss is displayed in real-time based on the TP/SL values, entry price, and position size
4. Return on equity (ROE) percentages are calculated for both TP and SL scenarios

### Estimated Gain/Loss Calculation

```
TP gain (LONG) = (tpPrice - entryPrice) * size * COLLATERAL_PRECISION / PRICE_PRECISION
TP ROE = gain / collateralRequired * 100%

SL loss (LONG) = (entryPrice - slPrice) * size * COLLATERAL_PRECISION / PRICE_PRECISION
SL ROE = loss / collateralRequired * 100%
```

---

## Keeper Implementation Details

The TP/SL keeper service (`keeper/src/services/tpslKeeper.ts`) processes positions in a single pass:

1. Iterates through all open positions
2. Looks up each position's TP/SL from the pre-fetched map
3. Skips positions with no TP and no SL set
4. Resolves the base asset's current price from the pre-fetched price map
5. Evaluates trigger conditions based on position side (LONG/SHORT)
6. On trigger, calls `closePosition(positionId, 0)` with retry logic (3 attempts, exponential backoff)
7. Logs the result (success or failure)

The retry mechanism (`keeper/src/utils/retry.ts`) handles transient RPC errors:
- 3 attempts maximum
- Exponential delay: 1s, 2s, 3s
- Returns `null` if all retries are exhausted (does not crash the keeper loop)

---

## Comparison: Settlement vs Early Close vs TP/SL

| | Settlement | Early Close | TP/SL |
|---|---|---|---|
| **When** | After market expiration | Any time before expiry | When price reaches target |
| **Who triggers** | Anyone (keeper or trader) | Position owner only | Keeper bot (or anyone) |
| **Price used** | Market's locked settlement price | Current oracle mark price | Current oracle mark price |
| **Function** | `settlePosition()` | `closePosition()` | `closePosition()` (with TP/SL check) |
| **Partial close** | No (always full) | Yes (`closeSize` parameter) | No (always full close) |
| **On-chain validation** | `market.settled == true` | `msg.sender == trader` | TP/SL conditions met |
