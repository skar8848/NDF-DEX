# Multi-Collateral Support

Accept WETH, WBTC, WAVAX, and other ERC20 tokens as collateral with oracle-based USD valuation and haircuts.

## Supported Tokens

| Token | Haircut | Effective Value |
|-------|---------|-----------------|
| USDC  | 0%      | 100% of market value |
| WETH  | 10%     | 90% of market value |
| WBTC  | 10%     | 90% of market value |
| WAVAX | 20%     | 80% of market value |

## How It Works

### Haircuts
Volatile assets are valued at less than their market price to provide a safety buffer:

```
effectiveValue = marketValue * (1 - haircutPercent)
```

Example: 1 WETH at $2,500 with 10% haircut = **$2,250** effective collateral value.

### Valuation
The CollateralManager uses the Chainlink oracle to price each token:

```
valueUSD = balance * oraclePrice * (1 - haircut) / tokenDecimals / priceDecimals * usdcDecimals
```

## Contract API

```solidity
// Admin
addCollateralToken(token, priceAsset, decimals, haircutBps)

// Trader
depositCollateral(token, amount)
withdrawCollateral(token, amount)

// View
getCollateralValueUSD(trader) → totalUSD (6 decimals)
getDeposit(trader, token) → (balance, valueUSD)
getSupportedTokens() → address[]
```

## CLI

```bash
# Deposit 1 WETH as collateral
npx tsx src/cli.ts collateral deposit WETH 1

# Withdraw 0.5 WETH
npx tsx src/cli.ts collateral withdraw WETH 0.5

# Check collateral status
npx tsx src/cli.ts collateral status
```

## SDK

```typescript
await client.depositCollateral(ADDRESSES.MockWETH, parseEther('1'))
const value = await client.getCollateralValue()
console.log(`Total collateral: $${formatUSDC(value)}`)
```

## Future Integration

The CollateralManager is currently standalone. Future versions will integrate directly with the OrderBook to allow traders to use multi-collateral deposits instead of direct USDC `transferFrom` when placing orders.
