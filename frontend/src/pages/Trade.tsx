import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useMarket, useAllMarkets, type MarketInfo } from '../hooks/useForwardMarket'
import { useOrderBookData, type Order } from '../hooks/useOrderBook'
import { MarketSelector } from '../components/trading/MarketSelector'
import { OrderBookComponent } from '../components/trading/OrderBookComponent'
import { TradeForm } from '../components/trading/TradeForm'
import { PriceChart } from '../components/trading/PriceChart'
import { PositionTable } from '../components/trading/PositionTable'
import { OrderHistory } from '../components/trading/OrderHistory'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useOraclePrice } from '../hooks/usePriceData'
import { formatPrice, formatCountdown, cn } from '../lib/utils'
import { PRICE_PRECISION } from '../lib/config'

type BottomTab = 'positions' | 'orders' | 'history'

const MIN_BOTTOM = 100
const DEFAULT_BOTTOM = 200
// Trade form needs ~400px (header 45px + form ~355px). Top bar ~45px.
// So max bottom = viewport - 56px(header) - 45px(top bar) - 400px(trade form min)
const TRADE_FORM_MIN_HEIGHT = 400

export default function Trade() {
  const { marketId: marketIdParam } = useParams<{ marketId: string }>()

  let marketId: bigint
  try {
    marketId = BigInt(marketIdParam ?? '1')
  } catch {
    marketId = 1n
  }

  const [bottomTab, setBottomTab] = useState<BottomTab>('positions')
  const [bottomHeight, setBottomHeight] = useState(DEFAULT_BOTTOM)
  const [externalPrice, setExternalPrice] = useState<string | null>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  const { data: marketData, isLoading: marketLoading } = useMarket(marketId)
  const { data: allMarketsData } = useAllMarkets()
  const { data: orderBookData } = useOrderBookData(marketId)

  const market = useMemo(() => {
    if (!marketData) return null
    try {
      const m = marketData as MarketInfo
      if (m.id === undefined || m.baseAsset === undefined) return null
      return m
    } catch {
      return null
    }
  }, [marketData])

  const allMarkets = useMemo(() => {
    if (!allMarketsData) return []
    try {
      return (allMarketsData as MarketInfo[]) ?? []
    } catch {
      return []
    }
  }, [allMarketsData])

  const [bids, asks] = useMemo(() => {
    if (!orderBookData) return [[], []]
    try {
      const data = orderBookData as [Order[], Order[]]
      return [data[0] ?? [], data[1] ?? []]
    } catch {
      return [[], []]
    }
  }, [orderBookData])

  const orderBookLevels = useMemo(() => {
    try {
      const bidLevels = bids
        .filter((o: Order) => o.status === 0 || o.status === 2)
        .map((o: Order) => ({
          price: o.price,
          amount: o.amount,
          filled: o.filled,
        }))
      const askLevels = asks
        .filter((o: Order) => o.status === 0 || o.status === 2)
        .map((o: Order) => ({
          price: o.price,
          amount: o.amount,
          filled: o.filled,
        }))
      return { bids: bidLevels, asks: askLevels }
    } catch {
      return { bids: [], asks: [] }
    }
  }, [bids, asks])

  const { data: priceData } = useOraclePrice(market?.baseAsset ?? '')
  const oraclePrice = useMemo(() => {
    if (!priceData) return null
    try {
      return (priceData as [bigint, bigint])[0]
    } catch {
      return null
    }
  }, [priceData])

  // Mark price = mid of best bid / best ask
  const markPrice = useMemo(() => {
    const activeBids = orderBookLevels.bids.filter(o => o.amount - o.filled > 0n)
    const activeAsks = orderBookLevels.asks.filter(o => o.amount - o.filled > 0n)
    if (activeBids.length === 0 || activeAsks.length === 0) return null
    const bestBid = activeBids.reduce((max, o) => o.price > max ? o.price : max, 0n)
    const bestAsk = activeAsks.reduce((min, o) => o.price < min ? o.price : min, activeAsks[0].price)
    if (bestAsk <= bestBid) return null
    return (bestBid + bestAsk) / 2n
  }, [orderBookLevels])

  // Drag to resize bottom panel
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    startY.current = e.clientY
    startHeight.current = bottomHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [bottomHeight])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = startY.current - e.clientY
      // Dynamic max: leave enough room for trade form + top bars
      const maxBottom = Math.max(MIN_BOTTOM, window.innerHeight - 56 - 45 - TRADE_FORM_MIN_HEIGHT)
      const newHeight = Math.max(MIN_BOTTOM, Math.min(maxBottom, startHeight.current + delta))
      setBottomHeight(newHeight)
    }
    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  if (marketLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary text-sm">Loading market...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Top bar: Market selector + info */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-surface shrink-0">
        <MarketSelector
          markets={allMarkets}
          selectedMarketId={marketId}
          onSelect={() => {}}
        />

        {market && (
          <>
            <div className="w-px h-6 bg-border" />

            <div className="flex flex-col">
              <span className="text-[10px]" style={{ color: '#8888a0' }}>Mark Price</span>
              <span className="text-sm font-bold font-mono" style={{ color: '#e4e4ed' }}>
                {markPrice ? `$${formatPrice(markPrice)}` : '--'}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px]" style={{ color: '#8888a0' }}>Oracle Price</span>
              <span className="text-sm font-mono" style={{ color: '#e4e4ed' }}>
                {oraclePrice ? `$${formatPrice(oraclePrice)}` : '--'}
              </span>
            </div>

            <div className="w-px h-6 bg-border" />

            <div className="flex flex-col">
              <span className="text-[10px]" style={{ color: '#8888a0' }}>Open Interest</span>
              <span className="text-sm font-mono" style={{ color: '#e4e4ed' }}>
                {oraclePrice
                  ? `$${(Number(market.totalLongOI + market.totalShortOI) * Number(oraclePrice) / PRICE_PRECISION).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                  : '--'}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px]" style={{ color: '#8888a0' }}>Volume 24h</span>
              <span className="text-sm font-mono" style={{ color: '#8888a0' }}>-</span>
            </div>

            <div className="w-px h-6 bg-border" />

            <div className="flex flex-col">
              <span className="text-[10px]" style={{ color: '#8888a0' }}>Expiry</span>
              <span className="text-sm font-mono" style={{ color: '#e4e4ed' }}>
                {formatCountdown(market.expiration)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Main grid: Chart + OrderBook + TradeForm */}
      <div className="flex-1 grid grid-cols-[1fr_240px_280px] min-h-0">
        {/* Price Chart */}
        <div className="border-r border-border min-h-0 overflow-hidden">
          <ErrorBoundary fallback={<div className="flex items-center justify-center h-full text-text-secondary text-sm">Chart unavailable</div>}>
            {market ? (
              <PriceChart baseAsset={market.baseAsset} />
            ) : (
              <div className="flex items-center justify-center h-full text-text-secondary text-sm">
                Select a market to view chart
              </div>
            )}
          </ErrorBoundary>
        </div>

        {/* Order Book */}
        <div className="border-r border-border min-h-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text">Order Book</h3>
          </div>
          <div className="h-[calc(100%-33px)] overflow-hidden">
            <OrderBookComponent
              bids={orderBookLevels.bids}
              asks={orderBookLevels.asks}
              onPriceClick={(price) => setExternalPrice(price)}
            />
          </div>
        </div>

        {/* Trade Form - no scroll */}
        <div className="min-h-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text">Place Order</h3>
          </div>
          <TradeForm marketId={marketId} market={market} externalPrice={externalPrice} onExternalPriceConsumed={() => setExternalPrice(null)} />
        </div>
      </div>

      {/* Resizable bottom panel */}
      <div
        className="shrink-0 border-t border-border bg-surface flex flex-col"
        style={{ height: bottomHeight }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleMouseDown}
          className="h-1.5 cursor-row-resize bg-border/30 hover:bg-primary/30 transition-colors shrink-0 flex items-center justify-center"
        >
          <div className="w-8 h-0.5 bg-text-secondary/30 rounded-full" />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 border-b border-border shrink-0">
          {(
            [
              { id: 'positions', label: 'Positions' },
              { id: 'orders', label: 'Open Orders' },
              { id: 'history', label: 'Order History' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setBottomTab(tab.id)}
              className={cn(
                'px-4 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer',
                bottomTab === tab.id
                  ? 'border-primary text-text'
                  : 'border-transparent text-text-secondary hover:text-text'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto no-scrollbar">
          <ErrorBoundary>
            {bottomTab === 'positions' && <PositionTable />}
            {bottomTab === 'orders' && <OrderHistory />}
            {bottomTab === 'history' && <OrderHistory />}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
