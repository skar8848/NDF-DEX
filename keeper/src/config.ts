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
    positionManager: env('POSITION_MANAGER', '0x7382edf36a1F21c10034420dda830731f76c50Ba') as `0x${string}`,
    forwardMarket: env('FORWARD_MARKET', '0x105C4379B18FA68629d687B0778e7431675B29Aa') as `0x${string}`,
    mockOracle: env('MOCK_ORACLE', '0xD1f5765cA1B513DF995055D17a5b3e9Ba1C32043') as `0x${string}`,
  },

  pollIntervalMs: Number(env('POLL_INTERVAL_MS', '5000')),
  positionPageSize: 50,

  // Precision constants (match Solidity)
  PRICE_PRECISION: 10n ** 8n,
  COLLATERAL_PRECISION: 10n ** 6n,
  PERCENT_BASE: 10n ** 4n,
} as const
