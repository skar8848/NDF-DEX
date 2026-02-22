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
    positionManager: env('POSITION_MANAGER', '0xe6a05bA11CD37A46E78eBE2f638b36dCA1c1ED17') as `0x${string}`,
    forwardMarket: env('FORWARD_MARKET', '0xf513AB1d36D179E9910070b6049249CD397Cd572') as `0x${string}`,
    mockOracle: env('MOCK_ORACLE', '0x2413750CA5c7a48048b1295C2397003057EAf2ab') as `0x${string}`, // ChainlinkOracle
    orderBook: env('ORDER_BOOK', '0xCe34E18C1Cd5A3E04B997592dBc3272A58beEcAC') as `0x${string}`,
    mockUsdc: env('MOCK_USDC', '0x2395F7aB842a3B91634214E5d1D841c7DD0D30D9') as `0x${string}`,
    mockWeth: env('MOCK_WETH', '0x0eF47d0c930BF6D4ABbE165CeB8823139e1B8E97') as `0x${string}`,
  },

  pollIntervalMs: Number(env('POLL_INTERVAL_MS', '5000')),
  positionPageSize: 50,

  // Precision constants (match Solidity)
  PRICE_PRECISION: 10n ** 8n,
  COLLATERAL_PRECISION: 10n ** 6n,
  PERCENT_BASE: 10n ** 4n,
} as const
