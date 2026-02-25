import { useMemo } from 'react'
import { formatPrice } from '../../lib/utils'
import { PRICE_PRECISION } from '../../lib/config'

type OrderLevel = {
  price: bigint
  amount: bigint
  filled: bigint
}

type OrderBookComponentProps = {
  bids: OrderLevel[]
  asks: OrderLevel[]
  markPrice?: bigint | null
  onPriceClick?: (price: string) => void
}

function aggregateByPrice(orders: OrderLevel[]): { price: bigint; totalAmount: bigint }[] {
  const map = new Map<string, { price: bigint; totalAmount: bigint }>()
  for (const order of orders) {
    const key = order.price.toString()
    const existing = map.get(key)
    const remaining = order.amount - order.filled
    if (remaining <= 0n) continue
    if (existing) {
      existing.totalAmount += remaining
    } else {
      map.set(key, { price: order.price, totalAmount: remaining })
    }
  }
  return Array.from(map.values()).filter((level) => level.totalAmount > 0n)
}

type ProcessedLevel = {
  price: bigint
  totalAmount: bigint
  cumulative: bigint
}

export function OrderBookComponent({ bids, asks, markPrice, onPriceClick }: OrderBookComponentProps) {
  // Process asks: sort low to high for cumulative, display high to low
  const processedAsks = useMemo(() => {
    const aggregated = aggregateByPrice(asks)
    // Sort low to high for cumulative calculation
    aggregated.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0))
    let cumulative = 0n
    const withCumulative: ProcessedLevel[] = aggregated.map((level) => {
      cumulative += level.totalAmount
      return { ...level, cumulative }
    })
    // Reverse for display: highest at top, lowest near spread
    return withCumulative.reverse()
  }, [asks])

  // Process bids: sort high to low for display, cumulative from top
  const processedBids = useMemo(() => {
    const aggregated = aggregateByPrice(bids)
    aggregated.sort((a, b) => (a.price > b.price ? -1 : a.price < b.price ? 1 : 0))
    let cumulative = 0n
    return aggregated.map((level) => {
      cumulative += level.totalAmount
      return { ...level, cumulative }
    }) as ProcessedLevel[]
  }, [bids])

  // Unified max cumulative across both sides
  const maxCumulative = useMemo(() => {
    const maxBid = processedBids.length > 0 ? processedBids[processedBids.length - 1].cumulative : 0n
    const maxAsk = processedAsks.length > 0 ? processedAsks[0].cumulative : 0n
    const max = maxBid > maxAsk ? maxBid : maxAsk
    return max > 0n ? max : 1n
  }, [processedBids, processedAsks])

  // Spread
  const spreadInfo = useMemo(() => {
    if (processedAsks.length === 0 || processedBids.length === 0) return null
    const lowestAsk = processedAsks[processedAsks.length - 1].price
    const highestBid = processedBids[0].price
    if (lowestAsk <= highestBid) return null
    const spreadVal = lowestAsk - highestBid
    const spreadPct = Number(spreadVal * 10000n / highestBid) / 100
    return { value: spreadVal, percent: spreadPct }
  }, [processedAsks, processedBids])

  const handlePriceClick = (price: bigint) => {
    if (!onPriceClick) return
    const priceStr = (Number(price) / PRICE_PRECISION).toFixed(2)
    onPriceClick(priceStr)
  }

  const displayAsks = processedAsks.slice(-12)
  const displayBids = processedBids.slice(0, 12)
  const hiddenAsks = processedAsks.length - displayAsks.length
  const hiddenBids = processedBids.length - displayBids.length

  return (
    <div className="flex flex-col h-full text-[11px]">
      {/* Header */}
      <div className="grid grid-cols-3 gap-1 px-3 py-1.5 text-[10px] font-medium text-text-secondary uppercase tracking-wider border-b border-border">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sells) - red */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end">
        {hiddenAsks > 0 && (
          <div className="px-3 py-1 text-[9px] text-text-secondary text-center">
            +{hiddenAsks} more level{hiddenAsks > 1 ? 's' : ''} above
          </div>
        )}
        {displayAsks.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-text-secondary text-xs">
            No asks
          </div>
        ) : (
          displayAsks.map((level) => {
            const cumulativePercent = Number(level.cumulative * 100n / maxCumulative)
            const individualPercent = Number(level.totalAmount * 100n / maxCumulative)

            return (
              <div
                key={level.price.toString()}
                onClick={() => handlePriceClick(level.price)}
                className="relative grid grid-cols-3 gap-1 px-3 py-[3px] cursor-pointer hover:bg-short/5 transition-colors group"
              >
                {/* Cumulative depth bar (lighter) */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-short/8 transition-all duration-300"
                  style={{ width: `${Math.min(cumulativePercent, 100)}%` }}
                />
                {/* Individual level bar (darker) */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-short/20 transition-all duration-300"
                  style={{ width: `${Math.min(individualPercent, 100)}%` }}
                />
                <span className="relative z-10 text-short font-mono group-hover:underline">
                  {formatPrice(level.price)}
                </span>
                <span className="relative z-10 text-right text-text font-mono">
                  {level.totalAmount.toString()}
                </span>
                <span className="relative z-10 text-right text-text-secondary font-mono">
                  {level.cumulative.toString()}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Mid price + Spread row */}
      <div className="px-3 py-1.5 border-y border-border bg-surface-2/30">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold font-mono text-text">
            {markPrice ? `$${formatPrice(markPrice)}` : '--'}
          </span>
          {spreadInfo ? (
            <span className="text-[10px] font-mono text-text-secondary">
              Spread {formatPrice(spreadInfo.value)} ({spreadInfo.percent.toFixed(2)}%)
            </span>
          ) : (
            <span className="text-[10px] text-text-secondary">--</span>
          )}
        </div>
      </div>

      {/* Bids (buys) - green */}
      <div className="flex-1 overflow-hidden">
        {displayBids.length === 0 ? (
          <div className="flex items-center justify-center py-4 text-text-secondary text-xs">
            No bids
          </div>
        ) : (
          <>
          {displayBids.map((level) => {
            const cumulativePercent = Number(level.cumulative * 100n / maxCumulative)
            const individualPercent = Number(level.totalAmount * 100n / maxCumulative)

            return (
              <div
                key={level.price.toString()}
                onClick={() => handlePriceClick(level.price)}
                className="relative grid grid-cols-3 gap-1 px-3 py-[3px] cursor-pointer hover:bg-long/5 transition-colors group"
              >
                {/* Cumulative depth bar (lighter) */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-long/8 transition-all duration-300"
                  style={{ width: `${Math.min(cumulativePercent, 100)}%` }}
                />
                {/* Individual level bar (darker) */}
                <div
                  className="absolute right-0 top-0 bottom-0 bg-long/20 transition-all duration-300"
                  style={{ width: `${Math.min(individualPercent, 100)}%` }}
                />
                <span className="relative z-10 text-long font-mono group-hover:underline">
                  {formatPrice(level.price)}
                </span>
                <span className="relative z-10 text-right text-text font-mono">
                  {level.totalAmount.toString()}
                </span>
                <span className="relative z-10 text-right text-text-secondary font-mono">
                  {level.cumulative.toString()}
                </span>
              </div>
            )
          })
          {hiddenBids > 0 && (
            <div className="px-3 py-1 text-[9px] text-text-secondary text-center">
              +{hiddenBids} more level{hiddenBids > 1 ? 's' : ''} below
            </div>
          )}
          </>
        )}
      </div>
    </div>
  )
}
