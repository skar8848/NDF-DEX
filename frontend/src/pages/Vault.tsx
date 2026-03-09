import { useState, useEffect, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { parseUnits, formatUnits, parseAbiItem } from 'viem'
import { CONTRACTS } from '../lib/config'
import { paginatedGetLogs } from '../lib/utils'
import { PositionManagerABI, OrderBookABI } from '../lib/abis'
import { useAllMarkets, type MarketInfo } from '../hooks/useForwardMarket'
import { toast } from 'sonner'

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
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')

  const [userDeposits, setUserDeposits] = useState<UserDeposit[]>([])
  const [depositors, setDepositors] = useState<DepositorInfo[]>([])
  const [userTotalDeposited, setUserTotalDeposited] = useState(0n)
  const [vaultCreatedAt, setVaultCreatedAt] = useState<number | null>(null)

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

  // Fetch event data (user deposits, depositors, vault creation time)
  useEffect(() => {
    if (!publicClient) return
    let cancelled = false

    async function fetchEventData() {
      try {
        const currentBlock = await publicClient!.getBlockNumber()
        const fromBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n

        // 1. Get vault creation time from first USDC transfer to vault
        const firstDeposits = await paginatedGetLogs(publicClient!, {
          address: CONTRACTS.MockUSDC,
          event: USDCTransferEvent,
          args: { to: vaultAddr },
          fromBlock,
          toBlock: currentBlock,
        })

        if (cancelled) return

        if (firstDeposits.length > 0 && !vaultCreatedAt) {
          try {
            const block = await publicClient!.getBlock({ blockNumber: firstDeposits[0].blockNumber })
            setVaultCreatedAt(Number(block.timestamp))
          } catch { /* skip */ }
        }

        // 2. Deposited events for user deposits
        const depositLogs = await paginatedGetLogs(publicClient!, {
          address: vaultAddr,
          event: DepositedEvent,
          fromBlock,
          toBlock: currentBlock,
        })

        if (cancelled) return

        const myDeposits: UserDeposit[] = []
        let myTotalDep = 0n

        for (const log of depositLogs) {
          const usdcAmt = log.args.usdcAmount!
          const shares = log.args.sharesReceived!
          if (address && log.args.user?.toLowerCase() === address.toLowerCase()) {
            let timestamp = 0
            try {
              const block = await publicClient!.getBlock({ blockNumber: log.blockNumber })
              timestamp = Number(block.timestamp)
            } catch { /* skip */ }
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

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">Total Value Locked</div>
              <div className="text-2xl font-bold font-mono text-text">${totalValue ? fmtUsdc(totalValue as bigint) : '0.00'}</div>
              <div className="text-xs text-text-secondary mt-1">{depositors.length} depositor{depositors.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">Share Price</div>
              <div className="text-2xl font-bold font-mono text-text">${sharePriceNum.toFixed(4)}</div>
              <div className="text-xs text-text-secondary mt-1">per TLP token</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">Fees Earned (LP)</div>
              <div className={`text-2xl font-bold font-mono ${(() => {
                const profit = Number(tvlBig) / 1e6 - Number(totalDep) / 1e6 + Number(totalWith) / 1e6
                return profit >= 0 ? 'text-long' : 'text-short'
              })()}`}>
                {(() => {
                  const profit = Number(tvlBig) / 1e6 - Number(totalDep) / 1e6 + Number(totalWith) / 1e6
                  return `${profit >= 0 ? '+' : ''}$${profit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                })()}
              </div>
              <div className="text-xs text-text-secondary mt-1">60% of trading fees</div>
            </div>
            <div className="bg-surface border border-border rounded-xl p-5">
              <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-2">APY</div>
              <div className="text-2xl font-bold font-mono text-primary">{apr !== null ? `${apr.toFixed(1)}%` : '0.0%'}</div>
              <div className="text-xs text-text-secondary mt-1">annualized from fees</div>
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

          {/* Deposit */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="text-sm font-semibold text-text">Deposit</div>
            </div>
            <div className="p-4 space-y-4">
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
            </div>
          </div>

          {/* Black separator */}
          <div className="h-px bg-text" />

          {/* Withdraw */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <div className="text-sm font-semibold text-text">Withdraw</div>
            </div>
            <div className="p-4 space-y-4">
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
