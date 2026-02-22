# TenorVault — Passive Liquidity (TLP)

Inspired by Hyperliquid's HLP and GMX's GLP. The TenorVault allows passive USDC depositors to earn yield from trading fees.

## TLP Token

TLP (Tenor LP) is an ERC20 token representing shares in the vault. As fee revenue flows in, the share price increases — depositors profit without active trading.

## Mechanics

### Deposit
```bash
npx tsx src/cli.ts vault deposit 1000
```

- Depositor sends USDC to the vault
- Receives TLP shares proportional to vault value
- First deposit: 1 TLP = 1 USDC (scaled to 18 decimals)
- Subsequent deposits: `shares = amount * totalSupply / vaultBalance`

### Withdraw (Two-Step)
To prevent flash loan attacks and provide stability:

1. **Request**: `vault withdraw <shares>` — starts the delay timer
2. **Execute**: `vault execute` — after delay (default 24h), burns shares and sends USDC

```bash
npx tsx src/cli.ts vault withdraw 1000000000000000000000  # TLP shares (18 decimals)
# Wait 24 hours...
npx tsx src/cli.ts vault execute
```

### Share Price
```
sharePrice = vaultUSDCBalance / totalTLPSupply
```

The share price only goes up as fees flow in (no impermanent loss).

### Revenue Sources
- **60% of all trading fees** flow to the vault (configurable)
- The vault manager can also approve the OrderBook to use vault USDC for market making

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `depositCap` | 0 (unlimited) | Maximum USDC in vault |
| `withdrawalDelay` | 24 hours | Time between request and execute |
| `managementFeeBps` | 0 | Annual management fee |
| `performanceFeeBps` | 0 | Performance fee on profits |

## CLI

```bash
npx tsx src/cli.ts vault status     # View vault stats
npx tsx src/cli.ts vault deposit 1000
npx tsx src/cli.ts vault withdraw <shares>
npx tsx src/cli.ts vault execute
```

## SDK

```typescript
await client.vaultDeposit(1000_000000n)  // 1000 USDC
const info = await client.getVaultInfo()
console.log(info.sharePrice)  // 1e18 = $1 per TLP
```
