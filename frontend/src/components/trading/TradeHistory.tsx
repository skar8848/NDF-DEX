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

  function formatTradeDate(timestamp: number | null) {
    if (!timestamp) return ''
    const d = new Date(timestamp * 1000)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
              Time
            </th>
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
              Tx
            </th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, i) => (
            <tr key={`${trade.txHash}-${i}`} className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
              <td className="px-3 py-2 text-xs font-mono">
                <span className="text-text">{formatTradeTime(trade.timestamp)}</span>
                <span className="text-text-secondary ml-1.5 text-[10px]">{formatTradeDate(trade.timestamp)}</span>
              </td>
              <td className="px-3 py-2 text-xs text-text font-mono">
                ${formatTradePrice(trade.price)}
              </td>
              <td className="px-3 py-2 text-xs text-text font-mono">
                {trade.amount.toString()}
              </td>
              <td className="px-3 py-2 text-xs text-text-secondary font-mono">
                {trade.takerFee > 0n
                  ? `$${(Number(trade.takerFee) / 1e6).toFixed(2)}`
                  : '--'}
              </td>
              <td className="px-3 py-2 text-xs">
                <a
                  href={`${EXPLORER_URL}/tx/${trade.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium',
                    'bg-primary/10 text-primary hover:bg-primary/20 transition-colors'
                  )}
                >
                  {trade.txHash.slice(0, 6)}...{trade.txHash.slice(-4)}
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
