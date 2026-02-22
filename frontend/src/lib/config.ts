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

// Deployed on Avalanche Fuji Testnet — v7 Hub Features
export const CONTRACTS = {
  MockUSDC: '0xDa9103E3121784fba3e60f5a95304833a5A904f1' as `0x${string}`,
  MockWETH: '0x53bcf608A367661b3cafd4878624041F2ce522E3' as `0x${string}`,
  MockOracle: '0x6e1bebEf40dA65B2B5B39EFa1591a985C0EE884E' as `0x${string}`, // ChainlinkOracle
  ForwardMarket: '0x7De1970F024cB1c2953dCBc850E895c4637f57E9' as `0x${string}`,
  OrderBook: '0xd92Ff3f1FF6AAC7E298BcF9634eB907B9B7e7Bf9' as `0x${string}`,
  PositionManager: '0x7a867BC74482724C2B0b6F36DFb15f6691088a88' as `0x${string}`,
  InsuranceFund: '0x3BC01a6710CF2f8DBa2E4bfD8b6F4C7F553E3BFC' as `0x${string}`,
  TenorVault: '0x62Ef155a07EA3bF04e6930d40Ad1549F973fB37D' as `0x${string}`,
  CollateralManager: '0xE5586FF57d8602F980bf36eE9a9B99144cd15b66' as `0x${string}`,
} as const

export const PRICE_PRECISION = 1e8
export const COLLATERAL_PRECISION = 1e6
export const PERCENT_BASE = 1e4
