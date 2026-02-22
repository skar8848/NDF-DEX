import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { CONTRACTS } from '../lib/config'
import { toast } from 'sonner'

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
] as const

const MockUSDCABI = [
  { type: 'function', name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }], stateMutability: 'nonpayable' },
  { type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

const vaultAddr = CONTRACTS.TenorVault as `0x${string}`

function fmtUsdc(v: bigint) {
  return Number(formatUnits(v, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtTlp(v: bigint) {
  return Number(formatUnits(v, 18)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

export function Vault() {
  const { address, isConnected } = useAccount()
  const [depositInput, setDepositInput] = useState('')
  const [withdrawInput, setWithdrawInput] = useState('')
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit')

  // Read vault state
  const { data: sharePrice } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'sharePrice', query: { refetchInterval: 5000 } })
  const { data: totalValue } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'totalValue', query: { refetchInterval: 5000 } })
  const { data: totalSupply } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'totalSupply', query: { refetchInterval: 5000 } })
  const { data: myShares } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 5000 } })
  const { data: withdrawalDelay } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'withdrawalDelay' })
  const { data: withdrawRequest } = useReadContract({ address: vaultAddr, abi: TenorVaultABI, functionName: 'withdrawRequests', args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 5000 } })
  const { data: usdcBalance } = useReadContract({ address: CONTRACTS.MockUSDC, abi: MockUSDCABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 5000 } })

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

  async function handleDeposit() {
    if (!depositInput || !address) return
    const amount = parseUnits(depositInput, 6)
    try {
      toast.info('Approving USDC...')
      writeApprove({ address: CONTRACTS.MockUSDC, abi: MockUSDCABI, functionName: 'approve', args: [vaultAddr, amount] })
      // Small delay then deposit
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

  const delayHours = withdrawalDelay ? Number(withdrawalDelay as bigint) / 3600 : 24

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-text">TLP Vault</h1>
        <p className="text-sm text-text-secondary">Deposit USDC, earn yield from trading fees. TLP share price increases as revenue flows in.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Share Price</div>
          <div className="text-lg font-bold font-mono text-text">${sharePriceNum.toFixed(4)}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">TVL</div>
          <div className="text-lg font-bold font-mono text-text">${totalValue ? fmtUsdc(totalValue as bigint) : '0.00'}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Total TLP</div>
          <div className="text-lg font-bold font-mono text-text">{totalSupply ? fmtTlp(totalSupply as bigint) : '0'}</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1">Withdraw Delay</div>
          <div className="text-lg font-bold font-mono text-text">{delayHours}h</div>
        </div>
      </div>

      {/* User position */}
      {isConnected && (
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-text-secondary mb-2">Your Position</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-secondary">TLP Balance</div>
              <div className="text-xl font-bold font-mono text-text">{fmtTlp(mySharesBig)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-text-secondary">Value</div>
              <div className="text-xl font-bold font-mono text-primary">${myValueUsd.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Deposit / Withdraw tabs */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 border-b border-border">
          <button
            onClick={() => setTab('deposit')}
            className={`py-3 text-sm font-semibold transition-colors cursor-pointer ${tab === 'deposit' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text-secondary hover:text-text'}`}
          >
            Deposit
          </button>
          <button
            onClick={() => setTab('withdraw')}
            className={`py-3 text-sm font-semibold transition-colors cursor-pointer ${tab === 'withdraw' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-text-secondary hover:text-text'}`}
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

      {/* Info */}
      <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
        <div className="text-xs font-semibold text-text">How it works</div>
        <ul className="text-xs text-text-secondary space-y-1.5">
          <li className="flex gap-2"><span className="text-primary">1.</span> Deposit USDC to receive TLP shares</li>
          <li className="flex gap-2"><span className="text-primary">2.</span> 60% of all trading fees flow to the vault</li>
          <li className="flex gap-2"><span className="text-primary">3.</span> Share price increases as revenue accumulates</li>
          <li className="flex gap-2"><span className="text-primary">4.</span> Withdraw anytime (after {delayHours}h delay for safety)</li>
        </ul>
      </div>
    </div>
  )
}
