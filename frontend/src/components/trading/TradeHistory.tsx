import { useEffect, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem } from 'viem'
import { CONTRACTS } from '../../lib/config'
import { cn } from '../../lib/utils'

const EXPLORER_URL = 'https://testnet.snowtrace.io'

// New event (with fee system)
const OrderMatchedEventNew = parseAbiItem(
  'event OrderMatched(uint256 indexed bidOrderId, uint256 indexed askOrderId, uint256 price, uint256 amount, uint256 positionIdLong, uint256 positionIdShort, uint256 takerFee)'
)
// Old event (pre-fee contract)
const OrderMatchedEventOld = parseAbiItem(
  'event OrderMatched(uint256 indexed bidOrderId, uint256 indexed askOrderId, uint256 price, uint256 amount, uint256 positionIdLong, uint256 positionIdShort)'
)

type Trade = {
  bidOrderId: bigint
  askOrderId: bigint
  price: bigint
  amount: bigint
  takerFee: bigint
  txHash: string
  blockNumber: bigint
  timestamp: number | null
}

export function TradeHistory() {
  const publicClient = usePublicClient()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!publicClient) return

    let cancelled = false

    async function fetchTrades() {
      try {
        const currentBlock = await publicClient!.getBlockNumber()
        // Fetch last ~5000 blocks (roughly a few hours on Fuji)
        const fromBlock = currentBlock > 5000n ? currentBlock - 5000n : 0n

        // Try new event first, fallback to old (pre-fee contract)
        let logs: any[] = []
        try {
          logs = await publicClient!.getLogs({
            address: CONTRACTS.OrderBook,
            event: OrderMatchedEventNew,
            fromBlock,
            toBlock: 'latest',
          })
        } catch { /* ignore */ }
        if (logs.length === 0) {
          try {
            logs = await publicClient!.getLogs({
              address: CONTRACTS.OrderBook,
              event: OrderMatchedEventOld,
              fromBlock,
              toBlock: 'latest',
            })
          } catch { /* ignore */ }
        }

        if (cancelled) return

        // Get block timestamps for the most recent trades (last 50)
        const recentLogs = logs.slice(-50).reverse()

        const tradesWithTimestamps = await Promise.all(
          recentLogs.map(async (log: any) => {
            let timestamp: number | null = null
            try {
              const block = await publicClient!.getBlock({ blockNumber: log.blockNumber })
              timestamp = Number(block.timestamp)
            } catch { /* ignore */ }

            return {
              bidOrderId: log.args.bidOrderId!,
              askOrderId: log.args.askOrderId!,
              price: log.args.price!,
              amount: log.args.amount!,
              takerFee: log.args.takerFee ?? 0n,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              timestamp,
            }
          })
        )

        if (!cancelled) {
          setTrades(tradesWithTimestamps)
          setLoading(false)
        }
      } catch (err) {
        console.error('Failed to fetch trade history:', err)
        if (!cancelled) setLoading(false)
      }
    }

    fetchTrades()

    // Refresh every 30 seconds
    const interval = setInterval(fetchTrades, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [publicClient])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-text-secondary text-sm">
        Loading trades...
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-text-secondary text-sm">No trades yet</p>
        <p className="text-text-secondary/60 text-xs mt-1">
          Matched trades will appear here
        </p>
      </div>
    )
  }

  function formatTradeTime(timestamp: number | null) {
    if (!timestamp) return '--'
    const d = new Date(timestamp * 1000)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }



  function formatTradePrice(price: bigint) {
    return (Number(price) / 1e8).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Price
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Size
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Fee
            </th>
            <th className="px-3 py-2 text-left text-[10px] font-medium text-text-secondary uppercase tracking-wider">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, i) => {
            // Color by price direction vs next trade (older) — up = long, down = short
            const nextTrade = trades[i + 1]
            const isUp = nextTrade ? trade.price >= nextTrade.price : true
            return (
              <tr
                key={`${trade.txHash}-${i}`}
                onClick={() => window.open(`${EXPLORER_URL}/tx/${trade.txHash}`, '_blank')}
                className="border-b border-border/50 hover:bg-surface-2/30 transition-colors cursor-pointer"
              >
                <td className={cn('px-3 py-1.5 text-xs font-mono', isUp ? 'text-long' : 'text-short')}>
                  ${formatTradePrice(trade.price)}
                </td>
                <td className="px-3 py-1.5 text-xs text-text font-mono">
                  {trade.amount.toString()}
                </td>
                <td className="px-3 py-1.5 text-xs font-mono text-text-secondary">
                  {trade.takerFee > 0n ? `$${(Number(trade.takerFee) / 1e6).toFixed(2)}` : '—'}
                </td>
                <td className="px-3 py-1.5 text-xs font-mono text-text-secondary">
                  {formatTradeTime(trade.timestamp)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
