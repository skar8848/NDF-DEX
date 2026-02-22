import 'dotenv/config'

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

export const config = {
  rpcUrl: env('RPC_URL', 'https://avalanche-fuji-c-chain-rpc.publicnode.com'),
  keeperPrivateKey: env('KEEPER_PRIVATE_KEY') as `0x${string}`,

  addresses: {
    positionManager: env('POSITION_MANAGER', '0xAB6b565384773C70da8D9e254aFB4B59d710eaD7') as `0x${string}`,
    forwardMarket: env('FORWARD_MARKET', '0x281dc4C64D2BF3508bA2670897f321a31F5e1e65') as `0x${string}`,
    mockOracle: env('MOCK_ORACLE', '0x23196688CDc03348d712BBc2E74CeA4Eea1e60EB') as `0x${string}`, // ChainlinkOracle
    orderBook: env('ORDER_BOOK', '0x74AeE1AdBcE40B984beA4B09deAf581c6139cbC9') as `0x${string}`,
    mockUsdc: env('MOCK_USDC', '0xA41BCF380ff358c849619538fda0Dd38214E019d') as `0x${string}`,
  },

  pollIntervalMs: Number(env('POLL_INTERVAL_MS', '5000')),
  positionPageSize: 50,

  // Precision constants (match Solidity)
  PRICE_PRECISION: 10n ** 8n,
  COLLATERAL_PRECISION: 10n ** 6n,
  PERCENT_BASE: 10n ** 4n,
} as const
