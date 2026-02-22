import { useUserOpenPositions, useSettlePosition } from '../../hooks/usePositions'
import { useAllMarkets } from '../../hooks/useForwardMarket'
import { useOraclePrice } from '../../hooks/usePriceData'
import { formatPrice, formatUSDC, formatExpiryDate, cn } from '../../lib/utils'
import { PRICE_PRECISION, COLLATERAL_PRECISION } from '../../lib/config'
import type { Position } from '../../hooks/usePositions'
import type { MarketInfo } from '../../hooks/useForwardMarket'

type PositionRowProps = {
  position: Position
  market: MarketInfo | undefined
}

function PositionRow({ position, market }: PositionRowProps) {
  const baseAsset = market?.baseAsset ?? '?'
  const quoteAsset = market?.quoteAsset ?? '?'
  const { data: priceData } = useOraclePrice(baseAsset)
  const currentPrice = priceData ? (priceData as [bigint, bigint])[0] : null

  const { settlePosition, isPending, isConfirming } = useSettlePosition()

  // Calculate unrealized PnL
  // For LONG: pnl = (currentPrice - entryPrice) * size / PRICE_PRECISION
  // For SHORT: pnl = (entryPrice - currentPrice) * size / PRICE_PRECISION
  // Output in USDC (6 decimals)
  const pnl = (() => {
    if (!currentPrice || position.entryPrice === 0n) return null
    let diff: bigint
    if (position.side === 0) {
      // LONG
      diff = currentPrice - position.entryPrice
    } else {
      // SHORT
      diff = position.entryPrice - currentPrice
    }
    // pnl in USDC = diff * size * COLLATERAL_PRECISION / PRICE_PRECISION
    return (diff * position.size * BigInt(COLLATERAL_PRECISION)) / BigInt(PRICE_PRECISION)
  })()

  const pnlNum = pnl !== null ? Number(pnl) / COLLATERAL_PRECISION : null
  const isSettled = market?.settled ?? false

  return (
    <tr className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
      <td className="px-3 py-2.5 text-xs text-text font-medium">
        {baseAsset}/{quoteAsset}{market ? ` ${formatExpiryDate(market.expiration)}` : ''}
      </td>
      <td className="px-3 py-2.5 text-xs">
        <span
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-semibold',
            position.side === 0
              ? 'bg-long/10 text-long'
              : 'bg-short/10 text-short'
          )}
        >
          {position.side === 0 ? 'LONG' : 'SHORT'}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-text font-mono">
        ${formatPrice(position.entryPrice)}
      </td>
      <td className="px-3 py-2.5 text-xs text-text font-mono">
        {position.size.toString()}
      </td>
      <td className="px-3 py-2.5 text-xs text-text font-mono">
        ${formatUSDC(position.collateral)}
      </td>
      <td className="px-3 py-2.5 text-xs font-mono">
        {pnlNum !== null ? (
          <span className={cn(pnlNum >= 0 ? 'text-long' : 'text-short')}>
            {pnlNum >= 0 ? '+' : ''}${pnlNum.toFixed(2)}
          </span>
        ) : (
          <span className="text-text-secondary">--</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs">
        {isSettled && (
          <button
            onClick={() => settlePosition(position.id)}
            disabled={isPending || isConfirming}
            className="px-2.5 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isPending ? 'Confirm...' : isConfirming ? 'Settling...' : 'Settle'}
          </button>
        )}
      </td>
    </tr>
  )
}

export function PositionTable() {
  const { data: positionsData, isLoading: positionsLoading } = useUserOpenPositions()
  const { data: marketsData } = useAllMarkets()

  const positions = (positionsData as Position[] | undefined) ?? []
  const markets = (marketsData as MarketInfo[] | undefined) ?? []

  const getMarketForPosition = (pos: Position): MarketInfo | undefined => {
    return markets.find((m) => m.id === pos.marketId)
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
        <p className="text-text-secondary/60 text-xs mt-1">
          Place an order to open a position
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Market
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Side
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Entry Price
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Size
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Collateral
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              PnL
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => (
            <PositionRow
              key={position.id.toString()}
              position={position}
              market={getMarketForPosition(position)}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
