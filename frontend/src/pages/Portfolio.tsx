import { useAccount } from 'wagmi'
import { useState } from 'react'
import { useUserPositions, useBatchSettle } from '../hooks/usePositions'
import { useUserOrders } from '../hooks/useOrderBook'
import { useUSDCBalance } from '../hooks/useOrderBook'
import { useAllMarkets, useSettleMarket, type MarketInfo } from '../hooks/useForwardMarket'
import { useOraclePrice } from '../hooks/usePriceData'
import { formatPrice, formatUSDC, formatExpiryDate, cn } from '../lib/utils'
import { useCancelOrder } from '../hooks/useOrderBook'
import { CONTRACTS, PRICE_PRECISION, COLLATERAL_PRECISION } from '../lib/config'

function PositionPnL({ position, market }: { position: any; market: MarketInfo | undefined }) {
  const baseAsset = market?.baseAsset ?? ''
  const { data: priceData } = useOraclePrice(baseAsset)
  const currentPrice = priceData ? (priceData as [bigint, bigint])[0] : null

  // Use settlePrice for closed positions on settled markets, oracle for open
  const refPrice = !position.isOpen && market?.settled && market.settlePrice > 0n
    ? market.settlePrice
    : currentPrice

  if (!refPrice || position.entryPrice === 0n) return <span className="text-text-secondary">--</span>

  const diff = position.side === 0
    ? refPrice - position.entryPrice
    : position.entryPrice - refPrice
  const pnl = (diff * position.size * BigInt(COLLATERAL_PRECISION)) / BigInt(PRICE_PRECISION)
  const pnlNum = Number(pnl) / COLLATERAL_PRECISION

  return (
    <span className={cn('font-mono', pnlNum >= 0 ? 'text-long' : 'text-short')}>
      {pnlNum >= 0 ? '+' : ''}${pnlNum.toFixed(2)}
    </span>
  )
}

export function Portfolio() {
  const { isConnected } = useAccount()
  const { data: positions } = useUserPositions()
  const { data: orders } = useUserOrders()
  const { data: balance } = useUSDCBalance()
  const { data: marketsData } = useAllMarkets()
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { batchSettle, isSettling } = useBatchSettle()
  const { settleMarket, isPending: isSettleMarketPending, isConfirming: isSettleMarketConfirming } = useSettleMarket()

  const markets = (marketsData as MarketInfo[] | undefined) ?? []
  const getMarket = (marketId: bigint) => markets.find((m) => m.id === marketId)

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-xl font-semibold text-text mb-2">Connect Your Wallet</h2>
        <p className="text-text-secondary">Connect your wallet to view your portfolio</p>
      </div>
    )
  }

  const allPositions = (positions as any[]) || []
  const openPositions = allPositions.filter((p: any) => p.isOpen)
  const openOrders = (orders as any[])?.filter(
    (o: any) => o.status === 0 || o.status === 2
  ) || []

  const settleable = openPositions.filter((p: any) => getMarket(p.marketId)?.settled)

  // Markets that are expired but not yet settled (need settleMarket call)
  const now = BigInt(Math.floor(Date.now() / 1000))
  const expiredUnsettled = markets.filter(m => !m.settled && now >= m.expiration)

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === settleable.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(settleable.map((p: any) => p.id.toString())))
    }
  }

  const handleBatchSettle = () => {
    const ids = allPositions
      .filter((p: any) => selectedIds.has(p.id.toString()))
      .map((p: any) => p.id as bigint)
    batchSettle(ids)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-text mb-6">Portfolio</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-text-secondary text-xs mb-1">USDC Balance</p>
          <p className="text-xl font-bold text-text">
            ${balance ? formatUSDC(balance as bigint) : '0.00'}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-text-secondary text-xs mb-1">Open Positions</p>
          <p className="text-xl font-bold text-text">{openPositions.length}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-5">
          <p className="text-text-secondary text-xs mb-1">Open Orders</p>
          <p className="text-xl font-bold text-text">{openOrders.length}</p>
        </div>
      </div>

      {/* Expired unsettled markets */}
      {expiredUnsettled.length > 0 && (
        <div className="mb-6 space-y-2">
          {expiredUnsettled.map((m) => (
            <div key={m.id.toString()} className="flex items-center justify-between bg-warning/5 border border-warning/20 rounded-xl px-5 py-3">
              <div>
                <span className="text-sm font-semibold text-text">
                  {m.baseAsset}/{m.quoteAsset}
                </span>
                <span className="text-xs text-warning ml-2">Expired — needs settlement</span>
              </div>
              <button
                onClick={() => settleMarket(m.id)}
                disabled={isSettleMarketPending || isSettleMarketConfirming}
                className="px-4 py-1.5 text-xs font-semibold rounded-md bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSettleMarketPending ? 'Confirm...' : isSettleMarketConfirming ? 'Settling...' : 'Settle Market'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {(['positions', 'orders'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer',
              activeTab === tab
                ? 'border-primary text-text'
                : 'border-transparent text-text-secondary hover:text-text'
            )}
          >
            {tab === 'positions' ? `Positions (${allPositions.length})` : `Orders (${(orders as any[])?.length || 0})`}
          </button>
        ))}
      </div>

      {activeTab === 'positions' ? (
        <PositionsTable
          positions={allPositions}
          markets={markets}
          settleable={settleable}
          selectedIds={selectedIds}
          toggleId={toggleId}
          toggleAll={toggleAll}
          handleBatchSettle={handleBatchSettle}
          isSettling={isSettling}
        />
      ) : (
        <OrdersTable orders={(orders as any[]) || []} />
      )}
    </div>
  )
}

