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

// Deployed on Avalanche Fuji Testnet — v4 Chainlink Oracle + TP/SL + closePosition
export const CONTRACTS = {
  MockUSDC: '0xA41BCF380ff358c849619538fda0Dd38214E019d' as `0x${string}`,
  MockWETH: '0xC2DFD7581C9D27ac195C3873f12b93e7eCd4B24c' as `0x${string}`,
  MockOracle: '0x23196688CDc03348d712BBc2E74CeA4Eea1e60EB' as `0x${string}`, // ChainlinkOracle (same getPrice interface)
  ForwardMarket: '0x281dc4C64D2BF3508bA2670897f321a31F5e1e65' as `0x${string}`,
  OrderBook: '0x74AeE1AdBcE40B984beA4B09deAf581c6139cbC9' as `0x${string}`,
  PositionManager: '0xAB6b565384773C70da8D9e254aFB4B59d710eaD7' as `0x${string}`,
} as const

export const PRICE_PRECISION = 1e8
export const COLLATERAL_PRECISION = 1e6
export const PERCENT_BASE = 1e4
