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
    positionManager: env('POSITION_MANAGER', '0xB2FA1e681616c63E242c17323D80BaDAa0B0Ed27') as `0x${string}`,
    forwardMarket: env('FORWARD_MARKET', '0x57D34869d4c13043fA99fEd63EB95B252cb70685') as `0x${string}`,
    mockOracle: env('MOCK_ORACLE', '0x9d0a00Fb789687dCDd09245Cd507faAed4db1bA1') as `0x${string}`, // ChainlinkOracle
  },

  pollIntervalMs: Number(env('POLL_INTERVAL_MS', '5000')),
  positionPageSize: 50,

  // Precision constants (match Solidity)
  PRICE_PRECISION: 10n ** 8n,
  COLLATERAL_PRECISION: 10n ** 6n,
  PERCENT_BASE: 10n ** 4n,
} as const
