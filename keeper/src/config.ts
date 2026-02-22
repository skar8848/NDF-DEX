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
    positionManager: env('POSITION_MANAGER', '0x7a867BC74482724C2B0b6F36DFb15f6691088a88') as `0x${string}`,
    forwardMarket: env('FORWARD_MARKET', '0x7De1970F024cB1c2953dCBc850E895c4637f57E9') as `0x${string}`,
    mockOracle: env('MOCK_ORACLE', '0x6e1bebEf40dA65B2B5B39EFa1591a985C0EE884E') as `0x${string}`, // ChainlinkOracle
    orderBook: env('ORDER_BOOK', '0xd92Ff3f1FF6AAC7E298BcF9634eB907B9B7e7Bf9') as `0x${string}`,
    mockUsdc: env('MOCK_USDC', '0xDa9103E3121784fba3e60f5a95304833a5A904f1') as `0x${string}`,
    mockWeth: env('MOCK_WETH', '0x53bcf608A367661b3cafd4878624041F2ce522E3') as `0x${string}`,
    insuranceFund: env('INSURANCE_FUND', '0x3BC01a6710CF2f8DBa2E4bfD8b6F4C7F553E3BFC') as `0x${string}`,
    tenorVault: env('TENOR_VAULT', '0x62Ef155a07EA3bF04e6930d40Ad1549F973fB37D') as `0x${string}`,
    collateralManager: env('COLLATERAL_MANAGER', '0xE5586FF57d8602F980bf36eE9a9B99144cd15b66') as `0x${string}`,
  },

  pollIntervalMs: Number(env('POLL_INTERVAL_MS', '5000')),
  positionPageSize: 50,

  // Precision constants (match Solidity)
  PRICE_PRECISION: 10n ** 8n,
  COLLATERAL_PRECISION: 10n ** 6n,
  PERCENT_BASE: 10n ** 4n,
} as const
