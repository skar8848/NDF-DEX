import { createPublicClient, createWalletClient, http, defineChain, getContract } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { config } from './config.js'

export const avalancheFuji = defineChain({
  id: 43113,
  name: 'Avalanche Fuji',
  nativeCurrency: { decimals: 18, name: 'AVAX', symbol: 'AVAX' },
  rpcUrls: { default: { http: [config.rpcUrl] } },
  testnet: true,
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
})

export const account = privateKeyToAccount(config.keeperPrivateKey)

export const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http(config.rpcUrl),
})

export const walletClient = createWalletClient({
  account,
  chain: avalancheFuji,
  transport: http(config.rpcUrl),
})

// ─── ABIs (minimal, only what keeper needs) ──────────────────────

export const PositionManagerABI = [
  {
    type: 'function', name: 'getOpenPositionCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getOpenPositionIds',
    inputs: [{ name: 'offset', type: 'uint256' }, { name: 'limit', type: 'uint256' }],
    outputs: [{ type: 'uint256[]' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getPosition',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [{
      type: 'tuple', components: [
        { name: 'id', type: 'uint256' }, { name: 'trader', type: 'address' },
        { name: 'marketId', type: 'uint256' }, { name: 'side', type: 'uint8' },
        { name: 'entryPrice', type: 'uint256' }, { name: 'size', type: 'uint256' },
        { name: 'collateral', type: 'uint256' }, { name: 'timestamp', type: 'uint256' },
        { name: 'isOpen', type: 'bool' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getTPSL',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [{
      type: 'tuple', components: [
        { name: 'takeProfitPrice', type: 'uint256' },
        { name: 'stopLossPrice', type: 'uint256' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getHealthFactor',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'closePosition',
    inputs: [{ name: 'positionId', type: 'uint256' }, { name: 'closeSize', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'liquidate',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'settlePosition',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'setTPSL',
    inputs: [{ name: 'positionId', type: 'uint256' }, { name: 'tp', type: 'uint256' }, { name: 'sl', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'getUserOpenPositions',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{
      type: 'tuple[]', components: [
        { name: 'id', type: 'uint256' }, { name: 'trader', type: 'address' },
        { name: 'marketId', type: 'uint256' }, { name: 'side', type: 'uint8' },
        { name: 'entryPrice', type: 'uint256' }, { name: 'size', type: 'uint256' },
        { name: 'collateral', type: 'uint256' }, { name: 'timestamp', type: 'uint256' },
        { name: 'isOpen', type: 'bool' },
      ],
    }],
    stateMutability: 'view',
  },
] as const

export const ForwardMarketABI = [
  {
    type: 'function', name: 'getAllMarkets', inputs: [],
    outputs: [{
      type: 'tuple[]', components: [
        { name: 'id', type: 'uint256' }, { name: 'baseAsset', type: 'string' },
        { name: 'quoteAsset', type: 'string' }, { name: 'expiration', type: 'uint256' },
        { name: 'ltv', type: 'uint256' }, { name: 'liquidationThreshold', type: 'uint256' },
        { name: 'minCollateral', type: 'uint256' }, { name: 'settlePrice', type: 'uint256' },
        { name: 'settled', type: 'bool' }, { name: 'totalLongOI', type: 'uint256' },
        { name: 'totalShortOI', type: 'uint256' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'settleMarket',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
] as const

export const MockOracleABI = [
  {
    type: 'function', name: 'getPrice',
    inputs: [{ name: 'asset', type: 'string' }],
    outputs: [{ name: 'price', type: 'uint256' }, { name: 'timestamp', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export const OrderBookABI = [
  {
    type: 'function', name: 'placeLimitOrder',
    inputs: [
      { name: 'marketId', type: 'uint256' }, { name: 'side', type: 'uint8' },
      { name: 'price', type: 'uint256' }, { name: 'amount', type: 'uint256' },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'placeMarketOrder',
    inputs: [
      { name: 'marketId', type: 'uint256' }, { name: 'side', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'getOrderBook',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      {
        name: 'bids', type: 'tuple[]', components: [
          { name: 'id', type: 'uint256' }, { name: 'trader', type: 'address' },
          { name: 'marketId', type: 'uint256' }, { name: 'side', type: 'uint8' },
          { name: 'price', type: 'uint256' }, { name: 'amount', type: 'uint256' },
          { name: 'filled', type: 'uint256' }, { name: 'collateral', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' }, { name: 'status', type: 'uint8' },
        ],
      },
      {
        name: 'asks', type: 'tuple[]', components: [
          { name: 'id', type: 'uint256' }, { name: 'trader', type: 'address' },
          { name: 'marketId', type: 'uint256' }, { name: 'side', type: 'uint8' },
          { name: 'price', type: 'uint256' }, { name: 'amount', type: 'uint256' },
          { name: 'filled', type: 'uint256' }, { name: 'collateral', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' }, { name: 'status', type: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'cancelOrder',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
] as const

export const MockUsdcABI = [
  {
    type: 'function', name: 'faucet',
    inputs: [], outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'approve',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ type: 'bool' }], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'decimals',
    inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view',
  },
] as const

// ─── Contract instances ──────────────────────────────────────────

export const positionManager = getContract({
  address: config.addresses.positionManager,
  abi: PositionManagerABI,
  client: { public: publicClient, wallet: walletClient },
})

export const forwardMarket = getContract({
  address: config.addresses.forwardMarket,
  abi: ForwardMarketABI,
  client: { public: publicClient, wallet: walletClient },
})

export const oracleContract = getContract({
  address: config.addresses.mockOracle,
  abi: MockOracleABI,
  client: { public: publicClient },
})

export const orderBook = getContract({
  address: config.addresses.orderBook,
  abi: OrderBookABI,
  client: { public: publicClient, wallet: walletClient },
})

export const mockUsdc = getContract({
  address: config.addresses.mockUsdc,
  abi: MockUsdcABI,
  client: { public: publicClient, wallet: walletClient },
})
