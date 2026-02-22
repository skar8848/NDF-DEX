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
    positionManager: env('POSITION_MANAGER', '0x4834Fb2E0E1e8B8dec59aA18BD93B81bBB4EA23a') as `0x${string}`,
    forwardMarket: env('FORWARD_MARKET', '0x8caaA8f4d7a48dE91f26b0273dF8900fDdeb97c0') as `0x${string}`,
    mockOracle: env('MOCK_ORACLE', '0x6D76A1EA49C400bad81920e8e87b25355Bd236B4') as `0x${string}`, // ChainlinkOracle
    orderBook: env('ORDER_BOOK', '0x582E78ddd864C6f74607A615A206A576BF6b694E') as `0x${string}`,
    mockUsdc: env('MOCK_USDC', '0x96917A8B9b9479b68e1E07847A759CC742a64f8e') as `0x${string}`,
  },

  pollIntervalMs: Number(env('POLL_INTERVAL_MS', '5000')),
  positionPageSize: 50,

  // Precision constants (match Solidity)
  PRICE_PRECISION: 10n ** 8n,
  COLLATERAL_PRECISION: 10n ** 6n,
  PERCENT_BASE: 10n ** 4n,
} as const
