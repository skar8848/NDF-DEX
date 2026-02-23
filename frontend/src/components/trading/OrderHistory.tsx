import { useEffect, useMemo, useRef, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem } from 'viem'
import { useUserOrders, useCancelOrder } from '../../hooks/useOrderBook'
import { formatPrice, paginatedGetLogs } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { CONTRACTS } from '../../lib/config'
import type { Order } from '../../hooks/useOrderBook'

const ORDER_STATUS_LABELS: Record<number, string> = {
  0: 'Open',
  1: 'Filled',
  2: 'Partial',
  3: 'Cancelled',
}

const ORDER_STATUS_COLORS: Record<number, string> = {
  0: 'text-primary bg-primary/10',
  1: 'text-long bg-long/10',
  2: 'text-warning bg-warning/10',
  3: 'text-text-secondary bg-surface-2',
}

const OrderMatchedEventNew = parseAbiItem(
  'event OrderMatched(uint256 indexed bidOrderId, uint256 indexed askOrderId, uint256 price, uint256 amount, uint256 positionIdLong, uint256 positionIdShort, uint256 takerFee)'
)
const OrderMatchedEventOld = parseAbiItem(
  'event OrderMatched(uint256 indexed bidOrderId, uint256 indexed askOrderId, uint256 price, uint256 amount, uint256 positionIdLong, uint256 positionIdShort)'
)


function OrderRow({ order, fillPrice, fee, isTaker }: { order: Order; fillPrice: bigint | null; fee: bigint; isTaker: boolean }) {
  const { cancelOrder, isPending, isConfirming } = useCancelOrder()

  const isOpen = order.status === 0 || order.status === 2
  const fillPercent =
    order.amount > 0n
      ? Number((order.filled * 100n) / order.amount)
      : 0
  const sideLabel = order.side === 0 ? 'Long' : 'Short'
  const isMarket = order.timeInForce === 1 // IOC = market order
  const typeLabel = isMarket ? `Market ${sideLabel}` : `Limit ${sideLabel}`

  // Always show fill price when available (VWAP from events), fallback to order price
  const displayPrice = fillPrice ?? order.price

  return (
    <tr className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
      <td className="px-3 py-2.5 text-xs font-mono text-text">
        #{order.id.toString()}
      </td>
      <td className="px-3 py-2.5 text-xs">
        <span
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-semibold',
            order.side === 0
              ? 'bg-long/10 text-long'
              : 'bg-short/10 text-short'
          )}
        >
          {typeLabel}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-text font-mono">
        {displayPrice
          ? `$${formatPrice(displayPrice)}`
          : '--'}
      </td>
      <td className="px-3 py-2.5 text-xs text-text font-mono">
        {order.amount.toString()}
      </td>
      <td className="px-3 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                order.side === 0 ? 'bg-long' : 'bg-short'
              )}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
          <span className="text-text-secondary font-mono text-[10px]">
            {fillPercent}%
          </span>
        </div>
      </td>
      <td className={cn('px-3 py-2.5 text-xs font-mono', fee > 0n ? (isTaker ? 'text-short' : 'text-long') : 'text-text-secondary')}>
        {fee > 0n
          ? isTaker
            ? `-$${(Number(fee) / 1e6).toFixed(2)}`
            : `+$${(Number(fee) / 1e6).toFixed(2)}`
          : '—'}
      </td>
      <td className="px-3 py-2.5 text-xs">
        <span
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-medium',
            ORDER_STATUS_COLORS[order.status] ?? 'text-text-secondary'
          )}
        >
          {ORDER_STATUS_LABELS[order.status] ?? 'Unknown'}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs">
        {isOpen && (
          <button
            onClick={() => cancelOrder(order.id)}
            disabled={isPending || isConfirming}
            className="px-2.5 py-1 text-[10px] font-medium rounded bg-short/10 text-short border border-short/20 hover:bg-short/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isPending ? 'Confirm...' : isConfirming ? 'Cancelling...' : 'Cancel'}
          </button>
        )}
      </td>
    </tr>
  )
}

type OrderHistoryProps = {
  /** 'open' = only open/partial limit orders, 'all' = full history */
  filter?: 'open' | 'all'
}

