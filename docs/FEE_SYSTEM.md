# Fee System

Tenor Protocol uses a comprehensive fee system inspired by Hyperliquid and GMX.

## Fee Structure

### Taker Fee
- Default: **5 bps** (0.05%) on collateral value
- Charged to the incoming (taker) order on each match
- Configurable via `setTakerFee(bps)`

### Maker Rebate
- Default: **2 bps** (0.02%) rebate to resting (maker) orders
- Added to the maker's position collateral
- Configurable via `setMakerFee(bps, enabled)`

### Fee Split
Net fees (taker fee minus maker rebate) are distributed:

| Destination | Default | Description |
|-------------|---------|-------------|
| Protocol    | 30%     | Goes to `feeCollector` address |
| Insurance   | 10%     | Goes to `InsuranceFund` contract |
| LP Vault    | 60%     | Goes to `TenorVault` (TLP holders) |

Configurable via `setFeeSplit(protocolBps, insuranceBps)`.

### Builder Codes (Hyperliquid-inspired)
Frontends/integrators can earn a share of taker fees:

1. Admin registers builder: `registerBuilder(builder, feeBps)`
2. Trader sets their builder: `setBuilderForTrader(trader, builder)`
3. On each trade, builder receives `feeBps` of the net fee

## View Functions

```solidity
getFeeConfig() → (takerBps, makerBps, rebateEnabled, protocolBps, insuranceBps, lpBps)
getFeeTotals() → (totalCollected, protocolFees, insuranceFees, builderFees, makerRebates)
```

## CLI

```bash
npx tsx src/cli.ts fees
```

## Example Flow

1. Alice places LONG limit order (resting/maker)
2. Bob places SHORT limit order that crosses (incoming/taker)
3. Bob pays 5 bps taker fee on his collateral
4. Alice receives 2 bps maker rebate (added to her position collateral)
5. Net fee (3 bps) is split: 30% protocol, 10% insurance, 60% LP vault
