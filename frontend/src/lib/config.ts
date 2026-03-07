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

// Deployed on Avalanche Fuji Testnet — v8 Multi-Collateral
export const CONTRACTS = {
  MockUSDC: '0x4a9Cc53548eBbEfb31bC2189FA5f2aBb48A3335a' as `0x${string}`,
  MockUSDT: '0x2867e9A5a9db4115E9e7AE9747ea50bd12DeD9Ed' as `0x${string}`,
  MockAUSD: '0x5052262e7AfFF6befD734551114d90bd56218C54' as `0x${string}`,
  MockWETH: '0x46cf521d854cEcF81073c9fE955Ffd99209C9069' as `0x${string}`,
  MockOracle: '0xf5EfBaf278268B4A82A46DC51C0132Ab5861b4ae' as `0x${string}`, // ChainlinkOracle
  ForwardMarket: '0x0d51Bb1c3eEE7C0573B6b2D905a287372d6301E1' as `0x${string}`,
  OrderBook: '0x463e3d633FC591ed02900Afd041Bcf7EdfE9DCB1' as `0x${string}`,
  PositionManager: '0x3fd14cb5dc574986004973254186aDbB2CE4A900' as `0x${string}`,
  InsuranceFund: '0x85fCaB9Cb3FCE04ED277190c9c09cDC5178B9Ca0' as `0x${string}`,
  TenorVault: '0xEac92864c8D56e02d076981EaaD6aeCc6b7D93B0' as `0x${string}`,
  CollateralManager: '0xc42e2d1e47eA74d5B9CF0eb70806D7a4169D66e0' as `0x${string}`,
} as const

// Supported collateral tokens for trading
export const COLLATERAL_TOKENS = [
  { address: CONTRACTS.MockUSDC, symbol: 'USDC', decimals: 6 },
  { address: CONTRACTS.MockUSDT, symbol: 'USDT', decimals: 6 },
  { address: CONTRACTS.MockAUSD, symbol: 'AUSD', decimals: 6 },
] as const

export const PRICE_PRECISION = 1e8
export const COLLATERAL_PRECISION = 1e6
export const PERCENT_BASE = 1e4
