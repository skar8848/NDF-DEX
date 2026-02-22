import { useState, useMemo } from 'react'
import { useUserOpenPositions, useBatchSettle } from '../../hooks/usePositions'
import { useAllMarkets } from '../../hooks/useForwardMarket'
import { useOraclePrice } from '../../hooks/usePriceData'
import { formatPrice, formatUSDC, formatExpiryDate, cn } from '../../lib/utils'
import { PRICE_PRECISION, COLLATERAL_PRECISION } from '../../lib/config'
import type { Position } from '../../hooks/usePositions'
import type { MarketInfo } from '../../hooks/useForwardMarket'

function usePnl(position: Position, market: MarketInfo | undefined) {
  const baseAsset = market?.baseAsset ?? ''
  const { data: priceData } = useOraclePrice(baseAsset)
  const currentPrice = priceData ? (priceData as [bigint, bigint])[0] : null

  if (!currentPrice || position.entryPrice === 0n) return null
  const diff = position.side === 0
    ? currentPrice - position.entryPrice
    : position.entryPrice - currentPrice
  return (diff * position.size * BigInt(COLLATERAL_PRECISION)) / BigInt(PRICE_PRECISION)
}

type PositionRowProps = {
  position: Position
  market: MarketInfo | undefined
  selected: boolean
  onToggle: () => void
}

function PositionRow({ position, market, selected, onToggle }: PositionRowProps) {
  const baseAsset = market?.baseAsset ?? '?'
  const quoteAsset = market?.quoteAsset ?? '?'
  const pnl = usePnl(position, market)
  const pnlNum = pnl !== null ? Number(pnl) / COLLATERAL_PRECISION : null
  const isSettled = market?.settled ?? false

  return (
    <tr className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
      <td className="px-3 py-2.5 text-xs">
        {isSettled && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="w-3.5 h-3.5 rounded border-border accent-primary cursor-pointer"
          />
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-text font-medium">
        {baseAsset}/{quoteAsset}{market ? ` ${formatExpiryDate(market.expiration)}` : ''}
      </td>
      <td className="px-3 py-2.5 text-xs">
        <span
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-semibold',
            position.side === 0 ? 'bg-long/10 text-long' : 'bg-short/10 text-short'
          )}
        >
          {position.side === 0 ? 'LONG' : 'SHORT'}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-text font-mono">${formatPrice(position.entryPrice)}</td>
      <td className="px-3 py-2.5 text-xs text-text font-mono">{position.size.toString()}</td>
      <td className="px-3 py-2.5 text-xs text-text font-mono">${formatUSDC(position.collateral)}</td>
      <td className="px-3 py-2.5 text-xs font-mono">
        {pnlNum !== null ? (
          <span className={cn(pnlNum >= 0 ? 'text-long' : 'text-short')}>
            {pnlNum >= 0 ? '+' : ''}${pnlNum.toFixed(2)}
          </span>
        ) : (
          <span className="text-text-secondary">--</span>
        )}
      </td>
    </tr>
  )
}

export function PositionTable() {
  const { data: positionsData, isLoading: positionsLoading } = useUserOpenPositions()
  const { data: marketsData } = useAllMarkets()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const { batchSettle, isSettling } = useBatchSettle()

  const positions = (positionsData as Position[] | undefined) ?? []
  const markets = (marketsData as MarketInfo[] | undefined) ?? []

  const getMarket = (pos: Position) => markets.find((m) => m.id === pos.marketId)

  const settleable = useMemo(
    () => positions.filter((p) => getMarket(p)?.settled),
    [positions, markets]
  )

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
      setSelectedIds(new Set(settleable.map((p) => p.id.toString())))
    }
  }

  const handleBatchSettle = () => {
    const ids = positions
      .filter((p) => selectedIds.has(p.id.toString()))
      .map((p) => p.id)
    batchSettle(ids)
  }

  if (positionsLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-text-secondary text-sm">
        Loading positions...
      </div>
    )
  }

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-text-secondary text-sm">No open positions</p>
        <p className="text-text-secondary/60 text-xs mt-1">Place an order to open a position</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      {settleable.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <button
            onClick={handleBatchSettle}
            disabled={selectedIds.size === 0 || isSettling}
            className="px-3 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 w-8"></th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">Market</th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">Side</th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">Entry Price</th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">Size</th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">Collateral</th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">PnL</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <PositionRow
              key={position.id.toString()}
              position={position}
              market={getMarket(position)}
              selected={selectedIds.has(position.id.toString())}
              onToggle={() => toggleId(position.id.toString())}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
