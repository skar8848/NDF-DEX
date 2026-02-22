import { useState, useMemo, useEffect } from 'react'
import { useAccount } from 'wagmi'
import {
  usePlaceLimitOrder,
  usePlaceMarketOrder,
  useApproveUSDC,
  useUSDCBalance,
  useUSDCAllowance,
} from '../../hooks/useOrderBook'
import { useOraclePrice } from '../../hooks/usePriceData'
import { CONTRACTS, PRICE_PRECISION, COLLATERAL_PRECISION, PERCENT_BASE } from '../../lib/config'
import { formatUSDC, parsePrice } from '../../lib/utils'
import { cn } from '../../lib/utils'
import type { MarketInfo } from '../../hooks/useForwardMarket'

type TradeFormProps = {
  marketId: bigint
  market: MarketInfo | null
}

type OrderSide = 'long' | 'short'
type OrderType = 'limit' | 'market'

export function TradeForm({ marketId, market }: TradeFormProps) {
  const { address, isConnected } = useAccount()

  const [side, setSide] = useState<OrderSide>('long')
  const [orderType, setOrderType] = useState<OrderType>('limit')
  const [priceInput, setPriceInput] = useState('')
  const [sizeInput, setSizeInput] = useState('')

  const { data: balanceData } = useUSDCBalance()
  const { data: allowanceData } = useUSDCAllowance()
  const balance = (balanceData as bigint) ?? 0n
  const allowance = (allowanceData as bigint) ?? 0n

  const {
    placeLimitOrder,
    isPending: isLimitPending,
    isConfirming: isLimitConfirming,
    isSuccess: isLimitSuccess,
  } = usePlaceLimitOrder()

  const {
    placeMarketOrder,
    isPending: isMarketPending,
    isConfirming: isMarketConfirming,
    isSuccess: isMarketSuccess,
  } = usePlaceMarketOrder()

  const {
    approve,
    isPending: isApprovePending,
    isConfirming: isApproveConfirming,
  } = useApproveUSDC()

  // Fetch oracle price for market order collateral estimation
  const { data: oraclePriceData } = useOraclePrice(market?.baseAsset ?? '')
  const oraclePrice = useMemo(() => {
    if (!oraclePriceData) return 0n
    try { return (oraclePriceData as [bigint, bigint])[0] } catch { return 0n }
  }, [oraclePriceData])

  // Reset form on success
  useEffect(() => {
    if (isLimitSuccess || isMarketSuccess) {
      setPriceInput('')
      setSizeInput('')
    }
  }, [isLimitSuccess, isMarketSuccess])

  // Calculate collateral required
  const collateralRequired = useMemo(() => {
    if (!market) return 0n
    const size = sizeInput ? BigInt(Math.floor(Number(sizeInput))) : 0n
    if (size === 0n) return 0n

    const ltv = market.ltv > 0n ? market.ltv : BigInt(PERCENT_BASE)

    if (orderType === 'market') {
      // Market orders use 2x oracle price for collateral (matches contract logic)
      if (oraclePrice === 0n) return 0n
      const collateral = (oraclePrice * 2n * size / BigInt(PRICE_PRECISION))
        * BigInt(COLLATERAL_PRECISION) * BigInt(PERCENT_BASE) / ltv
      return collateral
    } else {
      const price = priceInput ? parsePrice(priceInput) : 0n
      if (price === 0n) return 0n
      // Match contract formula: amount * price / PRICE_PRECISION * COLLATERAL_PRECISION * PERCENT_BASE / ltv
      const collateral = (price * size / BigInt(PRICE_PRECISION))
        * BigInt(COLLATERAL_PRECISION) * BigInt(PERCENT_BASE) / ltv
      return collateral
    }
  }, [priceInput, sizeInput, market, orderType, oraclePrice])

  const needsApproval = collateralRequired > 0n && allowance < collateralRequired

  const isPending = isLimitPending || isMarketPending
  const isConfirming = isLimitConfirming || isMarketConfirming

  function handleApprove() {
    // Approve max uint256
    const maxUint = 2n ** 256n - 1n
    approve(CONTRACTS.OrderBook, maxUint)
  }

  function handlePlaceOrder() {
    if (!isConnected || !address) return

    const sideEnum = side === 'long' ? 0 : 1
    const size = BigInt(Math.floor(Number(sizeInput)))

    if (orderType === 'limit') {
      const price = parsePrice(priceInput)
      if (price === 0n || size === 0n) return
      placeLimitOrder(marketId, sideEnum, price, size)
    } else {
      if (size === 0n) return
      placeMarketOrder(marketId, sideEnum, size)
    }
  }

  const isFormValid = useMemo(() => {
    const size = Number(sizeInput)
    if (!size || size <= 0) return false
    if (orderType === 'limit') {
      const price = Number(priceInput)
      if (!price || price <= 0) return false
    }
    return true
  }, [priceInput, sizeInput, orderType])

  return (
    <div className="flex flex-col h-full">
      {/* Side tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-surface-2 rounded-lg mx-3 mt-3">
        <button
          onClick={() => setSide('long')}
          className={cn(
            'py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer',
            side === 'long'
              ? 'bg-long text-white'
              : 'text-text-secondary hover:text-text'
          )}
        >
          Long
        </button>
        <button
          onClick={() => setSide('short')}
          className={cn(
            'py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer',
            side === 'short'
              ? 'bg-short text-white'
              : 'text-text-secondary hover:text-text'
          )}
        >
          Short
        </button>
      </div>

      {/* Order type toggle */}
      <div className="flex gap-1 px-3 mt-3">
        <button
          onClick={() => setOrderType('limit')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer',
            orderType === 'limit'
              ? 'bg-surface-2 text-text border border-border'
              : 'text-text-secondary hover:text-text'
          )}
        >
          Limit
        </button>
        <button
          onClick={() => setOrderType('market')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer',
            orderType === 'market'
              ? 'bg-surface-2 text-text border border-border'
              : 'text-text-secondary hover:text-text'
          )}
        >
          Market
        </button>
      </div>

      {/* Form inputs */}
      <div className="flex-1 px-3 mt-3 space-y-3">
        {/* Price input (limit only) */}
        {orderType === 'limit' && (
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Price (USD)</label>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                step="0.01"
                min="0"
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
                USD
              </span>
            </div>
          </div>
        )}

        {/* Size input */}
        <div>
          <label className="block text-xs text-text-secondary mb-1.5">
            Size (contracts)
          </label>
          <div className="relative">
            <input
              type="number"
              placeholder="0"
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              step="1"
              min="0"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
              Contracts
            </span>
          </div>
        </div>

        {/* Collateral info */}
        <div className="bg-surface-2 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Collateral Required</span>
            <span className="text-text font-mono">
              {collateralRequired > 0n ? `$${formatUSDC(collateralRequired)}` : '--'}
            </span>
          </div>
          {market && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">LTV</span>
              <span className="text-text font-mono">
                {(Number(market.ltv) / (PERCENT_BASE / 100)).toFixed(0)}%
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Order Type</span>
            <span className="text-text">
              {orderType === 'market' ? 'Market (IOC)' : 'Limit'}
            </span>
          </div>
          {orderType === 'market' && (
            <p className="text-[10px] text-text-secondary/60 mt-1">
              Fills instantly or cancels. Requires 2x oracle price collateral.
            </p>
          )}
        </div>
      </div>

      {/* Bottom section */}
      <div className="px-3 pb-3 mt-auto space-y-2">
        {/* Balance */}
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-text-secondary">USDC Balance</span>
          <span className="text-text font-mono">
            {isConnected ? `$${formatUSDC(balance)}` : '--'}
          </span>
        </div>

        {/* Action buttons */}
        {!isConnected ? (
          <div className="w-full py-3 text-center text-sm text-text-secondary bg-surface-2 rounded-lg border border-border">
            Connect wallet to trade
          </div>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={isApprovePending || isApproveConfirming}
            className="w-full py-3 text-sm font-semibold rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isApprovePending
              ? 'Confirm in wallet...'
              : isApproveConfirming
              ? 'Approving...'
              : 'Approve USDC'}
          </button>
        ) : (
          <button
            onClick={handlePlaceOrder}
            disabled={!isFormValid || isPending || isConfirming}
            className={cn(
              'w-full py-3 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
              side === 'long'
                ? 'bg-long hover:bg-long/90'
                : 'bg-short hover:bg-short/90'
            )}
          >
            {isPending
              ? 'Confirm in wallet...'
              : isConfirming
              ? 'Placing order...'
              : `${side === 'long' ? 'Long' : 'Short'} ${market?.baseAsset ?? ''}`}
          </button>
        )}
      </div>
    </div>
  )
}
