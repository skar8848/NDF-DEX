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
    default: { http: ['https://api.avax-test.network/ext/bc/C/rpc'] },
  },
  blockExplorers: {
    default: { name: 'SnowTrace', url: 'https://testnet.snowtrace.io' },
  },
  testnet: true,
})

// Deployed on Avalanche Fuji Testnet
export const CONTRACTS = {
  MockUSDC: '0x47f5a33714a84178F83f65Be6ecBcB79ACe6ef44' as `0x${string}`,
  MockWETH: '0x06618AE2Ca9a684431e20A4be056a74A9Dc25A10' as `0x${string}`,
  MockOracle: '0x05B2512B64E43b44d94a6241d3745d5965c700d9' as `0x${string}`,
  ForwardMarket: '0x9BB9CD8a6Caeaa06cBdB35FAc37D88C3b7b3DfC2' as `0x${string}`,
  OrderBook: '0xc6727c3cF00e374d72B1348173E4308083BC97e2' as `0x${string}`,
  PositionManager: '0xBDb0b90825b4d5f8dA0A9D54fb2E72EA02618C56' as `0x${string}`,
} as const

export const PRICE_PRECISION = 1e8
export const COLLATERAL_PRECISION = 1e6
export const PERCENT_BASE = 1e4
