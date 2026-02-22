import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  type PublicClient,
  type WalletClient,
  type GetContractReturnType,
  type Transport,
  type Chain,
} from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

import {
  avalancheFuji,
  DEFAULT_RPC_URL,
  ADDRESSES,
  PRICE_DECIMALS,
  PRICE_PRECISION,
  COLLATERAL_PRECISION,
  PERCENT_BASE,
  PositionManagerABI,
  ForwardMarketABI,
  MockOracleABI,
  OrderBookABI,
  MockUsdcABI,
  InsuranceFundABI,
  TenorVaultABI,
  CollateralManagerABI,
} from './constants.js'

import type {
  TenorClientConfig,
  Market,
  Position,
  PriceData,
  TPSL,
  OrderBook,
  Order,
  Side,
  FeeConfig,
  FeeTotals,
  InsuranceFundHealth,
  VaultInfo,
  CollateralDeposit,
} from './types.js'

import { TimeInForce } from './types.js'

import { parsePrice } from './utils.js'

// ─── Helper: map raw contract tuples to typed SDK objects ────────

function mapPosition(raw: Record<string, unknown>): Position {
  return {
    id: raw.id as bigint,
    trader: raw.trader as `0x${string}`,
    marketId: raw.marketId as bigint,
    side: Number(raw.side) as Side,
    entryPrice: raw.entryPrice as bigint,
    size: raw.size as bigint,
    collateral: raw.collateral as bigint,
    timestamp: raw.timestamp as bigint,
    isOpen: raw.isOpen as boolean,
  }
}

function mapOrder(raw: Record<string, unknown>): Order {
  return {
    id: raw.id as bigint,
    trader: raw.trader as `0x${string}`,
    marketId: raw.marketId as bigint,
    side: Number(raw.side) as Side,
    price: raw.price as bigint,
    amount: raw.amount as bigint,
    filled: raw.filled as bigint,
    collateral: raw.collateral as bigint,
    timestamp: raw.timestamp as bigint,
    status: Number(raw.status),
    timeInForce: Number(raw.timeInForce) as TimeInForce,
  }
}

function mapMarket(raw: Record<string, unknown>): Market {
  return {
    id: raw.id as bigint,
    baseAsset: raw.baseAsset as string,
    quoteAsset: raw.quoteAsset as string,
    expiration: raw.expiration as bigint,
    ltv: raw.ltv as bigint,
    liquidationThreshold: raw.liquidationThreshold as bigint,
    minCollateral: raw.minCollateral as bigint,
    settlePrice: raw.settlePrice as bigint,
    settled: raw.settled as boolean,
    totalLongOI: raw.totalLongOI as bigint,
    totalShortOI: raw.totalShortOI as bigint,
  }
}

// ─── TenorClient ────────────────────────────────────────────────

/**
 * Main SDK client for interacting with Tenor Protocol on Avalanche Fuji.
 *
 * Provides both read-only methods (prices, markets, positions) and
 * write methods (trading, closing, TP/SL). Write methods require
 * a private key to be provided in the constructor config.
 *
 * @example
 * ```ts
 * import { TenorClient } from '@tenor-protocol/sdk'
 *
 * // Read-only client
 * const reader = new TenorClient({ rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc' })
 * const markets = await reader.getMarkets()
 *
 * // Full client with trading capabilities
 * const client = new TenorClient({ privateKey: '0x...' })
 * await client.placeMarketOrder(0n, 'long', 5n)
 * ```
 */
export class TenorClient {
  /** Viem public client for read operations */
  public readonly publicClient: PublicClient<Transport, Chain>
  /** Viem wallet client for write operations (undefined in read-only mode) */
  public readonly walletClient: WalletClient<Transport, Chain, PrivateKeyAccount> | undefined
  /** The connected account (undefined in read-only mode) */
  public readonly account: PrivateKeyAccount | undefined

