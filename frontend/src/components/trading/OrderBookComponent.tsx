import { useMemo } from 'react'
import { formatPrice } from '../../lib/utils'
import { cn } from '../../lib/utils'

type OrderLevel = {
  price: bigint
  amount: bigint
  filled: bigint
}

type OrderBookComponentProps = {
  bids: OrderLevel[]
  asks: OrderLevel[]
}

function aggregateByPrice(orders: OrderLevel[]): { price: bigint; totalAmount: bigint; totalFilled: bigint }[] {
  const map = new Map<string, { price: bigint; totalAmount: bigint; totalFilled: bigint }>()
  for (const order of orders) {
    const key = order.price.toString()
    const existing = map.get(key)
    if (existing) {
      existing.totalAmount += order.amount - order.filled
      existing.totalFilled += order.filled
    } else {
      map.set(key, {
        price: order.price,
        totalAmount: order.amount - order.filled,
        totalFilled: order.filled,
      })
    }
  }
  return Array.from(map.values()).filter((level) => level.totalAmount > 0n)
}

export function OrderBookComponent({ bids, asks }: OrderBookComponentProps) {
  const processedAsks = useMemo(() => {
    const aggregated = aggregateByPrice(asks)
    // Sort high to low for display (highest ask at top)
    return aggregated.sort((a, b) => (a.price > b.price ? -1 : a.price < b.price ? 1 : 0))
  }, [asks])

  const processedBids = useMemo(() => {
    const aggregated = aggregateByPrice(bids)
    // Sort high to low (best bid at top)
    return aggregated.sort((a, b) => (a.price > b.price ? -1 : a.price < b.price ? 1 : 0))
  }, [bids])

  const maxAskAmount = useMemo(() => {
    if (processedAsks.length === 0) return 1n
    return processedAsks.reduce((max, a) => (a.totalAmount > max ? a.totalAmount : max), 0n)
  }, [processedAsks])

  const maxBidAmount = useMemo(() => {
    if (processedBids.length === 0) return 1n
    return processedBids.reduce((max, b) => (b.totalAmount > max ? b.totalAmount : max), 0n)
  }, [processedBids])

  const spread = useMemo(() => {
    if (processedAsks.length === 0 || processedBids.length === 0) return null
    // Lowest ask
    const lowestAsk = processedAsks[processedAsks.length - 1].price
    // Highest bid
    const highestBid = processedBids[0].price
    if (lowestAsk <= highestBid) return null
    return lowestAsk - highestBid
  }, [processedAsks, processedBids])

  const displayAsks = processedAsks.slice(-8) // Show last 8 (closest to spread)
  const displayBids = processedBids.slice(0, 8) // Show first 8 (closest to spread)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[10px] font-medium text-text-secondary uppercase tracking-wider border-b border-border">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sells) - red, sorted high to low */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {displayAsks.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-text-secondary text-xs">
            No asks
          </div>
        ) : (
          displayAsks.map((level, i) => {
            const depthPercent = maxAskAmount > 0n
              ? Number((level.totalAmount * 100n) / maxAskAmount)
              : 0
            // Running total from bottom (closest to spread) up
            const runningTotal = displayAsks
              .slice(i)
              .reduce((sum, l) => sum + l.totalAmount, 0n)

            return (
              <div
                key={level.price.toString()}
                className="relative grid grid-cols-3 gap-2 px-3 py-1 text-xs hover:bg-surface-2/50 transition-colors"
              >
                {/* Depth bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-short/10"
                  style={{ width: `${Math.min(depthPercent, 100)}%` }}
                />
                <span className="relative text-short font-mono">
                  {formatPrice(level.price)}
                </span>
                <span className="relative text-right text-text font-mono">
                  {level.totalAmount.toString()}
                </span>
                <span className="relative text-right text-text-secondary font-mono">
                  {runningTotal.toString()}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Spread */}
      <div className="px-3 py-2 border-y border-border bg-surface-2/30 flex items-center justify-between">
        <span className="text-xs text-text-secondary">Spread</span>
        <span className={cn(
          'text-xs font-mono font-medium',
          spread !== null ? 'text-text' : 'text-text-secondary'
        )}>
          {spread !== null ? formatPrice(spread) : '--'}
        </span>
      </div>

      {/* Bids (buys) - green, sorted high to low */}
      <div className="flex-1 overflow-hidden">
        {displayBids.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-text-secondary text-xs">
            No bids
          </div>
        ) : (
          displayBids.map((level, i) => {
            const depthPercent = maxBidAmount > 0n
              ? Number((level.totalAmount * 100n) / maxBidAmount)
              : 0
            // Running total from top (closest to spread) down
            const runningTotal = displayBids
              .slice(0, i + 1)
              .reduce((sum, l) => sum + l.totalAmount, 0n)

            return (
              <div
                key={level.price.toString()}
                className="relative grid grid-cols-3 gap-2 px-3 py-1 text-xs hover:bg-surface-2/50 transition-colors"
              >
                {/* Depth bar */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-long/10"
                  style={{ width: `${Math.min(depthPercent, 100)}%` }}
                />
                <span className="relative text-long font-mono">
                  {formatPrice(level.price)}
                </span>
                <span className="relative text-right text-text font-mono">
                  {level.totalAmount.toString()}
                </span>
                <span className="relative text-right text-text-secondary font-mono">
                  {runningTotal.toString()}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