export function OrderHistory({ filter = 'all' }: OrderHistoryProps) {
  const { data: ordersData, isLoading } = useUserOrders()
  const allOrders = (ordersData as Order[] | undefined) ?? []
  const publicClient = usePublicClient()

  // Apply filter
  const orders = filter === 'open'
    ? allOrders.filter(o => o.status === 0 || o.status === 2)
    : allOrders

  // Fetch weighted average fill prices + fees from OrderMatched events
  const [fillPrices, setFillPrices] = useState<Record<string, bigint>>({})
  const [orderFees, setOrderFees] = useState<Record<string, bigint>>({})
  const [orderIsTaker, setOrderIsTaker] = useState<Record<string, boolean>>({})

  // Stable key: only re-fetch when the set of filled order IDs actually changes
  // (avoids cancellation race when orders array ref changes every 5s refetch)
  const ordersRef = useRef(orders)
  ordersRef.current = orders
  const filledOrderKey = useMemo(() =>
    orders.filter(o => o.filled > 0n).map(o => o.id.toString()).sort().join(','),
    [orders]
  )

  useEffect(() => {
    if (!publicClient || !filledOrderKey) return

    const currentOrders = ordersRef.current
    const filledOrders = currentOrders.filter(o => o.filled > 0n)
    if (filledOrders.length === 0) return

    let cancelled = false

    async function fetchFillPrices() {
      try {
        const currentBlock = await publicClient!.getBlockNumber()
        const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n

        // Paginated getLogs (Fuji RPC limits to 2048 blocks per query)
        let logs: any[] = []
        try {
          logs = await paginatedGetLogs(publicClient!, {
            address: CONTRACTS.OrderBook,
            event: OrderMatchedEventNew,
            fromBlock,
            toBlock: currentBlock,
          })
        } catch { /* ignore */ }
        if (logs.length === 0) {
          try {
            logs = await paginatedGetLogs(publicClient!, {
              address: CONTRACTS.OrderBook,
              event: OrderMatchedEventOld,
              fromBlock,
              toBlock: currentBlock,
            })
          } catch { /* ignore */ }
        }

        // Build set of filled order IDs for fast lookup
        const filledIds = new Set(filledOrders.map(o => o.id.toString()))
        const filledSides = new Map(filledOrders.map(o => [o.id.toString(), o.side]))

        // Accumulate VWAP + fees per order from all matched logs
        const accum: Record<string, { totalValue: bigint; totalAmount: bigint }> = {}
        const fees: Record<string, bigint> = {}
        const takerMap: Record<string, boolean> = {}
        for (const log of logs) {
          const bidId = log.args.bidOrderId!.toString()
          const askId = log.args.askOrderId!.toString()
          const bidNum = BigInt(log.args.bidOrderId!)
          const askNum = BigInt(log.args.askOrderId!)
          const p = BigInt(log.args.price!)
          const a = BigInt(log.args.amount!)
          const takerFee = BigInt(log.args.takerFee ?? 0n)
          // Taker = higher order ID (placed last, triggered matching)
          const takerIsBid = bidNum > askNum
          // Maker rebate = takerFee * 2/5 (2bps rebate on 5bps taker fee)
          const makerRebate = takerFee * 2n / 5n

          // Match bid side (long orders)
          if (filledIds.has(bidId) && filledSides.get(bidId) === 0) {
            if (!accum[bidId]) accum[bidId] = { totalValue: 0n, totalAmount: 0n }
            accum[bidId].totalValue += p * a
            accum[bidId].totalAmount += a
            takerMap[bidId] = takerIsBid
            fees[bidId] = (fees[bidId] ?? 0n) + (takerIsBid ? takerFee : makerRebate)
          }
          // Match ask side (short orders)
          if (filledIds.has(askId) && filledSides.get(askId) === 1) {
            if (!accum[askId]) accum[askId] = { totalValue: 0n, totalAmount: 0n }
            accum[askId].totalValue += p * a
            accum[askId].totalAmount += a
            takerMap[askId] = !takerIsBid
            fees[askId] = (fees[askId] ?? 0n) + (!takerIsBid ? takerFee : makerRebate)
          }
        }

        const prices: Record<string, bigint> = {}
        for (const [id, { totalValue, totalAmount }] of Object.entries(accum)) {
          if (totalAmount > 0n) prices[id] = totalValue / totalAmount
        }

        if (!cancelled) {
          setFillPrices(prices)
          setOrderFees(fees)
          setOrderIsTaker(takerMap)
        }
      } catch (err) {
        console.error('Failed to fetch fill prices:', err)
      }
    }

    fetchFillPrices()
    return () => { cancelled = true }
  }, [publicClient, filledOrderKey])

  // Sort by timestamp descending (most recent first)
  const sortedOrders = [...orders].sort((a, b) => {
    if (a.timestamp > b.timestamp) return -1
    if (a.timestamp < b.timestamp) return 1
    return 0
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-text-secondary text-sm">
        Loading orders...
      </div>
    )
  }

  if (sortedOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-text-secondary text-sm">No orders yet</p>
        <p className="text-text-secondary/60 text-xs mt-1">
          Your order history will appear here
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
              ID
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Type
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Price
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Amount
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Filled
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Fee
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Status
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedOrders.map((order) => (
            <OrderRow
              key={order.id.toString()}
              order={order}
              fillPrice={fillPrices[order.id.toString()] ?? null}
              fee={orderFees[order.id.toString()] ?? 0n}
              isTaker={orderIsTaker[order.id.toString()] ?? true}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