  private readonly positionManager: GetContractReturnType<typeof PositionManagerABI, typeof this.publicClient>
  private readonly forwardMarket: GetContractReturnType<typeof ForwardMarketABI, typeof this.publicClient>
  private readonly oracle: GetContractReturnType<typeof MockOracleABI, typeof this.publicClient>
  private readonly orderBookContract: GetContractReturnType<typeof OrderBookABI, typeof this.publicClient>
  private readonly usdc: GetContractReturnType<typeof MockUsdcABI, typeof this.publicClient>

  constructor(config: TenorClientConfig = {}) {
    const rpcUrl = config.rpcUrl ?? DEFAULT_RPC_URL

    this.publicClient = createPublicClient({
      chain: avalancheFuji,
      transport: http(rpcUrl),
    }) as PublicClient<Transport, Chain>

    if (config.privateKey) {
      this.account = privateKeyToAccount(config.privateKey)
      this.walletClient = createWalletClient({
        account: this.account,
        chain: avalancheFuji,
        transport: http(rpcUrl),
      }) as WalletClient<Transport, Chain, PrivateKeyAccount>
    }

    // Initialize contract instances
    this.positionManager = getContract({
      address: ADDRESSES.PositionManager,
      abi: PositionManagerABI,
      client: this.publicClient,
    })

    this.forwardMarket = getContract({
      address: ADDRESSES.ForwardMarket,
      abi: ForwardMarketABI,
      client: this.publicClient,
    })

    this.oracle = getContract({
      address: ADDRESSES.Oracle,
      abi: MockOracleABI,
      client: this.publicClient,
    })

    this.orderBookContract = getContract({
      address: ADDRESSES.OrderBook,
      abi: OrderBookABI,
      client: this.publicClient,
    })

    this.usdc = getContract({
      address: ADDRESSES.MockUSDC,
      abi: MockUsdcABI,
      client: this.publicClient,
    })
  }

  // ─── Private helpers ────────────────────────────────────────

  private requireWallet(): WalletClient<Transport, Chain, PrivateKeyAccount> {
    if (!this.walletClient) {
      throw new Error('TenorClient: privateKey is required for write operations. Pass it in the constructor config.')
    }
    return this.walletClient
  }

