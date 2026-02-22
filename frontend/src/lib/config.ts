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

// Deployed on Avalanche Fuji Testnet — v6 Physical Delivery + Security
export const CONTRACTS = {
  MockUSDC: '0x2395F7aB842a3B91634214E5d1D841c7DD0D30D9' as `0x${string}`,
  MockWETH: '0x0eF47d0c930BF6D4ABbE165CeB8823139e1B8E97' as `0x${string}`,
  MockOracle: '0x2413750CA5c7a48048b1295C2397003057EAf2ab' as `0x${string}`, // ChainlinkOracle
  ForwardMarket: '0xf513AB1d36D179E9910070b6049249CD397Cd572' as `0x${string}`,
  OrderBook: '0xCe34E18C1Cd5A3E04B997592dBc3272A58beEcAC' as `0x${string}`,
  PositionManager: '0xe6a05bA11CD37A46E78eBE2f638b36dCA1c1ED17' as `0x${string}`,
} as const

export const PRICE_PRECISION = 1e8
export const COLLATERAL_PRECISION = 1e6
export const PERCENT_BASE = 1e4
