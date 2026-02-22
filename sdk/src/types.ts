// ─── Enums ──────────────────────────────────────────────────────

/** Trade direction: 0 = Long, 1 = Short */
export enum Side {
  Long = 0,
  Short = 1,
}

/** Order status on the order book */
export enum OrderStatus {
  Open = 0,
  Filled = 1,
  Cancelled = 2,
}

// ─── Core data types ────────────────────────────────────────────

/** A forward market listed on Tenor */
export interface Market {
  /** Unique market identifier */
  id: bigint
  /** Base asset symbol, e.g. "ETH" */
  baseAsset: string
  /** Quote asset symbol, e.g. "USD" */
  quoteAsset: string
  /** Unix timestamp when the forward expires */
  expiration: bigint
  /** Loan-to-value ratio (basis points, e.g. 5000 = 50%) */
  ltv: bigint
  /** Liquidation threshold (basis points) */
  liquidationThreshold: bigint
  /** Minimum collateral required (6-decimal USDC) */
  minCollateral: bigint
  /** Settlement price (set after expiration, 8 decimals) */
  settlePrice: bigint
  /** Whether the market has been settled */
  settled: boolean
  /** Total long open interest (6-decimal USDC) */
  totalLongOI: bigint
  /** Total short open interest (6-decimal USDC) */
  totalShortOI: bigint
}

/** An open or closed position */
export interface Position {
  /** Unique position identifier */
  id: bigint
  /** Trader wallet address */
  trader: `0x${string}`
  /** Market this position belongs to */
  marketId: bigint
  /** Long or Short */
  side: Side
  /** Entry price (8 decimals) */
  entryPrice: bigint
  /** Number of contracts */
  size: bigint
  /** Collateral deposited (6-decimal USDC) */
  collateral: bigint
  /** Unix timestamp when position was opened */
  timestamp: bigint
  /** Whether the position is still open */
  isOpen: boolean
}

/** Take-profit and stop-loss levels for a position */
export interface TPSL {
  /** Take-profit price (8 decimals), 0 = not set */
  takeProfitPrice: bigint
  /** Stop-loss price (8 decimals), 0 = not set */
  stopLossPrice: bigint
}

/** An order on the order book */
export interface Order {
  /** Unique order identifier */
  id: bigint
  /** Trader wallet address */
  trader: `0x${string}`
  /** Market this order is on */
  marketId: bigint
  /** Long or Short */
  side: Side
  /** Limit price (8 decimals) */
  price: bigint
  /** Total order size (contracts) */
  amount: bigint
  /** Amount already filled */
  filled: bigint
  /** Collateral locked for this order (6-decimal USDC) */
  collateral: bigint
  /** Unix timestamp when order was placed */
  timestamp: bigint
  /** Current order status */
  status: OrderStatus
}

/** Order book snapshot for a market */
export interface OrderBook {
  /** Buy orders, sorted by price descending */
  bids: Order[]
  /** Sell orders, sorted by price ascending */
  asks: Order[]
}

/** Oracle price data */
export interface PriceData {
  /** Price with 8 decimal places */
  price: bigint
  /** Unix timestamp of the price update */
  timestamp: bigint
}

// ─── SDK configuration ──────────────────────────────────────────

/** Configuration for creating a TenorClient */
export interface TenorClientConfig {
  /** RPC URL for Avalanche Fuji (defaults to public endpoint) */
  rpcUrl?: string
  /** Private key for write operations (hex string with 0x prefix) */
  privateKey?: `0x${string}`
}
