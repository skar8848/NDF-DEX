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
        { name: 'settlementType', type: 'uint8' },
        { name: 'underlyingToken', type: 'address' },
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

export const MockWethABI = [
  {
    type: 'function', name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'faucet',
    inputs: [], outputs: [], stateMutability: 'nonpayable',
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
    type: 'function', name: 'placeLimitOrderAdvanced',
    inputs: [
      { name: 'marketId', type: 'uint256' }, { name: 'side', type: 'uint8' },
      { name: 'price', type: 'uint256' }, { name: 'amount', type: 'uint256' },
      { name: 'tif', type: 'uint8' },
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
          { name: 'timeInForce', type: 'uint8' },
        ],
      },
      {
        name: 'asks', type: 'tuple[]', components: [
          { name: 'id', type: 'uint256' }, { name: 'trader', type: 'address' },
          { name: 'marketId', type: 'uint256' }, { name: 'side', type: 'uint8' },
          { name: 'price', type: 'uint256' }, { name: 'amount', type: 'uint256' },
          { name: 'filled', type: 'uint256' }, { name: 'collateral', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' }, { name: 'status', type: 'uint8' },
          { name: 'timeInForce', type: 'uint8' },
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
  {
    type: 'function', name: 'getFeeConfig',
    inputs: [],
    outputs: [
      { name: '_takerFeeBps', type: 'uint256' }, { name: '_makerFeeBps', type: 'uint256' },
      { name: '_makerRebateEnabled', type: 'bool' }, { name: '_protocolFeeBps', type: 'uint256' },
      { name: '_insuranceFeeBps', type: 'uint256' }, { name: '_lpFeeBps', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getFeeTotals',
    inputs: [],
    outputs: [
      { name: '_totalFeesCollected', type: 'uint256' }, { name: '_totalProtocolFees', type: 'uint256' },
      { name: '_totalInsuranceFees', type: 'uint256' }, { name: '_totalBuilderFees', type: 'uint256' },
      { name: '_totalMakerRebates', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getOrder',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [{
      type: 'tuple', components: [
        { name: 'id', type: 'uint256' }, { name: 'trader', type: 'address' },
        { name: 'marketId', type: 'uint256' }, { name: 'side', type: 'uint8' },
        { name: 'price', type: 'uint256' }, { name: 'amount', type: 'uint256' },
        { name: 'filled', type: 'uint256' }, { name: 'collateral', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' }, { name: 'status', type: 'uint8' },
        { name: 'timeInForce', type: 'uint8' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getUserOrders',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{
      type: 'tuple[]', components: [
        { name: 'id', type: 'uint256' }, { name: 'trader', type: 'address' },
        { name: 'marketId', type: 'uint256' }, { name: 'side', type: 'uint8' },
        { name: 'price', type: 'uint256' }, { name: 'amount', type: 'uint256' },
        { name: 'filled', type: 'uint256' }, { name: 'collateral', type: 'uint256' },
        { name: 'timestamp', type: 'uint256' }, { name: 'status', type: 'uint8' },
        { name: 'timeInForce', type: 'uint8' },
      ],
    }],
    stateMutability: 'view',
  },
] as const

export const InsuranceFundABI = [
  {
    type: 'function', name: 'getBalance',
    inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getFundHealth',
    inputs: [],
    outputs: [
      { name: 'balance', type: 'uint256' },
      { name: '_totalCovered', type: 'uint256' },
      { name: '_totalDeposited', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const

export const TenorVaultABI = [
  {
    type: 'function', name: 'deposit',
    inputs: [{ name: 'usdcAmount', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'requestWithdraw',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'executeWithdraw',
    inputs: [], outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'sharePrice',
    inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'totalSupply',
    inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'totalValue',
    inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'cancelWithdraw',
    inputs: [], outputs: [], stateMutability: 'nonpayable',
  },
] as const

export const CollateralManagerABI = [
  {
    type: 'function', name: 'depositCollateral',
    inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'withdrawCollateral',
    inputs: [{ name: 'token', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'getCollateralValueUSD',
    inputs: [{ name: 'trader', type: 'address' }],
    outputs: [{ name: 'totalUSD', type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'getDeposit',
    inputs: [{ name: 'trader', type: 'address' }, { name: 'token', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }, { name: 'valueUSD', type: 'uint256' }],
    stateMutability: 'view',
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

export const mockWeth = getContract({
  address: config.addresses.mockWeth,
  abi: MockWethABI,
  client: { public: publicClient, wallet: walletClient },
})