type PositionsTableProps = {
  positions: any[]
  markets: MarketInfo[]
  settleable: any[]
  selectedIds: Set<string>
  toggleId: (id: string) => void
  toggleAll: () => void
  handleBatchSettle: () => void
  isSettling: boolean
}

function PositionsTable({ positions, markets, settleable, selectedIds, toggleId, toggleAll, handleBatchSettle, isSettling }: PositionsTableProps) {
  const getMarket = (marketId: bigint) => markets.find((m) => m.id === marketId)

  if (positions.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary text-sm">
        No positions yet. Start trading to open positions.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {settleable.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <button
            onClick={handleBatchSettle}
            disabled={selectedIds.size === 0 || isSettling}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSettling ? 'Settling...' : `Settle Selected (${selectedIds.size})`}
          </button>
          <button
            onClick={toggleAll}
            className="px-2 py-1 text-[10px] text-text-secondary hover:text-text transition-colors cursor-pointer"
          >
            {selectedIds.size === settleable.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-text-secondary text-xs">
            <th className="px-4 py-3 w-8"></th>
            <th className="text-left px-4 py-3 font-medium">Market</th>
            <th className="text-left px-4 py-3 font-medium">Side</th>
            <th className="text-right px-4 py-3 font-medium">Entry Price</th>
            <th className="text-right px-4 py-3 font-medium">Size</th>
            <th className="text-right px-4 py-3 font-medium">Collateral</th>
            <th className="text-right px-4 py-3 font-medium">PnL</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos: any, i: number) => {
            const market = getMarket(pos.marketId)
            const isSettleable = market?.settled && pos.isOpen
            return (
              <tr key={i} className="border-b border-border/50 hover:bg-surface-2/50">
                <td className="px-4 py-3">
                  {isSettleable && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(pos.id.toString())}
                      onChange={() => toggleId(pos.id.toString())}
                      className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer"
                    />
                  )}
                </td>
                <td className="px-4 py-3 text-text">
                  {market
                    ? `${market.baseAsset}/${market.quoteAsset} ${formatExpiryDate(market.expiration)}`
                    : `Market #${Number(pos.marketId)}`}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    pos.side === 0 ? 'bg-long/10 text-long' : 'bg-short/10 text-short'
                  )}>
                    {pos.side === 0 ? 'LONG' : 'SHORT'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-text font-mono">${formatPrice(pos.entryPrice)}</td>
                <td className="px-4 py-3 text-right text-text font-mono">{Number(pos.size)}</td>
                <td className="px-4 py-3 text-right text-text font-mono">${formatUSDC(pos.collateral)}</td>
                <td className="px-4 py-3 text-right">
                  <PositionPnL position={pos} market={market} />
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    pos.isOpen
                      ? 'bg-success/10 text-success'
                      : 'bg-text-secondary/10 text-text-secondary'
                  )}>
                    {pos.isOpen ? 'Open' : 'Closed'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const MARKET_ORDER_THRESHOLD = BigInt('1000000000000000000')
const EXPLORER_URL = 'https://testnet.snowtrace.io'

function isMarketOrder(order: any): boolean {
  return BigInt(order.price) > MARKET_ORDER_THRESHOLD || BigInt(order.price) <= 1n
}

function OrdersTable({ orders }: { orders: any[] }) {
  const { cancelOrder, isPending } = useCancelOrder()
  const statusLabels = ['Open', 'Filled', 'Partial', 'Cancelled']

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary text-sm">
        No orders yet. Place an order to get started.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-text-secondary text-xs">
            <th className="text-left px-4 py-3 font-medium">ID</th>
            <th className="text-left px-4 py-3 font-medium">Type</th>
            <th className="text-right px-4 py-3 font-medium">Price</th>
            <th className="text-right px-4 py-3 font-medium">Amount</th>
            <th className="text-right px-4 py-3 font-medium">Filled</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
            <th className="text-right px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order: any, i: number) => {
            const isMkt = isMarketOrder(order)
            const sideLabel = order.side === 0 ? 'Long' : 'Short'
            const typeLabel = isMkt ? `Market ${sideLabel}` : `Limit ${sideLabel}`
            const fillPct = order.amount > 0n
              ? Number((BigInt(order.filled) * 100n) / BigInt(order.amount))
              : 0
            return (
              <tr key={i} className="border-b border-border/50 hover:bg-surface-2/50">
                <td className="px-4 py-3">
                  <a
                    href={`${EXPLORER_URL}/address/${CONTRACTS.OrderBook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary-hover transition-colors"
                  >
                    #{Number(order.id)}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    order.side === 0 ? 'bg-long/10 text-long' : 'bg-short/10 text-short'
                  )}>
                    {typeLabel}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-text font-mono">
                  {isMkt ? <span className="text-text-secondary italic">Market</span> : `$${formatPrice(order.price)}`}
                </td>
                <td className="px-4 py-3 text-right text-text font-mono">{Number(order.amount)}</td>
                <td className="px-4 py-3 text-right text-text font-mono">{fillPct}%</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    order.status === 0 ? 'bg-primary/10 text-primary' :
                    order.status === 1 ? 'bg-success/10 text-success' :
                    order.status === 2 ? 'bg-warning/10 text-warning' :
                    'bg-text-secondary/10 text-text-secondary'
                  )}>
                    {statusLabels[order.status] || 'Unknown'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {(order.status === 0 || order.status === 2) && (
                    <button
                      onClick={() => cancelOrder(order.id)}
                      disabled={isPending}
                      className="px-3 py-1 text-xs rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
