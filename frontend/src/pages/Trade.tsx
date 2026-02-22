import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useMarket, useAllMarkets, useSettleMarket, type MarketInfo } from '../hooks/useForwardMarket'
import { useOrderBookData, type Order } from '../hooks/useOrderBook'
import { MarketSelector } from '../components/trading/MarketSelector'
import { OrderBookComponent } from '../components/trading/OrderBookComponent'
import { TradeForm } from '../components/trading/TradeForm'
import { PriceChart } from '../components/trading/PriceChart'
import { PositionTable } from '../components/trading/PositionTable'
import { OrderHistory } from '../components/trading/OrderHistory'
import { TradeHistory } from '../components/trading/TradeHistory'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useOraclePrice } from '../hooks/usePriceData'
import { formatCountdown, cn } from '../lib/utils'
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
  const [midTab, setMidTab] = useState<'book' | 'trades'>('book')
  const [bottomHeight, setBottomHeight] = useState(DEFAULT_BOTTOM)
  const [externalPrice, setExternalPrice] = useState<string | null>(null)
  const isDragging = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(0)

  const { settleMarket, isPending: isSettlePending, isConfirming: isSettleConfirming } = useSettleMarket()

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

  // Best bid / best ask / mid / spread / depth
  const { bestBid, bestAsk, markPrice, spread, bookDepthBid, bookDepthAsk } = useMemo(() => {
    const activeBids = orderBookLevels.bids.filter(o => o.amount - o.filled > 0n)
    const activeAsks = orderBookLevels.asks.filter(o => o.amount - o.filled > 0n)
    const depthBid = activeBids.reduce((sum, o) => sum + (o.amount - o.filled), 0n)
    const depthAsk = activeAsks.reduce((sum, o) => sum + (o.amount - o.filled), 0n)
    if (activeBids.length === 0 || activeAsks.length === 0) {
      return { bestBid: null, bestAsk: null, markPrice: null, spread: null, bookDepthBid: depthBid, bookDepthAsk: depthAsk }
    }
    const bb = activeBids.reduce((max, o) => o.price > max ? o.price : max, 0n)
    const ba = activeAsks.reduce((min, o) => o.price < min ? o.price : min, activeAsks[0].price)
    if (ba <= bb) return { bestBid: bb, bestAsk: ba, markPrice: null, spread: null, bookDepthBid: depthBid, bookDepthAsk: depthAsk }
    const mid = (bb + ba) / 2n
    const sp = ba - bb
    return { bestBid: bb, bestAsk: ba, markPrice: mid, spread: sp, bookDepthBid: depthBid, bookDepthAsk: depthAsk }
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
      <div className="flex items-center gap-5 px-3 py-2 border-b border-border bg-surface shrink-0">
        <MarketSelector
          markets={allMarkets}
          selectedMarketId={marketId}
          onSelect={() => {}}
        />

        {market && (
          <>
            <div className="w-px h-6 bg-border" />

            <div className="flex flex-col">
              <span className="text-[10px]" style={{ color: '#8888a0' }}>Mark / Mid</span>
              <span className="text-sm font-bold font-mono" style={{ color: '#e4e4ed' }}>
                {markPrice ? `$${(Number(markPrice) / PRICE_PRECISION).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px]" style={{ color: '#8888a0' }}>Spread</span>
              <span className="text-sm font-mono" style={{ color: '#e4e4ed' }}>
                {spread ? `$${(Number(spread) / PRICE_PRECISION).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px]" style={{ color: '#8888a0' }}>Oracle</span>
              <span className="text-sm font-mono" style={{ color: '#e4e4ed' }}>
                {oraclePrice ? `$${(Number(oraclePrice) / PRICE_PRECISION).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '--'}
              </span>
            </div>

            <div className="w-px h-6 bg-border" />

            <div className="flex flex-col">
              <span className="text-[10px]" style={{ color: '#8888a0' }}>Open Interest</span>
              <span className="text-sm font-mono" style={{ color: '#e4e4ed' }}>
                {market.settled
                  ? '--'
                  : oraclePrice
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

            {/* Settle button for expired, unsettled markets */}
            {!market.settled && BigInt(Math.floor(Date.now() / 1000)) >= market.expiration && (
              <button
                onClick={() => settleMarket(marketId)}
                disabled={isSettlePending || isSettleConfirming}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSettlePending ? 'Confirm...' : isSettleConfirming ? 'Settling...' : 'Settle Market'}
              </button>
            )}
            {market.settled && (
              <span className="px-2 py-1 text-[10px] font-medium rounded bg-success/10 text-success">
                Settled
              </span>
            )}
          </>
        )}
      </div>

      {/* Main content: left section + trade form */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Chart + OrderBook + Bottom panel */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Chart + OrderBook row */}
          <div className="flex-1 flex min-h-0">
            {/* Price Chart */}
            <div className="flex-1 border-r border-border min-h-0 overflow-hidden">
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

            {/* Order Book / Trades */}
            <div className="w-[240px] shrink-0 border-r border-border min-h-0 overflow-hidden flex flex-col">
              <div className="flex items-center gap-1 px-2 border-b border-border shrink-0">
                {([
                  { id: 'book', label: 'Order Book' },
                  { id: 'trades', label: 'Trades' },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMidTab(tab.id)}
                    className={cn(
                      'px-2.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer',
                      midTab === tab.id
                        ? 'border-primary text-text'
                        : 'border-transparent text-text-secondary hover:text-text'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {midTab === 'book' ? (
                  <OrderBookComponent
                    bids={orderBookLevels.bids}
                    asks={orderBookLevels.asks}
                    markPrice={markPrice}
                    onPriceClick={(price) => setExternalPrice(price)}
                  />
                ) : (
                  <div className="h-full overflow-auto no-scrollbar">
                    <TradeHistory />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom panel: Positions / Orders / History */}
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
                {bottomTab === 'orders' && <OrderHistory filter="open" />}
                {bottomTab === 'history' && <OrderHistory filter="all" />}
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* Trade Form - full height right column, scrollable */}
        <div className="w-[280px] shrink-0 border-l border-border overflow-y-auto no-scrollbar">
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text">Place Order</h3>
          </div>
          <TradeForm marketId={marketId} market={market} externalPrice={externalPrice} onExternalPriceConsumed={() => setExternalPrice(null)} bestBid={bestBid} bestAsk={bestAsk} bookDepthAsk={bookDepthAsk} bookDepthBid={bookDepthBid} />
        </div>
      </div>
    </div>
  )
}
