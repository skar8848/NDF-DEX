import { useState, useEffect, useRef, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, parseAbiItem } from 'viem'
import { createChart, AreaSeries, LineSeries } from 'lightweight-charts'
import type { IChartApi, Time } from 'lightweight-charts'
import { CONTRACTS } from '../lib/config'
import { paginatedGetLogs } from '../lib/utils'
import { PositionManagerABI, OrderBookABI } from '../lib/abis'
import { useAllMarkets, type MarketInfo } from '../hooks/useForwardMarket'
import { toast } from 'sonner'
import { useTheme } from '../hooks/useTheme'

const EXPLORER_URL = 'https://testnet.snowtrace.io'

const TenorVaultABI = [
  { type: 'function', name: 'deposit', inputs: [{ name: 'usdcAmount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'requestWithdraw', inputs: [{ name: 'shares', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'executeWithdraw', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'cancelWithdraw', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'sharePrice', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalValue', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'withdrawalDelay', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'withdrawRequests', inputs: [{ name: '', type: 'address' }], outputs: [{ name: 'shares', type: 'uint256' }, { name: 'requestTime', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalDeposited', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'totalWithdrawn', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

const MockUSDCABI = [
  { type: 'function', name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

const vaultAddr = CONTRACTS.TenorVault as `0x${string}`

const DepositedEvent = parseAbiItem('event Deposited(address indexed user, uint256 usdcAmount, uint256 sharesReceived)')
const USDCTransferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')
const TLPTransferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

type ChartPoint = { time: number; value: number }
type UserDeposit = { usdcAmount: bigint; sharesReceived: bigint; txHash: string; timestamp: number }
type DepositorInfo = { address: `0x${string}`; tlpBalance: bigint; valueUsd: number }

function fmtUsdc(v: bigint) {
  return Number(formatUnits(v, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtTlp(v: bigint) {
  return Number(formatUnits(v, 18)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function truncAddr(addr: string) {
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

export function Vault() {
  const { theme } = useTheme()
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [chartMode, setChartMode] = useState<'tvl' | 'sharePrice'>('tvl')

  // Chart data
  const [tvlHistory, setTvlHistory] = useState<ChartPoint[]>([])
  const [sharePriceHistory, setSharePriceHistory] = useState<ChartPoint[]>([])
  const [userDeposits, setUserDeposits] = useState<UserDeposit[]>([])
  const [depositors, setDepositors] = useState<DepositorInfo[]>([])
  const [userTotalDeposited, setUserTotalDeposited] = useState(0n)
  const [vaultCreatedAt, setVaultCreatedAt] = useState<number | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  // Contract reads
  const { data: sharePrice } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'sharePrice', query: { refetchInterval: 5000 } })
  const { data: totalValue } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'totalValue', query: { refetchInterval: 5000 } })
  const { data: myShares } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 5000 } })
  const { data: withdrawalDelay } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'withdrawalDelay' })
  const { data: withdrawRequest } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'withdrawRequests', args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 5000 } })
  const { data: usdcBalance } = useReadContract({ address: CONTRACTS.MockUSDC, abi: MockUSDCABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 5000 } })
  const { data: totalDepositedRaw } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'totalDeposited', query: { refetchInterval: 10000 } })
  const { data: totalWithdrawnRaw } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'totalWithdrawn', query: { refetchInterval: 10000 } })

  // Vault positions & orders
  const { data: vaultPositions } = useReadContract({
    address: CONTRACTS.PositionManager as `0x${string}`,
    abi: PositionManagerABI,
    functionName: 'getUserOpenPositions',
    args: [vaultAddr],
    query: { refetchInterval: 10000 },
  })
  const { data: vaultOrders } = useReadContract({
    address: CONTRACTS.OrderBook as `0x${string}`,
    abi: OrderBookABI,
    functionName: 'getUserOrders',
    args: [vaultAddr],
    query: { refetchInterval: 10000 },
  })
  const { data: marketsRaw } = useAllMarkets()
  const markets = marketsRaw as MarketInfo[] | undefined

  const { writeContract: writeApprove, data: approveHash } = useWriteContract()
  const { writeContract: writeVault, data: vaultHash } = useWriteContract()
  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isVaultTx } = useWaitForTransactionReceipt({ hash: vaultHash })
  const isPending = isApproving || isVaultTx

  const sharePriceNum = sharePrice ? Number(sharePrice as bigint) / 1e18 : 1
  const mySharesBig = (myShares as bigint) ?? 0n
  const myValueUsd = mySharesBig > 0n && sharePrice ? Number(mySharesBig) / 1e18 * sharePriceNum : 0
  const pendingReq = withdrawRequest as [bigint, bigint] | undefined
  const hasPendingWithdraw = pendingReq && pendingReq[0] > 0n
  const delayHours = withdrawalDelay ? Number(withdrawalDelay as bigint) / 3600 : 24

  // APR (30d) calculation
  const totalDep = (totalDepositedRaw as bigint) ?? 0n
  const totalWith = (totalWithdrawnRaw as bigint) ?? 0n
  const tvlBig = (totalValue as bigint) ?? 0n
  const apr = (() => {
    if (tvlBig === 0n || !vaultCreatedAt) return null
    const tvlNum = Number(tvlBig) / 1e6
    const depNum = Number(totalDep) / 1e6
    const withNum = Number(totalWith) / 1e6
    const profit = tvlNum - depNum + withNum
    if (profit <= 0) return 0
    const daysActive = Math.max(1, (Date.now() / 1000 - vaultCreatedAt) / 86400)
    return (profit / tvlNum) * (365 / daysActive) * 100
  })()

  // User P&L
  const userPnl = myValueUsd - Number(userTotalDeposited) / 1e6
  const marketName = useCallback((id: bigint) => {
    const m = markets?.find(m => m.id === id)
    return m ? m.baseAsset : `#${id}`
  }, [markets])

  // Fetch event data (TVL history, share price history, user deposits, depositors)
  useEffect(() => {
    if (!publicClient) return
    let cancelled = false

    async function fetchEventData() {
      try {
        const currentBlock = await publicClient!.getBlockNumber()
        const fromBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n

        // 1. USDC Transfer events to/from vault (for TVL history)
        // Paginated — Fuji RPC limits to 2048 blocks per query
        const [logsIn, logsOut] = await Promise.all([
          paginatedGetLogs(publicClient!, {
            address: CONTRACTS.MockUSDC,
            event: USDCTransferEvent,
            args: { to: vaultAddr },
            fromBlock,
            toBlock: currentBlock,
          }),
          paginatedGetLogs(publicClient!, {
            address: CONTRACTS.MockUSDC,
            event: USDCTransferEvent,
            args: { from: vaultAddr },
            fromBlock,
            toBlock: currentBlock,
          }),
        ])

        if (cancelled) return

        // Merge and sort by block
        type TxLog = { blockNumber: bigint; value: bigint; isDeposit: boolean }
        const allTxs: TxLog[] = [
          ...logsIn.map(l => ({ blockNumber: l.blockNumber, value: l.args.value!, isDeposit: true })),
          ...logsOut.map(l => ({ blockNumber: l.blockNumber, value: l.args.value!, isDeposit: false })),
        ].sort((a, b) => Number(a.blockNumber - b.blockNumber))

        // Get timestamps for unique blocks
        const uniqueBlocks = [...new Set(allTxs.map(t => t.blockNumber))]
        const blockTimestamps = new Map<bigint, number>()
        await Promise.all(
          uniqueBlocks.map(async (bn) => {
            try {
              const block = await publicClient!.getBlock({ blockNumber: bn })
              blockTimestamps.set(bn, Number(block.timestamp))
            } catch { /* skip */ }
          })
        )

        if (cancelled) return

        // Build TVL history
        let runningTvl = 0
        const tvlPoints: ChartPoint[] = []
        const seenTimes = new Set<number>()
        for (const tx of allTxs) {
          const ts = blockTimestamps.get(tx.blockNumber)
          if (!ts) continue
          const val = Number(tx.value) / 1e6
          runningTvl += tx.isDeposit ? val : -val
          if (!seenTimes.has(ts)) {
            tvlPoints.push({ time: ts, value: Math.max(0, runningTvl) })
            seenTimes.add(ts)
          } else {
            // Update last point at same timestamp
            const last = tvlPoints[tvlPoints.length - 1]
            if (last) last.value = Math.max(0, runningTvl)
          }
        }

        // Set vault creation timestamp
        if (tvlPoints.length > 0 && !cancelled) {
          setVaultCreatedAt(tvlPoints[0].time)
        }

        // 2. Deposited events for share price history + user deposits
        const depositLogs = await paginatedGetLogs(publicClient!, {
          address: vaultAddr,
          event: DepositedEvent,
          fromBlock,
          toBlock: currentBlock,
        })

        if (cancelled) return

        const spPoints: ChartPoint[] = []
        const myDeposits: UserDeposit[] = []
        let myTotalDep = 0n

        for (const log of depositLogs) {
          const ts = blockTimestamps.get(log.blockNumber) ?? 0
          const usdcAmt = log.args.usdcAmount!
          const shares = log.args.sharesReceived!
          if (shares > 0n) {
            const impliedPrice = (Number(usdcAmt) / 1e6) / (Number(shares) / 1e18)
            if (ts > 0 && impliedPrice > 0 && impliedPrice < 1e6) {
              spPoints.push({ time: ts, value: impliedPrice })
            }
          }
          // User deposits
          if (address && log.args.user?.toLowerCase() === address.toLowerCase()) {
            let timestamp = ts
            if (!timestamp) {
              try {
                const block = await publicClient!.getBlock({ blockNumber: log.blockNumber })
                timestamp = Number(block.timestamp)
              } catch { /* skip */ }
            }
            myDeposits.push({
              usdcAmount: usdcAmt,
              sharesReceived: shares,
              txHash: log.transactionHash,
              timestamp,
            })
            myTotalDep += usdcAmt
          }
        }

        if (cancelled) return

        setTvlHistory(tvlPoints)
        setSharePriceHistory(spPoints)
        setUserDeposits(myDeposits)
        setUserTotalDeposited(myTotalDep)

        // 3. TLP Transfer events from 0x0 (mints) for depositors
        const mintLogs = await paginatedGetLogs(publicClient!, {
          address: vaultAddr,
          event: TLPTransferEvent,
          args: { from: '0x0000000000000000000000000000000000000000' as `0x${string}` },
          fromBlock,
          toBlock: currentBlock,
        })

        if (cancelled) return

        const uniqueAddrs = [...new Set(mintLogs.map(l => l.args.to!))].filter(Boolean) as `0x${string}`[]

        // Fetch current TLP balance for each depositor
        const depositorInfos: DepositorInfo[] = []
        const currentSharePrice = sharePrice ? Number(sharePrice as bigint) / 1e18 : 1
        for (const addr of uniqueAddrs) {
          try {
            const bal = await publicClient!.readContract({
              address: vaultAddr,
              abi: TenorVaultABI,
              functionName: 'balanceOf',
              args: [addr],
            }) as bigint
            const balNum = Number(bal) / 1e18
            depositorInfos.push({
              address: addr,
              tlpBalance: bal,
              valueUsd: balNum * currentSharePrice,
            })
          } catch { /* skip */ }
        }

        if (!cancelled) {
          setDepositors(depositorInfos.sort((a, b) => b.valueUsd - a.valueUsd))
        }
      } catch (err) {
        console.error('Vault: failed to fetch event data:', err)
      }
    }

    fetchEventData()
    const interval = setInterval(fetchEventData, 60000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [publicClient, address, sharePrice])

  // Render chart
  useEffect(() => {
    if (!chartContainerRef.current) return
    const data = chartMode === 'tvl' ? tvlHistory : sharePriceHistory
    if (data.length === 0) return

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const isDark = theme === 'dark'
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 250,
      layout: { background: { color: isDark ? '#0c0c1d' : '#ffffff' }, textColor: isDark ? '#8b8fa3' : '#6b7280' },
      grid: { vertLines: { color: isDark ? 'rgba(255,255,255,0.06)' : '#eeeeef' }, horzLines: { color: isDark ? 'rgba(255,255,255,0.06)' : '#eeeeef' } },
      timeScale: { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#1a1a1a', timeVisible: true },
      rightPriceScale: { borderColor: isDark ? 'rgba(255,255,255,0.15)' : '#1a1a1a' },
      crosshair: { horzLine: { color: isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db' }, vertLine: { color: isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db' } },
    })
    chartRef.current = chart

    if (chartMode === 'tvl') {
      const series = chart.addSeries(AreaSeries, {
        lineColor: '#f97316',
        topColor: 'rgba(249, 115, 22, 0.3)',
        bottomColor: 'rgba(249, 115, 22, 0.02)',
        lineWidth: 2,
        priceFormat: { type: 'custom', formatter: (p: number) => '$' + p.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
      })
      series.setData(data.map(d => ({ time: d.time as Time, value: d.value })))
    } else {
      const series = chart.addSeries(LineSeries, {
        color: '#22c55e',
        lineWidth: 2,
        priceFormat: { type: 'custom', formatter: (p: number) => '$' + p.toFixed(4) },
      })
      series.setData(data.map(d => ({ time: d.time as Time, value: d.value })))
    }

    chart.timeScale().fitContent()

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
    }
  }, [chartMode, tvlHistory, sharePriceHistory, theme])

  // Transaction handlers
  async function handleDeposit() {
    if (!depositInput || !address) return
    const amount = parseUnits(depositInput, 6)
    try {
      toast.info('Approving USDC...')
      writeApprove({ address: CONTRACTS.MockUSDC, abi: MockUSDCABI, functionName: 'approve', args: [vaultAddr, amount] })
      setTimeout(() => {
        toast.info('Depositing into vault...')
        writeVault({ address: vaultAddr, abi: TenorVaultABI, functionName: 'deposit', args: [amount] })
        setDepositInput('')
      }, 3000)
    } catch (e: any) {
      toast.error(e.message?.slice(0, 100))
    }
  }

  async function handleRequestWithdraw() {
    if (!withdrawInput || !address) return
    const shares = parseUnits(withdrawInput, 18)
    try {
      toast.info('Requesting withdrawal...')
      writeVault({ address: vaultAddr, abi: TenorVaultABI, functionName: 'requestWithdraw', args: [shares] })
      setWithdrawInput('')
    } catch (e: any) {
      toast.error(e.message?.slice(0, 100))
    }
  }

  async function handleExecuteWithdraw() {
    try {
      toast.info('Executing withdrawal...')
      writeVault({ address: vaultAddr, abi: TenorVaultABI, functionName: 'executeWithdraw' })
    } catch (e: any) {
      toast.error(e.message?.slice(0, 100))
    }
  }

  async function handleCancelWithdraw() {
    try {
      writeVault({ address: vaultAddr, abi: TenorVaultABI, functionName: 'cancelWithdraw' })
    } catch (e: any) {
      toast.error(e.message?.slice(0, 100))
    }
  }

  // Filter orders: OPEN (0) or PARTIAL (3)
  const openOrders = (vaultOrders as any[] | undefined)?.filter(
    (o: any) => o.status === 0 || o.status === 3
  ) ?? []

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* ── 2-COLUMN LAYOUT ── */}
      <div className="flex gap-6">

        {/* ════════ LEFT COLUMN ════════ */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Header: title + description */}
          <div className="bg-surface border border-border rounded-xl p-6">
            <h1 className="text-2xl font-bold text-text mb-1">TLP Vault</h1>
            <p className="text-sm text-text-secondary">
              Deposit USDC, earn yield from trading fees. TLP share price increases as revenue flows in.
            </p>
          </div>

          {/* Stat cards row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Total Value Locked</div>
              <div className="text-xl font-bold font-mono text-text">${totalValue ? fmtUsdc(totalValue as bigint) : '0.00'}</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Vault PNL</div>
              <div className="text-xl font-bold font-mono text-primary">
                {(() => {
                  const tvlNum = Number(tvlBig) / 1e6
                  const depNum = Number(totalDep) / 1e6
                  const withNum = Number(totalWith) / 1e6
                  const profit = tvlNum - depNum + withNum
                  return `$${profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                })()}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Vault APY (30d)</div>
              <div className="text-xl font-bold font-mono text-primary">{apr !== null ? `${apr.toFixed(1)}%` : '—'}</div>
            </div>
          </div>

          {/* Vault Performance / Your Performance tabs */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-6 px-5 border-b border-border">
              <button
                onClick={() => setChartMode('tvl')}
                className={`py-3 text-xs font-semibold cursor-pointer transition-colors border-b-2 ${chartMode === 'tvl' ? 'border-primary text-text' : 'border-transparent text-text-secondary hover:text-text'}`}
              >
                Vault Performance
              </button>
              <button
                onClick={() => setChartMode('sharePrice')}
                className={`py-3 text-xs font-semibold cursor-pointer transition-colors border-b-2 ${chartMode === 'sharePrice' ? 'border-primary text-text' : 'border-transparent text-text-secondary hover:text-text'}`}
              >
                Share Price
              </button>
            </div>

            {/* Stats row under tabs */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 px-5 py-4 border-b border-border text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">PNL</span>
                <span className="font-mono text-text font-medium">
                  {(() => {
                    const tvlNum = Number(tvlBig) / 1e6
                    const depNum = Number(totalDep) / 1e6
                    const withNum = Number(totalWith) / 1e6
                    const profit = tvlNum - depNum + withNum
                    return `$${profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Share Price</span>
                <span className="font-mono text-text font-medium">${sharePriceNum.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Max Drawdown</span>
                <span className="font-mono text-text font-medium">—</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Depositors</span>
                <span className="font-mono text-text font-medium">{depositors.length}</span>
              </div>
            </div>

            {/* Chart */}
            <div ref={chartContainerRef} className="w-full" style={{ height: 280 }}>
              {(chartMode === 'tvl' ? tvlHistory : sharePriceHistory).length === 0 && (
                <div className="flex items-center justify-center h-full text-xs text-text-secondary">Loading chart data...</div>
              )}
            </div>
          </div>

          {/* Tables: Vault Positions */}
          {(vaultPositions as any[])?.length > 0 && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-xs font-semibold text-text">Vault Positions</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-secondary border-b border-border">
                      <th className="text-left px-4 py-2 font-medium">Market</th>
                      <th className="text-left px-4 py-2 font-medium">Side</th>
                      <th className="text-right px-4 py-2 font-medium">Size</th>
                      <th className="text-right px-4 py-2 font-medium">Entry Price</th>
                      <th className="text-right px-4 py-2 font-medium">Collateral</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(vaultPositions as any[]).map((pos: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-2/50">
                        <td className="px-4 py-2.5 text-text font-medium">{marketName(pos.marketId)}</td>
                        <td className={`px-4 py-2.5 font-semibold ${pos.side === 0 ? 'text-long' : 'text-short'}`}>
                          {pos.side === 0 ? 'LONG' : 'SHORT'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-text">{Number(pos.size)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-text">${(Number(pos.entryPrice) / 1e8).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-text">${(Number(pos.collateral) / 1e6).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tables: Vault Orders */}
          {openOrders.length > 0 && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-xs font-semibold text-text">Vault Limit Orders</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-secondary border-b border-border">
                      <th className="text-left px-4 py-2 font-medium">Side</th>
                      <th className="text-right px-4 py-2 font-medium">Price</th>
                      <th className="text-right px-4 py-2 font-medium">Size</th>
                      <th className="text-right px-4 py-2 font-medium">Filled</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map((o: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-2/50">
                        <td className={`px-4 py-2.5 font-semibold ${o.side === 0 ? 'text-long' : 'text-short'}`}>
                          {o.side === 0 ? 'BUY' : 'SELL'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-text">${(Number(o.price) / 1e8).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-text">{Number(o.amount)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-text">{Number(o.filled)}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{o.status === 0 ? 'OPEN' : 'PARTIAL'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tables: Depositors */}
          {depositors.length > 0 && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-xs font-semibold text-text">Depositors ({depositors.length})</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-secondary border-b border-border">
                      <th className="text-left px-4 py-2 font-medium">Address</th>
                      <th className="text-right px-4 py-2 font-medium">TLP Balance</th>
                      <th className="text-right px-4 py-2 font-medium">Value (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depositors.map((d, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-2/50">
                        <td className="px-4 py-2.5">
                          <a href={`${EXPLORER_URL}/address/${d.address}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover font-mono">
                            {truncAddr(d.address)}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-text">{fmtTlp(d.tlpBalance)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-text">${d.valueUsd.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ════════ RIGHT COLUMN (sidebar) ════════ */}
        <div className="w-[320px] shrink-0 space-y-4">

          {/* Deposit / Withdraw tabs */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-2">
              <button
                onClick={() => setTab('deposit')}
                className={`py-3 text-sm font-semibold transition-colors cursor-pointer ${tab === 'deposit' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text'}`}
              >
                Deposit
              </button>
              <button
                onClick={() => setTab('withdraw')}
                className={`py-3 text-sm font-semibold transition-colors cursor-pointer ${tab === 'withdraw' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text'}`}
              >
                Withdraw
              </button>
            </div>

            <div className="p-4 space-y-4">
              {tab === 'deposit' ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-text-secondary">Amount (USDC)</label>
                      {isConnected && usdcBalance && (
                        <button onClick={() => setDepositInput(formatUnits(usdcBalance as bigint, 6))} className="text-[10px] text-primary hover:text-primary-hover cursor-pointer">
                          Max: ${fmtUsdc(usdcBalance as bigint)}
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={depositInput}
                      onChange={(e) => setDepositInput(e.target.value)}
                      className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text font-mono placeholder:text-text-secondary/40 focus:outline-none focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  {depositInput && Number(depositInput) > 0 && (
                    <div className="text-xs text-text-secondary">
                      You'll receive ~<span className="text-text font-mono">{(Number(depositInput) / sharePriceNum).toFixed(2)}</span> TLP
                    </div>
                  )}
                  <button
                    onClick={handleDeposit}
                    disabled={!isConnected || !depositInput || Number(depositInput) <= 0 || isPending}
                    className="w-full py-2.5 text-sm font-semibold rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isPending ? 'Processing...' : 'Deposit USDC'}
                  </button>
                </>
              ) : (
                <>
                  {hasPendingWithdraw ? (
                    <div className="space-y-3">
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                        <div className="text-xs text-text-secondary mb-1">Pending Withdrawal</div>
                        <div className="text-sm font-mono text-text">{fmtTlp(pendingReq![0])} TLP</div>
                        <div className="text-[10px] text-text-secondary mt-1">
                          Requested at {new Date(Number(pendingReq![1]) * 1000).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleExecuteWithdraw}
                          disabled={isPending}
                          className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Execute Withdraw
                        </button>
                        <button
                          onClick={handleCancelWithdraw}
                          disabled={isPending}
                          className="px-4 py-2.5 text-sm font-semibold rounded-lg border border-border text-text-secondary hover:text-text transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-text-secondary">TLP Shares</label>
                          {isConnected && mySharesBig > 0n && (
                            <button onClick={() => setWithdrawInput(formatUnits(mySharesBig, 18))} className="text-[10px] text-primary hover:text-primary-hover cursor-pointer">
                              Max: {fmtTlp(mySharesBig)}
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={withdrawInput}
                          onChange={(e) => setWithdrawInput(e.target.value)}
                          className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-text font-mono placeholder:text-text-secondary/40 focus:outline-none focus:border-primary transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                      {withdrawInput && Number(withdrawInput) > 0 && (
                        <div className="text-xs text-text-secondary">
                          You'll receive ~<span className="text-text font-mono">${(Number(withdrawInput) * sharePriceNum).toFixed(2)}</span> USDC after {delayHours}h delay
                        </div>
                      )}
                      <button
                        onClick={handleRequestWithdraw}
                        disabled={!isConnected || !withdrawInput || Number(withdrawInput) <= 0 || isPending}
                        className="w-full py-2.5 text-sm font-semibold rounded-lg bg-short hover:bg-short/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isPending ? 'Processing...' : 'Request Withdrawal'}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Your Position cards (sidebar) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Your Deposits</div>
              <div className="text-lg font-bold font-mono text-text">
                {isConnected ? `$${(Number(userTotalDeposited) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Redeemable</div>
              <div className="text-lg font-bold font-mono text-text">
                {isConnected ? `${fmtTlp(mySharesBig)} TLP` : '—'}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Withdrawal Delay</div>
              <div className="text-lg font-bold font-mono text-text">
                {hasPendingWithdraw ? `${delayHours}h` : '—'}
              </div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Your PnL</div>
              <div className={`text-lg font-bold font-mono ${userPnl >= 0 ? 'text-long' : 'text-short'}`}>
                {isConnected ? `${userPnl >= 0 ? '+' : ''}$${userPnl.toFixed(2)}` : '—'}
              </div>
            </div>
          </div>

          {/* Your Deposits history */}
          {isConnected && userDeposits.length > 0 && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="text-xs font-semibold text-text">Deposit History</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-secondary border-b border-border">
                      <th className="text-left px-3 py-2 font-medium">Date</th>
                      <th className="text-right px-3 py-2 font-medium">USDC</th>
                      <th className="text-right px-3 py-2 font-medium">TLP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDeposits.map((d, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-2/50">
                        <td className="px-3 py-2 text-text">{d.timestamp ? new Date(d.timestamp * 1000).toLocaleDateString() : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-text">${fmtUsdc(d.usdcAmount)}</td>
                        <td className="px-3 py-2 text-right">
                          <a href={`${EXPLORER_URL}/tx/${d.txHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover font-mono">
                            {fmtTlp(d.sharesReceived)}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
