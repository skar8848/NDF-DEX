import { defineChain } from 'viem'

// ─── Chain ──────────────────────────────────────────────────────

export const AVALANCHE_FUJI_CHAIN_ID = 43113

export const DEFAULT_RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc'

export const avalancheFuji = defineChain({
  id: AVALANCHE_FUJI_CHAIN_ID,
  name: 'Avalanche Fuji',
  nativeCurrency: { decimals: 18, name: 'AVAX', symbol: 'AVAX' },
  rpcUrls: { default: { http: [DEFAULT_RPC_URL] } },
  testnet: true,
  blockExplorers: {
    default: { name: 'Snowtrace', url: 'https://testnet.snowtrace.io' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
})

// ─── Contract addresses (v4 Fuji) ──────────────────────────────

export const ADDRESSES = {
  MockUSDC: '0xDa9103E3121784fba3e60f5a95304833a5A904f1' as `0x${string}`,
  MockWETH: '0x53bcf608A367661b3cafd4878624041F2ce522E3' as `0x${string}`,
  Oracle: '0x6e1bebEf40dA65B2B5B39EFa1591a985C0EE884E' as `0x${string}`,
  ForwardMarket: '0x7De1970F024cB1c2953dCBc850E895c4637f57E9' as `0x${string}`,
  OrderBook: '0xd92Ff3f1FF6AAC7E298BcF9634eB907B9B7e7Bf9' as `0x${string}`,
  PositionManager: '0x7a867BC74482724C2B0b6F36DFb15f6691088a88' as `0x${string}`,
  InsuranceFund: '0x3BC01a6710CF2f8DBa2E4bfD8b6F4C7F553E3BFC' as `0x${string}`,
  TenorVault: '0x62Ef155a07EA3bF04e6930d40Ad1549F973fB37D' as `0x${string}`,
  CollateralManager: '0xE5586FF57d8602F980bf36eE9a9B99144cd15b66' as `0x${string}`,
} as const

// ─── Precision constants (match Solidity contracts) ─────────────

/** Price values use 8 decimal places (1e8) */
export const PRICE_DECIMALS = 8
/** Price precision multiplier */
export const PRICE_PRECISION = 10n ** 8n

/** USDC uses 6 decimal places (1e6) */
export const USDC_DECIMALS = 6
/** USDC (collateral) precision multiplier */
export const COLLATERAL_PRECISION = 10n ** 6n

/** Percentage base in basis points (1e4 = 100%) */
export const PERCENT_BASE = 10n ** 4n

// ─── ABIs ───────────────────────────────────────────────────────

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
        { name: 'settlementType', type: 'uint8' }, { name: 'underlyingToken', type: 'address' },
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
    type: 'function', name: 'setBuilderForTrader',
    inputs: [{ name: '_trader', type: 'address' }, { name: '_builder', type: 'address' }],
    outputs: [], stateMutability: 'nonpayable',
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
  {
    type: 'function', name: 'deposit',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable',
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
    type: 'function', name: 'depositCap',
    inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view',
  },
  {
    type: 'function', name: 'withdrawalDelay',
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
  {
    type: 'function', name: 'getSupportedTokens',
    inputs: [], outputs: [{ type: 'address[]' }], stateMutability: 'view',
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
