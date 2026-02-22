// ─── Tenor Protocol SDK ─────────────────────────────────────────
// Lightweight TypeScript SDK for the Tenor decentralized forwards
// exchange on Avalanche Fuji testnet.
//
// Usage:
//   import { TenorClient, parsePrice, formatUSDC } from '@tenor-protocol/sdk'

export { TenorClient } from './client.js'

export {
  type Market,
  type Position,
  type Order,
  type OrderBook,
  type PriceData,
  type TPSL,
  type TenorClientConfig,
  type FeeConfig,
  type FeeTotals,
  type InsuranceFundHealth,
  type VaultInfo,
  type CollateralDeposit,
  Side,
  OrderStatus,
  TimeInForce,
} from './types.js'

export {
  ADDRESSES,
  AVALANCHE_FUJI_CHAIN_ID,
  DEFAULT_RPC_URL,
  PRICE_DECIMALS,
  PRICE_PRECISION,
  USDC_DECIMALS,
  COLLATERAL_PRECISION,
  PERCENT_BASE,
  avalancheFuji,
  // ABIs for advanced usage
  PositionManagerABI,
  ForwardMarketABI,
  MockOracleABI,
  OrderBookABI,
  MockUsdcABI,
  InsuranceFundABI,
  TenorVaultABI,
  CollateralManagerABI,
} from './constants.js'

export {
  formatPrice,
  parsePrice,
  formatUSDC,
  parseUSDC,
  formatTimestamp,
  shortenAddress,
} from './utils.js'
