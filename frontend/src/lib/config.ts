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

// Deployed on Avalanche Fuji Testnet — v2 with TP/SL + closePosition
export const CONTRACTS = {
  MockUSDC: '0xfacee0508b0E250896b1e571dE2DD6022772293F' as `0x${string}`,
  MockWETH: '0xBfA163578942299296b4D1225bb364f290D83273' as `0x${string}`,
  MockOracle: '0xD1f5765cA1B513DF995055D17a5b3e9Ba1C32043' as `0x${string}`,
  ForwardMarket: '0x105C4379B18FA68629d687B0778e7431675B29Aa' as `0x${string}`,
  OrderBook: '0x7a1a2d21d4BD99800071A1f6df411439C2f35680' as `0x${string}`,
  PositionManager: '0x7382edf36a1F21c10034420dda830731f76c50Ba' as `0x${string}`,
} as const

export const PRICE_PRECISION = 1e8
export const COLLATERAL_PRECISION = 1e6
export const PERCENT_BASE = 1e4