  private async waitForTx(hash: `0x${string}`): Promise<string> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
      throw new Error(`Transaction reverted: ${hash}`)
    }
    return hash
  }

  // ─── Read methods ───────────────────────────────────────────

  /**
   * Fetch all forward markets.
   *
   * @returns Array of Market objects with full details (expiration, OI, settlement status, etc.)
   */
  async getMarkets(): Promise<Market[]> {
    const raw = await this.forwardMarket.read.getAllMarkets()
    return (raw as unknown as Record<string, unknown>[]).map(mapMarket)
  }

  /**
   * Fetch the current oracle price for an asset.
   *
   * @param asset - Asset symbol, e.g. "ETH", "BTC"
   * @returns Object with `price` (8 decimals) and `timestamp`
   */
  async getPrice(asset: string): Promise<PriceData> {
    const [price, timestamp] = await this.oracle.read.getPrice([asset])
    return { price, timestamp }
  }

  /**
   * Fetch all open positions, or open positions for a specific trader.
   *
   * When `trader` is provided, calls the on-chain `getUserOpenPositions` view.
   * Without `trader`, paginates through all open positions via `getOpenPositionIds`.
   *
   * @param trader - Optional wallet address to filter by
   */
  async getPositions(trader?: string): Promise<Position[]> {
    if (trader) {
      const raw = await this.publicClient.readContract({
        address: ADDRESSES.PositionManager,
        abi: PositionManagerABI,
        functionName: 'getUserOpenPositions',
        args: [trader as `0x${string}`],
      })
      return (raw as unknown as Record<string, unknown>[]).map(mapPosition)
    }

    // Paginate through all open positions
    const count = await this.positionManager.read.getOpenPositionCount()
    if (count === 0n) return []

    const total = Number(count)
    const pageSize = 50
    const positions: Position[] = []

    for (let offset = 0; offset < total; offset += pageSize) {
      const ids = await this.positionManager.read.getOpenPositionIds([BigInt(offset), BigInt(pageSize)])

      const calls = ids.map((id) => ({
        address: ADDRESSES.PositionManager,
        abi: PositionManagerABI,
        functionName: 'getPosition' as const,
        args: [id] as const,
      }))

      const results = await this.publicClient.multicall({ contracts: calls })

      for (const result of results) {
        if (result.status === 'success') {
          const p = mapPosition(result.result as unknown as Record<string, unknown>)
          if (p.isOpen) positions.push(p)
        }
      }
    }

    return positions
  }

  /**
   * Fetch a single position by ID.
   *
   * @param id - Position identifier
   */
  async getPosition(id: bigint): Promise<Position> {
    const raw = await this.positionManager.read.getPosition([id])
    return mapPosition(raw as unknown as Record<string, unknown>)
  }

  /**
   * Fetch the order book for a specific market.
   *
   * @param marketId - Market identifier
   * @returns Object with `bids` and `asks` arrays
   */
  async getOrderBook(marketId: bigint): Promise<OrderBook> {
    const [rawBids, rawAsks] = await this.orderBookContract.read.getOrderBook([marketId])
    return {
      bids: (rawBids as unknown as Record<string, unknown>[]).map(mapOrder),
      asks: (rawAsks as unknown as Record<string, unknown>[]).map(mapOrder),
    }
  }

  /**
   * Fetch the USDC balance for an address.
   * Defaults to the connected wallet address if none provided.
   *
   * @param address - Wallet address (defaults to connected account)
   * @returns Raw USDC balance (6 decimals)
   */
  async getBalance(address?: string): Promise<bigint> {
    const addr = address ?? this.account?.address
    if (!addr) {
      throw new Error('TenorClient: address is required (or pass privateKey in constructor)')
    }
    return await this.usdc.read.balanceOf([addr as `0x${string}`]) as bigint
  }

  /**
   * Fetch TP/SL levels for a position.
   *
   * @param positionId - Position identifier
   * @returns Object with `takeProfitPrice` and `stopLossPrice` (8 decimals, 0 = not set)
   */
  async getTPSL(positionId: bigint): Promise<TPSL> {
    const raw = await this.positionManager.read.getTPSL([positionId])
    const result = raw as unknown as Record<string, unknown>
    return {
      takeProfitPrice: result.takeProfitPrice as bigint,
      stopLossPrice: result.stopLossPrice as bigint,
    }
  }

  /**
   * Fetch the health factor for a position.
   * A position is liquidatable when health < 10000 (100%).
   *
   * @param positionId - Position identifier
   * @returns Health factor in basis points (10000 = 100%)
   */
  async getHealthFactor(positionId: bigint): Promise<bigint> {
    return await this.positionManager.read.getHealthFactor([positionId]) as bigint
  }

  // ─── Write methods ──────────────────────────────────────────

  /**
   * Place a limit order on the order book.
   *
   * Automatically approves USDC spending for the estimated collateral.
   *
   * @param marketId - Market to trade on
   * @param side - 'long' or 'short'
   * @param price - Limit price (8 decimals). Use `parsePrice("2500")` for convenience.
   * @param size - Number of contracts
   * @returns Transaction hash
   */
  async placeLimitOrder(
    marketId: bigint,
    side: 'long' | 'short',
    price: bigint,
    size: bigint,
  ): Promise<string> {
    const wallet = this.requireWallet()
    const sideNum = side === 'long' ? 0 : 1

    // Estimate collateral and approve
    const markets = await this.getMarkets()
    const market = markets.find((m) => m.id === marketId)
    if (!market) throw new Error(`Market ${marketId} not found`)

    const collateralEstimate =
      (size * price / PRICE_PRECISION) * COLLATERAL_PRECISION * PERCENT_BASE / market.ltv

    const approveHash = await wallet.writeContract({
      address: ADDRESSES.MockUSDC,
      abi: MockUsdcABI,
      functionName: 'approve',
      args: [ADDRESSES.OrderBook, collateralEstimate * 2n],
    })
    await this.waitForTx(approveHash)

    const hash = await wallet.writeContract({
      address: ADDRESSES.OrderBook,
      abi: OrderBookABI,
      functionName: 'placeLimitOrder',
      args: [marketId, sideNum, price, size],
    })
    return this.waitForTx(hash)
  }

  /**
   * Place a market order (executes at the best available price).
   *
   * Automatically fetches the oracle price for collateral estimation and approves USDC.
   *
   * @param marketId - Market to trade on
   * @param side - 'long' or 'short'
   * @param size - Number of contracts
   * @returns Transaction hash
   */
  async placeMarketOrder(
    marketId: bigint,
    side: 'long' | 'short',
    size: bigint,
  ): Promise<string> {
    const wallet = this.requireWallet()
    const sideNum = side === 'long' ? 0 : 1

    // Fetch market and oracle price for collateral estimation
    const markets = await this.getMarkets()
    const market = markets.find((m) => m.id === marketId)
    if (!market) throw new Error(`Market ${marketId} not found`)

    const { price: oraclePrice } = await this.getPrice(market.baseAsset)
    const collateralEstimate =
      (size * oraclePrice / PRICE_PRECISION) * COLLATERAL_PRECISION * PERCENT_BASE / market.ltv

    const approveHash = await wallet.writeContract({
      address: ADDRESSES.MockUSDC,
      abi: MockUsdcABI,
      functionName: 'approve',
      args: [ADDRESSES.OrderBook, collateralEstimate * 2n],
    })
    await this.waitForTx(approveHash)

    const hash = await wallet.writeContract({
      address: ADDRESSES.OrderBook,
      abi: OrderBookABI,
      functionName: 'placeMarketOrder',
      args: [marketId, sideNum, size],
    })
    return this.waitForTx(hash)
  }

  /**
   * Close a position (fully or partially).
   *
   * @param positionId - Position to close
   * @param percent - Percentage to close (1-100). Defaults to 100 (full close).
   * @returns Transaction hash
   */
  async closePosition(positionId: bigint, percent: number = 100): Promise<string> {
    const wallet = this.requireWallet()

    let closeSize = 0n // 0 = full close in the contract
    if (percent < 100) {
      const pos = await this.getPosition(positionId)
      closeSize = (pos.size * BigInt(percent)) / 100n
    }

    const hash = await wallet.writeContract({
      address: ADDRESSES.PositionManager,
      abi: PositionManagerABI,
      functionName: 'closePosition',
      args: [positionId, closeSize],
    })
    return this.waitForTx(hash)
  }

  /**
   * Set take-profit and/or stop-loss for a position.
   *
   * Pass 0n to leave a level unset or to clear it.
   *
   * @param positionId - Position to configure
   * @param tp - Take-profit price (8 decimals), 0n = unset
   * @param sl - Stop-loss price (8 decimals), 0n = unset
   * @returns Transaction hash
   */
  async setTPSL(positionId: bigint, tp: bigint, sl: bigint): Promise<string> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: ADDRESSES.PositionManager,
      abi: PositionManagerABI,
      functionName: 'setTPSL',
      args: [positionId, tp, sl],
    })
    return this.waitForTx(hash)
  }

  /**
   * Mint 10,000 test USDC from the faucet (testnet only).
   *
   * @returns Transaction hash
   */
  async mintTestUSDC(): Promise<string> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: ADDRESSES.MockUSDC,
      abi: MockUsdcABI,
      functionName: 'faucet',
      args: [],
    })
    return this.waitForTx(hash)
  }

  /**
   * Approve a spender to transfer USDC on your behalf.
   *
   * @param spender - Address to approve
   * @param amount - Amount to approve (6-decimal USDC)
   * @returns Transaction hash
   */
  async approveUSDC(spender: string, amount: bigint): Promise<string> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: ADDRESSES.MockUSDC,
      abi: MockUsdcABI,
      functionName: 'approve',
      args: [spender as `0x${string}`, amount],
    })
    return this.waitForTx(hash)
  }

  /**
   * Cancel an open order on the order book.
   *
   * @param orderId - Order to cancel
   * @returns Transaction hash
   */
  async cancelOrder(orderId: bigint): Promise<string> {
    const wallet = this.requireWallet()

    const hash = await wallet.writeContract({
      address: ADDRESSES.OrderBook,
      abi: OrderBookABI,
      functionName: 'cancelOrder',
      args: [orderId],
    })
    return this.waitForTx(hash)
  }

  // ─── Advanced order types ────────────────────────────────────

  /**
   * Place a limit order with advanced time-in-force options.
   *
   * @param marketId - Market to trade on
   * @param side - 'long' or 'short'
   * @param price - Limit price (8 decimals)
   * @param size - Number of contracts
   * @param tif - Time-in-force: GTC, IOC, FOK, or POST_ONLY
   * @returns Transaction hash
   */
  async placeLimitOrderAdvanced(
    marketId: bigint,
    side: 'long' | 'short',
    price: bigint,
    size: bigint,
    tif: TimeInForce,
  ): Promise<string> {
    const wallet = this.requireWallet()
    const sideNum = side === 'long' ? 0 : 1

    const markets = await this.getMarkets()
    const market = markets.find((m) => m.id === marketId)
    if (!market) throw new Error(`Market ${marketId} not found`)

    const collateralEstimate =
      (size * price / PRICE_PRECISION) * COLLATERAL_PRECISION * PERCENT_BASE / market.ltv

    const approveHash = await wallet.writeContract({
      address: ADDRESSES.MockUSDC,
      abi: MockUsdcABI,
      functionName: 'approve',
      args: [ADDRESSES.OrderBook, collateralEstimate * 2n],
    })
    await this.waitForTx(approveHash)

    const hash = await wallet.writeContract({
      address: ADDRESSES.OrderBook,
      abi: OrderBookABI,
      functionName: 'placeLimitOrderAdvanced',
      args: [marketId, sideNum, price, size, tif],
    })
    return this.waitForTx(hash)
  }

  // ─── Fee system ──────────────────────────────────────────────

  /** Fetch the current fee configuration. */
  async getFeeConfig(): Promise<FeeConfig> {
    const result = await this.publicClient.readContract({
      address: ADDRESSES.OrderBook,
      abi: OrderBookABI,
      functionName: 'getFeeConfig',
    })
    const r = result as unknown as bigint[]
    return {
      takerFeeBps: r[0], makerFeeBps: r[1],
      makerRebateEnabled: Boolean(r[2]),
      protocolFeeBps: r[3], insuranceFeeBps: r[4], lpFeeBps: r[5],
    }
  }

  /** Fetch cumulative fee totals. */
  async getFeeTotals(): Promise<FeeTotals> {
    const result = await this.publicClient.readContract({
      address: ADDRESSES.OrderBook,
      abi: OrderBookABI,
      functionName: 'getFeeTotals',
    })
    const r = result as unknown as bigint[]
    return {
      totalFeesCollected: r[0], totalProtocolFees: r[1],
      totalInsuranceFees: r[2], totalBuilderFees: r[3], totalMakerRebates: r[4],
    }
  }

  /** Set a builder referral code for the connected wallet. */
  async setBuilder(builder: string): Promise<string> {
    const wallet = this.requireWallet()
    const hash = await wallet.writeContract({
      address: ADDRESSES.OrderBook,
      abi: OrderBookABI,
      functionName: 'setBuilderForTrader',
      args: [this.account!.address, builder as `0x${string}`],
    })
    return this.waitForTx(hash)
  }

  // ─── Insurance fund ──────────────────────────────────────────

  /** Get the insurance fund USDC balance. */
  async getInsuranceFundBalance(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: ADDRESSES.InsuranceFund,
      abi: InsuranceFundABI,
      functionName: 'getBalance',
    }) as bigint
  }

  /** Get insurance fund health metrics. */
  async getInsuranceFundHealth(): Promise<InsuranceFundHealth> {
    const result = await this.publicClient.readContract({
      address: ADDRESSES.InsuranceFund,
      abi: InsuranceFundABI,
      functionName: 'getFundHealth',
    })
    const r = result as unknown as bigint[]
    return { balance: r[0], totalCovered: r[1], totalDeposited: r[2] }
  }

  // ─── Vault (TLP) ────────────────────────────────────────────

  /** Deposit USDC into the TLP vault. */
  async vaultDeposit(usdcAmount: bigint): Promise<string> {
    const wallet = this.requireWallet()
    const approveHash = await wallet.writeContract({
      address: ADDRESSES.MockUSDC,
      abi: MockUsdcABI,
      functionName: 'approve',
      args: [ADDRESSES.TenorVault, usdcAmount],
    })
    await this.waitForTx(approveHash)

    const hash = await wallet.writeContract({
      address: ADDRESSES.TenorVault,
      abi: TenorVaultABI,
      functionName: 'deposit',
      args: [usdcAmount],
    })
    return this.waitForTx(hash)
  }

  /** Request a withdrawal from the TLP vault. */
  async vaultRequestWithdraw(shares: bigint): Promise<string> {
    const wallet = this.requireWallet()
    const hash = await wallet.writeContract({
      address: ADDRESSES.TenorVault,
      abi: TenorVaultABI,
      functionName: 'requestWithdraw',
      args: [shares],
    })
    return this.waitForTx(hash)
  }

  /** Execute a pending vault withdrawal. */
  async vaultExecuteWithdraw(): Promise<string> {
    const wallet = this.requireWallet()
    const hash = await wallet.writeContract({
      address: ADDRESSES.TenorVault,
      abi: TenorVaultABI,
      functionName: 'executeWithdraw',
    })
    return this.waitForTx(hash)
  }

  /** Get vault info (share price, total value, etc.). */
  async getVaultInfo(): Promise<VaultInfo> {
    const [totalSupply, sharePrice, totalValue, depositCap, withdrawalDelay] = await Promise.all([
      this.publicClient.readContract({ address: ADDRESSES.TenorVault, abi: TenorVaultABI, functionName: 'totalSupply' }),
      this.publicClient.readContract({ address: ADDRESSES.TenorVault, abi: TenorVaultABI, functionName: 'sharePrice' }),
      this.publicClient.readContract({ address: ADDRESSES.TenorVault, abi: TenorVaultABI, functionName: 'totalValue' }),
      this.publicClient.readContract({ address: ADDRESSES.TenorVault, abi: TenorVaultABI, functionName: 'depositCap' }),
      this.publicClient.readContract({ address: ADDRESSES.TenorVault, abi: TenorVaultABI, functionName: 'withdrawalDelay' }),
    ])
    return {
      totalSupply: totalSupply as bigint,
      sharePrice: sharePrice as bigint,
      totalValue: totalValue as bigint,
      depositCap: depositCap as bigint,
      withdrawalDelay: withdrawalDelay as bigint,
    }
  }

  // ─── Multi-collateral ────────────────────────────────────────

  /** Deposit collateral token (e.g. WETH). */
  async depositCollateral(token: string, amount: bigint): Promise<string> {
    const wallet = this.requireWallet()
    // Approve the token first
    const approveHash = await wallet.writeContract({
      address: token as `0x${string}`,
      abi: MockUsdcABI, // ERC20 approve is the same
      functionName: 'approve',
      args: [ADDRESSES.CollateralManager, amount],
    })
    await this.waitForTx(approveHash)

    const hash = await wallet.writeContract({
      address: ADDRESSES.CollateralManager,
      abi: CollateralManagerABI,
      functionName: 'depositCollateral',
      args: [token as `0x${string}`, amount],
    })
    return this.waitForTx(hash)
  }

  /** Withdraw collateral token. */
  async withdrawCollateral(token: string, amount: bigint): Promise<string> {
    const wallet = this.requireWallet()
    const hash = await wallet.writeContract({
      address: ADDRESSES.CollateralManager,
      abi: CollateralManagerABI,
      functionName: 'withdrawCollateral',
      args: [token as `0x${string}`, amount],
    })
    return this.waitForTx(hash)
  }

  /** Get total collateral value in USD for a trader. */
  async getCollateralValue(trader?: string): Promise<bigint> {
    const addr = trader ?? this.account?.address
    if (!addr) throw new Error('TenorClient: address required')
    return await this.publicClient.readContract({
      address: ADDRESSES.CollateralManager,
      abi: CollateralManagerABI,
      functionName: 'getCollateralValueUSD',
      args: [addr as `0x${string}`],
    }) as bigint
  }
}
