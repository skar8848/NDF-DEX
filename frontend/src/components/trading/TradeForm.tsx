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
import { useUserOpenPositions } from '../../hooks/usePositions'
import { CONTRACTS, PRICE_PRECISION, COLLATERAL_PRECISION, PERCENT_BASE } from '../../lib/config'
import { formatUSDC, formatPrice, parsePrice } from '../../lib/utils'
import { cn } from '../../lib/utils'
import type { MarketInfo } from '../../hooks/useForwardMarket'

const MAX_UINT256 = 2n ** 256n - 1n
const ONE_CT_THRESHOLD = 2n ** 128n

type TradeFormProps = {
  marketId: bigint
  market: MarketInfo | null
  externalPrice?: string | null
  onExternalPriceConsumed?: () => void
  bestBid?: bigint | null
  bestAsk?: bigint | null
  bookDepthAsk?: bigint  // total ask-side liquidity (for long market orders)
  bookDepthBid?: bigint  // total bid-side liquidity (for short market orders)
}

type OrderSide = 'long' | 'short'
type OrderType = 'limit' | 'market'

export function TradeForm({ marketId, market, externalPrice, onExternalPriceConsumed, bestBid, bestAsk, bookDepthAsk, bookDepthBid }: TradeFormProps) {
  const { address, isConnected } = useAccount()

  const [side, setSide] = useState<OrderSide>('long')
  const [orderType, setOrderType] = useState<OrderType>('limit')
  const [priceInput, setPriceInput] = useState('')
  const [sizeInput, setSizeInput] = useState('')
  const [dismissed1CT, setDismissed1CT] = useState(false)
  const [slippageBps, setSlippageBps] = useState(50) // 0.5% default
  const [showSlippageMenu, setShowSlippageMenu] = useState(false)

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

  // Current open positions for this market
  const { data: openPositionsData } = useUserOpenPositions()
  const currentPosition = useMemo(() => {
    if (!openPositionsData) return null
    const positions = openPositionsData as unknown as { id: bigint; marketId: bigint; side: number; size: bigint; collateral: bigint; entryPrice: bigint }[]
    const matching = positions.filter(p => p.marketId === marketId)
    if (matching.length === 0) return null
    let longSize = 0n
    let shortSize = 0n
    for (const p of matching) {
      if (p.side === 0) longSize += p.size
      else shortSize += p.size
    }
    return { longSize, shortSize }
  }, [openPositionsData, marketId])

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

  // Effective price for calculations (limit price or oracle for market)
  const effectivePrice = useMemo(() => {
    if (orderType === 'market') return oraclePrice
    return priceInput ? parsePrice(priceInput) : 0n
  }, [orderType, priceInput, oraclePrice])

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

  // Max affordable contracts
  const maxSize = useMemo(() => {
    if (!market || balance === 0n) return 0
    const ltv = market.ltv > 0n ? market.ltv : BigInt(PERCENT_BASE)
    let price = effectivePrice
    if (orderType === 'market') price = oraclePrice * 2n
    if (price === 0n) return 0
    // collateral_per_1 = price * CP * PB / (PP * ltv)
    const collatPer1 = price * BigInt(COLLATERAL_PRECISION) * BigInt(PERCENT_BASE) / (BigInt(PRICE_PRECISION) * ltv)
    if (collatPer1 === 0n) return 0
    return Number(balance / collatPer1)
  }, [market, balance, effectivePrice, orderType, oraclePrice])

  // Order value in USD
  const orderValue = useMemo(() => {
    const size = sizeInput ? Number(sizeInput) : 0
    if (size === 0 || effectivePrice === 0n) return null
    const priceUsd = Number(effectivePrice) / PRICE_PRECISION
    return priceUsd * size
  }, [sizeInput, effectivePrice])

  // Estimated liquidation price
  const liquidationPrice = useMemo(() => {
    if (!market || effectivePrice === 0n) return null
    const size = sizeInput ? BigInt(Math.floor(Number(sizeInput))) : 0n
    if (size === 0n || collateralRequired === 0n) return null
    const liqThreshold = market.liquidationThreshold > 0n ? market.liquidationThreshold : BigInt(PERCENT_BASE)
    const PP = BigInt(PRICE_PRECISION)
    const CP = BigInt(COLLATERAL_PRECISION)
    const PB = BigInt(PERCENT_BASE)
    // maintenance = entry * liqThreshold / PB (in price units)
    const maintenancePart = effectivePrice * liqThreshold / PB
    // collateral contribution = collateral * PP / (size * CP) (in price units)
    const collatPart = collateralRequired * PP / (size * CP)
    if (side === 'long') {
      // liqPrice = entry + maintenancePart - collatPart
      const liq = effectivePrice + maintenancePart - collatPart
      return liq > 0n ? liq : 0n
    } else {
      // liqPrice = entry - maintenancePart + collatPart
      const liq = effectivePrice - maintenancePart + collatPart
      return liq > 0n ? liq : 0n
    }
  }, [market, effectivePrice, sizeInput, collateralRequired, side])

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
      // Slippage protection: use limit order with price = best + tolerance
      const refPrice = side === 'long' ? bestAsk : bestBid
      if (refPrice && refPrice > 0n) {
        const maxPrice = side === 'long'
          ? refPrice + (refPrice * BigInt(slippageBps) / 10000n)
          : refPrice - (refPrice * BigInt(slippageBps) / 10000n)
        if (maxPrice > 0n) {
          placeLimitOrder(marketId, sideEnum, maxPrice, size)
          return
        }
      }
      // Fallback: no book data → raw market order (no slippage protection)
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

  const priceWarning = useMemo(() => {
    if (orderType !== 'limit' || !priceInput) return null
    const limitPrice = parsePrice(priceInput)
    if (limitPrice === 0n) return null
    if (side === 'long' && bestAsk && limitPrice > bestAsk) {
      const askUsd = Number(bestAsk) / PRICE_PRECISION
      return `Your buy price is above the best ask ($${askUsd.toFixed(2)}) — will fill immediately`
    }
    if (side === 'short' && bestBid && limitPrice < bestBid) {
      const bidUsd = Number(bestBid) / PRICE_PRECISION
      return `Your sell price is below the best bid ($${bidUsd.toFixed(2)}) — will fill immediately`
    }
    return null
  }, [orderType, priceInput, bestBid, bestAsk, side])

  // Market order: check if size exceeds available book depth
  const depthWarning = useMemo(() => {
    if (orderType !== 'market' || !sizeInput) return null
    const size = BigInt(Math.floor(Number(sizeInput)))
    if (size === 0n) return null
    const depth = side === 'long' ? bookDepthAsk : bookDepthBid
    if (depth !== undefined && size > depth) {
      return `Only ${depth.toString()} contracts available in the book — order will be partially filled`
    }
    return null
  }, [orderType, sizeInput, side, bookDepthAsk, bookDepthBid])

  const sizeNum = sizeInput ? Number(sizeInput) : 0
  const sliderValue = maxSize > 0 ? Math.min(sizeNum / maxSize, 1) : 0
  const sliderPercent = Math.round(sliderValue * 100)

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const pct = Number(e.target.value)
    const newSize = Math.floor((pct / 100) * maxSize)
    setSizeInput(newSize > 0 ? String(newSize) : '')
  }

  function handleSliderPreset(pct: number) {
    const newSize = Math.floor((pct / 100) * maxSize)
    setSizeInput(newSize > 0 ? String(newSize) : '')
  }

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

      {/* Size input + slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-text-secondary">Size (contracts)</label>
          {isConnected && maxSize > 0 && (
            <span className="text-[10px] text-text-secondary">
              Max: <span className="text-text font-mono">{maxSize}</span>
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="number"
            placeholder="0"
            value={sizeInput}
            onChange={(e) => {
              const v = e.target.value
              if (v === '' || /^\d+$/.test(v)) setSizeInput(v)
            }}
            onKeyDown={(e) => { if (e.key === '.' || e.key === ',') e.preventDefault() }}
            step="1"
            min="0"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-secondary/50 focus:outline-none focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">Contracts</span>
        </div>

        {/* Slider */}
        {isConnected && maxSize > 0 && (
          <div className="mt-2 space-y-1.5">
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPercent}
              onChange={handleSlider}
              className={cn(
                'w-full h-1 rounded-full appearance-none cursor-pointer',
                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-sm',
                side === 'long'
                  ? 'bg-long/20 [&::-webkit-slider-thumb]:bg-long'
                  : 'bg-short/20 [&::-webkit-slider-thumb]:bg-short'
              )}
            />
            <div className="flex justify-between gap-1">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handleSliderPreset(pct)}
                  className={cn(
                    'flex-1 py-0.5 text-[10px] font-medium rounded transition-colors cursor-pointer',
                    sliderPercent >= pct
                      ? side === 'long'
                        ? 'bg-long/20 text-long'
                        : 'bg-short/20 text-short'
                      : 'bg-surface-2 text-text-secondary hover:text-text'
                  )}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary box */}
      <div className="bg-surface-2 rounded-lg p-2.5 space-y-1.5">
        {/* Available to trade */}
        {isConnected && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Available</span>
            <span className="text-text font-mono">
              <img src="/logos/USDC_Logo.png" alt="USDC" className="w-3 h-3 rounded-full inline mr-1 -mt-px" />
              ${formatUSDC(balance)}
            </span>
          </div>
        )}

        {/* Current position */}
        {isConnected && currentPosition && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">Position</span>
            <span className="font-mono">
              {currentPosition.longSize > 0n && (
                <span className="text-long">{Number(currentPosition.longSize)}L</span>
              )}
              {currentPosition.longSize > 0n && currentPosition.shortSize > 0n && (
                <span className="text-text-secondary"> / </span>
              )}
              {currentPosition.shortSize > 0n && (
                <span className="text-short">{Number(currentPosition.shortSize)}S</span>
              )}
            </span>
          </div>
        )}

        <div className="border-t border-border/50 my-1" />

        {/* Order value */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">Order Value</span>
          <span className="text-text font-mono">
            {orderValue ? `$${orderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
          </span>
        </div>

        {/* Margin required */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">Margin Required</span>
          <span className="text-text font-mono">
            {collateralRequired > 0n ? `$${formatUSDC(collateralRequired)}` : '--'}
          </span>
        </div>

        {/* Liquidation price */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">Liq. Price</span>
          <span className={cn('font-mono', liquidationPrice ? (side === 'long' ? 'text-short' : 'text-long') : 'text-text')}>
            {liquidationPrice ? `$${formatPrice(liquidationPrice)}` : '--'}
          </span>
        </div>

        <div className="border-t border-border/50 my-1" />

        {/* Slippage */}
        <div className="flex items-center justify-between text-xs relative">
          <span className="text-text-secondary">Slippage</span>
          {orderType === 'limit' ? (
            <span className="text-text font-mono">0%</span>
          ) : (
            <button
              onClick={() => setShowSlippageMenu(!showSlippageMenu)}
              className="text-text font-mono hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
            >
              {(slippageBps / 100).toFixed(slippageBps % 100 === 0 ? 0 : 1)}%
              <svg className="w-2.5 h-2.5 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          )}
          {showSlippageMenu && orderType === 'market' && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg p-2 shadow-lg z-20 w-44">
              <div className="flex gap-1 mb-2">
                {[10, 50, 100, 200].map((bps) => (
                  <button
                    key={bps}
                    onClick={() => { setSlippageBps(bps); setShowSlippageMenu(false) }}
                    className={cn(
                      'flex-1 py-1 text-[10px] font-medium rounded transition-colors cursor-pointer',
                      slippageBps === bps
                        ? 'bg-primary/20 text-primary'
                        : 'bg-surface-2 text-text-secondary hover:text-text'
                    )}
                  >
                    {(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={(slippageBps / 100).toString()}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (!isNaN(v) && v >= 0 && v <= 50) setSlippageBps(Math.round(v * 100))
                  }}
                  step="0.1"
                  min="0"
                  max="50"
                  className="flex-1 bg-surface-2 border border-border rounded px-2 py-1 text-[10px] text-text font-mono focus:outline-none focus:border-primary w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] text-text-secondary">%</span>
              </div>
            </div>
          )}
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

      {/* Price warning */}
      {priceWarning && (
        <div className="flex items-start gap-2 bg-warning/10 border border-warning/20 rounded-lg px-2.5 py-2">
          <svg className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] text-warning leading-snug">{priceWarning}</span>
        </div>
      )}

      {/* Depth warning for market orders */}
      {depthWarning && (
        <div className="flex items-start gap-2 bg-short/10 border border-short/20 rounded-lg px-2.5 py-2">
          <svg className="w-3.5 h-3.5 text-short shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[10px] text-short leading-snug">{depthWarning}</span>
        </div>
      )}

      {/* Taker fee */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-text-secondary">Taker Fee</span>
        <span className="text-text-secondary font-mono">0.10%</span>
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
