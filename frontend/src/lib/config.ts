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

// Deployed on Avalanche Fuji Testnet — v3 Chainlink Oracle + TP/SL + closePosition
export const CONTRACTS = {
  MockUSDC: '0x9d3BeD39165c91a8F056FCF317E6fd70dbEeCe6F' as `0x${string}`,
  MockWETH: '0x8b4c8156b9740b0C8cd4CC73A63056fa2A470452' as `0x${string}`,
  MockOracle: '0x9d0a00Fb789687dCDd09245Cd507faAed4db1bA1' as `0x${string}`, // ChainlinkOracle (same getPrice interface)
  ForwardMarket: '0x57D34869d4c13043fA99fEd63EB95B252cb70685' as `0x${string}`,
  OrderBook: '0xD3d69b216207AA3580EDC3C1a610DA8c3d86543b' as `0x${string}`,
  PositionManager: '0xB2FA1e681616c63E242c17323D80BaDAa0B0Ed27' as `0x${string}`,
} as const

export const PRICE_PRECISION = 1e8
export const COLLATERAL_PRECISION = 1e6
export const PERCENT_BASE = 1e4
