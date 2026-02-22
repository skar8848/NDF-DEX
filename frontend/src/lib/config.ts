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

// Deployed on Avalanche Fuji Testnet (Chainlink Oracle)
export const CONTRACTS = {
  MockUSDC: '0xA1a3A90C40B144f3F664655077adF054b3B89EbC' as `0x${string}`,
  MockWETH: '0xE36Ae40626F62b48713FF8264cb4E5B679e36122' as `0x${string}`,
  MockOracle: '0xF5Cd6da71aDDB47C13e2D77A52FdD2364E301ACC' as `0x${string}`,
  ForwardMarket: '0x567f4510e306C6aFB339cF802b8D6a9d0b3fdea8' as `0x${string}`,
  OrderBook: '0xb77e03293f30Aaf5BA7756f3F532b279Ce7afDE0' as `0x${string}`,
  PositionManager: '0xEC53377E2af877728C51d870b087C3A11f08DFb2' as `0x${string}`,
} as const

export const PRICE_PRECISION = 1e8
export const COLLATERAL_PRECISION = 1e6
export const PERCENT_BASE = 1e4
