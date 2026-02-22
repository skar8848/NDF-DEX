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
    positionManager: env('POSITION_MANAGER', '0xEC53377E2af877728C51d870b087C3A11f08DFb2') as `0x${string}`,
    forwardMarket: env('FORWARD_MARKET', '0x567f4510e306C6aFB339cF802b8D6a9d0b3fdea8') as `0x${string}`,
    mockOracle: env('MOCK_ORACLE', '0xF5Cd6da71aDDB47C13e2D77A52FdD2364E301ACC') as `0x${string}`,
  },

  pollIntervalMs: Number(env('POLL_INTERVAL_MS', '5000')),
  positionPageSize: 50,

  // Precision constants (match Solidity)
  PRICE_PRECISION: 10n ** 8n,
  COLLATERAL_PRECISION: 10n ** 6n,
  PERCENT_BASE: 10n ** 4n,
} as const
