import { useState, useMemo, useEffect, useCallback } from 'react'
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

const MAX_UINT256 = 2n ** 256n - 1n
const ONE_CT_THRESHOLD = 2n ** 128n

type TradeFormProps = {
  marketId: bigint
  market: MarketInfo | null
  externalPrice?: string | null
  onExternalPriceConsumed?: () => void
}

type OrderSide = 'long' | 'short'
type OrderType = 'limit' | 'market'

export function TradeForm({ marketId, market, externalPrice, onExternalPriceConsumed }: TradeFormProps) {
  const { address, isConnected } = useAccount()

  const [side, setSide] = useState<OrderSide>('long')
  const [orderType, setOrderType] = useState<OrderType>('limit')
  const [priceInput, setPriceInput] = useState('')
  const [sizeInput, setSizeInput] = useState('')
  const [dismissed1CT, setDismissed1CT] = useState(false)

  const { data: balanceData } = useUSDCBalance()
  const { data: allowanceData, isLoading: allowanceLoading } = useUSDCAllowance()
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

  const is1CTEnabled = allowance >= ONE_CT_THRESHOLD

  // Show 1CT prompt: connected, allowance loaded, not yet approved, not dismissed
  const show1CTPrompt = isConnected && !allowanceLoading && !is1CTEnabled && !dismissed1CT

  const handleEnable1CT = useCallback(() => {
    approve(CONTRACTS.OrderBook, MAX_UINT256)
  }, [approve])

  const handleRevoke1CT = useCallback(() => {
    approve(CONTRACTS.OrderBook, 0n)
  }, [approve])

  const { data: oraclePriceData } = useOraclePrice(market?.baseAsset ?? '')
  const oraclePrice = useMemo(() => {
    if (!oraclePriceData) return 0n
    try { return (oraclePriceData as [bigint, bigint])[0] } catch { return 0n }
  }, [oraclePriceData])

  useEffect(() => {
    if (isLimitSuccess || isMarketSuccess) {
      setPriceInput('')
      setSizeInput('')
    }
  }, [isLimitSuccess, isMarketSuccess])

  useEffect(() => {
    if (externalPrice) {
      setPriceInput(externalPrice)
      setOrderType('limit')
      onExternalPriceConsumed?.()
    }
  }, [externalPrice, onExternalPriceConsumed])

  // Reset dismissed state when wallet disconnects
  useEffect(() => {
    if (!isConnected) setDismissed1CT(false)
  }, [isConnected])

  const collateralRequired = useMemo(() => {
    if (!market) return 0n
    const size = sizeInput ? BigInt(Math.floor(Number(sizeInput))) : 0n
    if (size === 0n) return 0n
    const ltv = market.ltv > 0n ? market.ltv : BigInt(PERCENT_BASE)
    if (orderType === 'market') {
      if (oraclePrice === 0n) return 0n
      return (oraclePrice * 2n * size / BigInt(PRICE_PRECISION))
        * BigInt(COLLATERAL_PRECISION) * BigInt(PERCENT_BASE) / ltv
    } else {
      const price = priceInput ? parsePrice(priceInput) : 0n
      if (price === 0n) return 0n
      return (price * size / BigInt(PRICE_PRECISION))
        * BigInt(COLLATERAL_PRECISION) * BigInt(PERCENT_BASE) / ltv
    }
  }, [priceInput, sizeInput, market, orderType, oraclePrice])

  const isPending = isLimitPending || isMarketPending
  const isConfirming = isLimitConfirming || isMarketConfirming

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
    <div className="px-3 py-3 space-y-2.5">
      {/* 1CT Prompt - shown once on first connect if not approved */}
      {show1CTPrompt && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-xs font-semibold text-text">Enable 1-Click Trading?</span>
          </div>
          <p className="text-[10px] text-text-secondary leading-relaxed">
            Approve USDC once to skip the approval step on every trade. You'll only sign one transaction per order instead of two.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleEnable1CT}
              disabled={isApprovePending || isApproveConfirming}
              className="flex-1 py-1.5 text-xs font-semibold rounded-md bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isApprovePending ? 'Confirm in wallet...' : isApproveConfirming ? 'Enabling...' : 'Enable'}
            </button>
            <button
              onClick={() => setDismissed1CT(true)}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text transition-colors cursor-pointer"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Side tabs */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-surface-2 rounded-lg">
        <button
          onClick={() => setSide('long')}
          className={cn(
            'py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer',
            side === 'long' ? 'bg-long text-white' : 'text-text-secondary hover:text-text'
          )}
        >
          Long
        </button>
        <button
          onClick={() => setSide('short')}
          className={cn(
            'py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer',
            side === 'short' ? 'bg-short text-white' : 'text-text-secondary hover:text-text'
          )}
        >
          Short
        </button>
      </div>

      {/* Order type */}
      <div className="flex gap-1">
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

      {/* Price input (limit only) */}
      {orderType === 'limit' && (
        <div>
          <label className="block text-xs text-text-secondary mb-1">Price (USD)</label>
          <div className="relative">
            <input
              type="number"
              placeholder="0.00"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              step="0.01"
              min="0"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">USD</span>
          </div>
        </div>
      )}

      {/* Size input */}
      <div>
        <label className="block text-xs text-text-secondary mb-1">Size (contracts)</label>
        <div className="relative">
          <input
            type="number"
            placeholder="0"
            value={sizeInput}
            onChange={(e) => setSizeInput(e.target.value)}
            step="1"
            min="0"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">Contracts</span>
        </div>
      </div>

      {/* Summary box */}
      <div className="bg-surface-2 rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">Collateral</span>
          <span className="text-text font-mono">
            {collateralRequired > 0n ? `$${formatUSDC(collateralRequired)}` : '--'}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary flex items-center gap-1">
            <img src="/logos/USDC_Logo.png" alt="USDC" className="w-3.5 h-3.5 rounded-full" />
            Balance
          </span>
          <span className="text-text font-mono">
            {isConnected ? `$${formatUSDC(balance)}` : '--'}
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
        {isConnected && (
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
            <span className="text-text-secondary flex items-center gap-1">
              1-Click Trading
              {is1CTEnabled && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
            </span>
            {is1CTEnabled ? (
              <button
                onClick={handleRevoke1CT}
                disabled={isApprovePending || isApproveConfirming}
                className="text-[10px] text-danger/70 hover:text-danger transition-colors cursor-pointer disabled:opacity-50"
              >
                {isApprovePending || isApproveConfirming ? 'Revoking...' : 'Revoke'}
              </button>
            ) : (
              <button
                onClick={handleEnable1CT}
                disabled={isApprovePending || isApproveConfirming}
                className="text-[10px] text-primary hover:text-primary-hover transition-colors cursor-pointer disabled:opacity-50"
              >
                {isApprovePending || isApproveConfirming ? 'Enabling...' : 'Enable'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action button */}
      {!isConnected ? (
        <div className="w-full py-2.5 text-center text-sm text-text-secondary bg-surface-2 rounded-lg border border-border">
          Connect wallet to trade
        </div>
      ) : !is1CTEnabled && !dismissed1CT ? (
        /* If 1CT not enabled and prompt not dismissed, the prompt above handles it */
        <div className="w-full py-2.5 text-center text-[10px] text-text-secondary">
          Enable 1-Click Trading above to start
        </div>
      ) : (
        <button
          onClick={handlePlaceOrder}
          disabled={!isFormValid || isPending || isConfirming}
          className={cn(
            'w-full py-2.5 text-sm font-semibold rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
            side === 'long' ? 'bg-long hover:bg-long/90' : 'bg-short hover:bg-short/90'
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
  )
}
