import { useUserOrders, useCancelOrder } from '../../hooks/useOrderBook'
import { formatPrice } from '../../lib/utils'
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

const EXPLORER_URL = 'https://testnet.snowtrace.io'

// Market orders use extreme prices: uint256.max/2 for LONG, 1 for SHORT
const MARKET_ORDER_THRESHOLD = BigInt('1000000000000000000') // 10^18
function isMarketOrder(order: Order): boolean {
  return order.price > MARKET_ORDER_THRESHOLD || order.price <= 1n
}

function OrderRow({ order }: { order: Order }) {
  const { cancelOrder, isPending, isConfirming } = useCancelOrder()

  const isOpen = order.status === 0 || order.status === 2
  const fillPercent =
    order.amount > 0n
      ? Number((order.filled * 100n) / order.amount)
      : 0
  const isMkt = isMarketOrder(order)
  const sideLabel = order.side === 0 ? 'Long' : 'Short'
  const typeLabel = isMkt ? `Market ${sideLabel}` : `Limit ${sideLabel}`

  return (
    <tr className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
      <td className="px-3 py-2.5 text-xs font-mono">
        <a
          href={`${EXPLORER_URL}/address/${CONTRACTS.OrderBook}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary-hover transition-colors"
        >
          #{order.id.toString()}
        </a>
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
        {isMkt ? <span className="text-text-secondary italic">Market</span> : `$${formatPrice(order.price)}`}
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
            {order.filled.toString()}/{order.amount.toString()}
          </span>
        </div>
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

export function OrderHistory() {
  const { data: ordersData, isLoading } = useUserOrders()
  const orders = (ordersData as Order[] | undefined) ?? []

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
              Status
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedOrders.map((order) => (
            <OrderRow key={order.id.toString()} order={order} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
