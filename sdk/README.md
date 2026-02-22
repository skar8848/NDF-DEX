# @tenor-protocol/sdk

TypeScript SDK for **Tenor Protocol** -- a decentralized forwards exchange on Avalanche Fuji testnet.

## Quick Start

```bash
npm install @tenor-protocol/sdk
```

```typescript
import { TenorClient, formatPrice, formatUSDC } from '@tenor-protocol/sdk'

// Read-only client (no private key needed)
const client = new TenorClient()

// Fetch all markets
const markets = await client.getMarkets()
for (const m of markets) {
  console.log(`${m.baseAsset}/${m.quoteAsset} — Expires: ${new Date(Number(m.expiration) * 1000).toISOString()}`)
}

// Get the current ETH price
const { price } = await client.getPrice('ETH')
console.log(`ETH: $${formatPrice(price)}`)
```

## Installation

```bash
# npm
npm install @tenor-protocol/sdk

# pnpm
pnpm add @tenor-protocol/sdk

# yarn
yarn add @tenor-protocol/sdk
```

**Peer dependency:** [viem](https://viem.sh) v2.21+

## Usage

### Creating a client

```typescript
import { TenorClient } from '@tenor-protocol/sdk'

// Read-only (view markets, prices, positions)
const reader = new TenorClient()

// With custom RPC
const reader2 = new TenorClient({
  rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
})

// Full client (can also place trades, close positions, etc.)
const client = new TenorClient({
  privateKey: '0xYOUR_PRIVATE_KEY',
})
```

### Reading market data

```typescript
// All forward markets
const markets = await client.getMarkets()

// Oracle price for an asset
const { price, timestamp } = await client.getPrice('ETH')

// Order book for a market
const book = await client.getOrderBook(0n) // market ID 0
console.log(`Bids: ${book.bids.length}, Asks: ${book.asks.length}`)

// USDC balance
const balance = await client.getBalance() // connected wallet
const otherBalance = await client.getBalance('0x...') // any address
```

### Reading positions

```typescript
// All open positions on the protocol
const allPositions = await client.getPositions()

// Positions for a specific trader
const myPositions = await client.getPositions('0xMyAddress...')

// Single position by ID
const pos = await client.getPosition(1n)
console.log(`Entry: $${formatPrice(pos.entryPrice)}, Side: ${pos.side === 0 ? 'LONG' : 'SHORT'}`)

// TP/SL levels
const tpsl = await client.getTPSL(1n)

// Health factor (basis points, 10000 = 100%)
const health = await client.getHealthFactor(1n)
```

### Placing orders

```typescript
import { parsePrice } from '@tenor-protocol/sdk'

// Limit order: LONG 5 ETH contracts at $2,500
await client.placeLimitOrder(0n, 'long', parsePrice('2500'), 5n)

// Market order: SHORT 3 ETH contracts at the best available price
await client.placeMarketOrder(0n, 'short', 3n)
```

The SDK automatically estimates collateral and approves USDC spending before placing orders.

### Managing positions

```typescript
// Set take-profit and stop-loss
await client.setTPSL(1n, parsePrice('3000'), parsePrice('2000'))

// Close a position (100%)
await client.closePosition(1n)

// Partial close (50%)
await client.closePosition(1n, 50)

// Cancel an open order
await client.cancelOrder(5n)
```

### Testnet utilities

```typescript
// Mint 10,000 test USDC
await client.mintTestUSDC()

// Approve USDC spending
await client.approveUSDC('0xSpenderAddress...', parseUSDC('5000'))
```

## API Reference

### `TenorClient`

#### Constructor

```typescript
new TenorClient(config?: TenorClientConfig)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `config.rpcUrl` | `string` | Fuji public RPC | Avalanche Fuji RPC endpoint |
| `config.privateKey` | `` `0x${string}` `` | `undefined` | Private key for write operations |

#### Read Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getMarkets()` | `Promise<Market[]>` | All forward markets |
| `getPrice(asset)` | `Promise<PriceData>` | Oracle price for an asset |
| `getPositions(trader?)` | `Promise<Position[]>` | Open positions (optionally filtered by trader) |
| `getPosition(id)` | `Promise<Position>` | Single position by ID |
| `getOrderBook(marketId)` | `Promise<OrderBook>` | Bids and asks for a market |
| `getBalance(address?)` | `Promise<bigint>` | USDC balance (6 decimals) |
| `getTPSL(positionId)` | `Promise<TPSL>` | Take-profit/stop-loss levels |
| `getHealthFactor(positionId)` | `Promise<bigint>` | Health factor (basis points) |

#### Write Methods (require `privateKey`)

| Method | Returns | Description |
|--------|---------|-------------|
| `placeLimitOrder(marketId, side, price, size)` | `Promise<string>` | Place a limit order |
| `placeMarketOrder(marketId, side, size)` | `Promise<string>` | Place a market order |
| `closePosition(positionId, percent?)` | `Promise<string>` | Close a position (default 100%) |
| `setTPSL(positionId, tp, sl)` | `Promise<string>` | Set TP/SL (pass 0n to unset) |
| `mintTestUSDC()` | `Promise<string>` | Mint 10k test USDC |
| `approveUSDC(spender, amount)` | `Promise<string>` | Approve USDC spending |
| `cancelOrder(orderId)` | `Promise<string>` | Cancel an open order |

All write methods return the transaction hash.

### Utility Functions

| Function | Description |
|----------|-------------|
| `formatPrice(bigint)` | Format 8-decimal price to string (`"2,500.00"`) |
| `parsePrice(string)` | Parse price string to 8-decimal bigint |
| `formatUSDC(bigint)` | Format 6-decimal USDC to string (`"10,000.00"`) |
| `parseUSDC(string)` | Parse USDC string to 6-decimal bigint |
| `formatTimestamp(bigint)` | Format unix timestamp to locale string |
| `shortenAddress(string)` | Shorten address (`"0xAB6b...eaD7"`) |

### Types

```typescript
interface Market {
  id: bigint
  baseAsset: string       // e.g. "ETH"
  quoteAsset: string      // e.g. "USD"
  expiration: bigint      // unix timestamp
  ltv: bigint             // basis points
  liquidationThreshold: bigint
  minCollateral: bigint   // 6-decimal USDC
  settlePrice: bigint     // 8-decimal, set after settlement
  settled: boolean
  totalLongOI: bigint     // 6-decimal USDC
  totalShortOI: bigint    // 6-decimal USDC
}

interface Position {
  id: bigint
  trader: `0x${string}`
  marketId: bigint
  side: Side              // 0 = Long, 1 = Short
  entryPrice: bigint      // 8 decimals
  size: bigint            // contracts
  collateral: bigint      // 6-decimal USDC
  timestamp: bigint
  isOpen: boolean
}

interface Order {
  id: bigint
  trader: `0x${string}`
  marketId: bigint
  side: Side
  price: bigint           // 8 decimals
  amount: bigint
  filled: bigint
  collateral: bigint      // 6-decimal USDC
  timestamp: bigint
  status: OrderStatus     // 0=Open, 1=Filled, 2=Cancelled
}

interface TPSL {
  takeProfitPrice: bigint // 8 decimals, 0 = not set
  stopLossPrice: bigint   // 8 decimals, 0 = not set
}

interface PriceData {
  price: bigint           // 8 decimals
  timestamp: bigint
}

enum Side { Long = 0, Short = 1 }
enum OrderStatus { Open = 0, Filled = 1, Cancelled = 2 }
```

### Constants

```typescript
import { ADDRESSES, PRICE_DECIMALS, USDC_DECIMALS, avalancheFuji } from '@tenor-protocol/sdk'

ADDRESSES.MockUSDC        // "0xA41BCF380ff358c849619538fda0Dd38214E019d"
ADDRESSES.OrderBook       // "0x74AeE1AdBcE40B984beA4B09deAf581c6139cbC9"
ADDRESSES.PositionManager // "0xAB6b565384773C70da8D9e254aFB4B59d710eaD7"
ADDRESSES.ForwardMarket   // "0x281dc4C64D2BF3508bA2670897f321a31F5e1e65"
ADDRESSES.Oracle          // "0x23196688CDc03348d712BBc2E74CeA4Eea1e60EB"
ADDRESSES.MockWETH        // "0xC2DFD7581C9D27ac195C3873f12b93e7eCd4B24c"

PRICE_DECIMALS            // 8
USDC_DECIMALS             // 6
avalancheFuji             // viem Chain definition (chain ID 43113)
```

ABIs are also exported for advanced usage:

```typescript
import { PositionManagerABI, OrderBookABI, ForwardMarketABI, MockOracleABI, MockUsdcABI } from '@tenor-protocol/sdk'
```

## Network

| | |
|---|---|
| **Chain** | Avalanche Fuji Testnet |
| **Chain ID** | 43113 |
| **RPC** | `https://api.avax-test.network/ext/bc/C/rpc` |
| **Explorer** | https://testnet.snowtrace.io |

## License

MIT
