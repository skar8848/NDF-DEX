import { useState, useMemo } from 'react'
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

type BottomTab = 'positions' | 'orders' | 'history'

export default function Trade() {
  const { marketId: marketIdParam } = useParams<{ marketId: string }>()

  let marketId: bigint
  try {
    marketId = BigInt(marketIdParam ?? '1')
  } catch {
    marketId = 1n
  }

  const [bottomTab, setBottomTab] = useState<BottomTab>('positions')

  const { data: marketData, isLoading: marketLoading } = useMarket(marketId)
  const { data: allMarketsData } = useAllMarkets()
  const { data: orderBookData } = useOrderBookData(marketId)

  const market = useMemo(() => {
    if (!marketData) return null
    try {
      const m = marketData as MarketInfo
      // Verify it has expected fields
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

  // Market info panel data
  const { data: priceData } = useOraclePrice(market?.baseAsset ?? '')
  const oraclePrice = useMemo(() => {
    if (!priceData) return null
    try {
      return (priceData as [bigint, bigint])[0]
    } catch {
      return null
    }
  }, [priceData])

  if (marketLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)] bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary text-sm">Loading market...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-background overflow-hidden">
      {/* Top bar: Market selector + info */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border bg-surface shrink-0">
        <MarketSelector
          markets={allMarkets}
          selectedMarketId={marketId}
          onSelect={() => {}}
        />

        {market && (
          <div className="flex items-center gap-6 ml-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary">Oracle Price</span>
              <span className="text-sm font-bold text-text font-mono">
                {oraclePrice ? `$${formatPrice(oraclePrice)}` : '--'}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary">Expiry</span>
              <span className="text-sm text-text font-mono">
                {formatCountdown(market.expiration)}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary">Long OI</span>
              <span className="text-sm text-long font-mono">
                {market.totalLongOI.toString()}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary">Short OI</span>
              <span className="text-sm text-short font-mono">
                {market.totalShortOI.toString()}
              </span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary">Status</span>
              {market.settled ? (
                <span className="text-xs font-medium text-warning">Settled</span>
              ) : (
                <span className="text-xs font-medium text-success">Active</span>
              )}
            </div>
          </div>
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
            />
          </div>
        </div>

        {/* Trade Form */}
        <div className="min-h-0 overflow-y-auto">
          <div className="px-3 py-2 border-b border-border">
            <h3 className="text-xs font-semibold text-text">Place Order</h3>
          </div>
          <TradeForm marketId={marketId} market={market} />
        </div>
      </div>

      {/* Bottom panel: Positions / Orders / History */}
      <div className="h-[240px] shrink-0 border-t border-border bg-surface flex flex-col">
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
                'px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer',
                bottomTab === tab.id
                  ? 'border-primary text-text'
                  : 'border-transparent text-text-secondary hover:text-text'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
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
