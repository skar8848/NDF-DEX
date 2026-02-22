import { defineChain } from 'viem'

export const avalancheFuji = defineChain({
  id: 43113,
  name: 'Avalanche Fuji',
  nativeCurrency: {
    decimals: 18,
    name: 'AVAX',
    symbol: 'AVAX',
  },
  rpcUrls: {
    default: { http: ['https://avalanche-fuji-c-chain-rpc.publicnode.com'] },
  },
  blockExplorers: {
    default: { name: 'SnowTrace', url: 'https://testnet.snowtrace.io' },
  },
  testnet: true,
})

// Deployed on Avalanche Fuji Testnet — v5 Security (ReentrancyGuard, SafeERC20, Access Control, Oracle Staleness)
export const CONTRACTS = {
  MockUSDC: '0x96917A8B9b9479b68e1E07847A759CC742a64f8e' as `0x${string}`,
  MockWETH: '0x9DCB4C58F9E6bd083AA90a120eeD9BcaAf31363d' as `0x${string}`,
  MockOracle: '0x6D76A1EA49C400bad81920e8e87b25355Bd236B4' as `0x${string}`, // ChainlinkOracle (same getPrice interface)
  ForwardMarket: '0x8caaA8f4d7a48dE91f26b0273dF8900fDdeb97c0' as `0x${string}`,
  OrderBook: '0x582E78ddd864C6f74607A615A206A576BF6b694E' as `0x${string}`,
  PositionManager: '0x4834Fb2E0E1e8B8dec59aA18BD93B81bBB4EA23a' as `0x${string}`,
} as const

export const PRICE_PRECISION = 1e8
export const COLLATERAL_PRECISION = 1e6
export const PERCENT_BASE = 1e4
