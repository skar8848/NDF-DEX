import { useState } from 'react'
import { useCreateMarket } from '../../hooks/useForwardMarket'
import { parseUSDC } from '../../lib/utils'

type ExpiryUnit = 'hours' | 'days'
type ValueMode = 'percent' | 'bps'

function UnitToggle({ value, onChange }: { value: ValueMode; onChange: (v: ValueMode) => void }) {
  return (
    <div className="flex bg-surface-2 border border-border rounded-lg overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => onChange('percent')}
        className={`px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
          value === 'percent' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text'
        }`}
      >
        %
      </button>
      <button
        type="button"
        onClick={() => onChange('bps')}
        className={`px-2.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
          value === 'bps' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text'
        }`}
      >
        bps
      </button>
    </div>
  )
}

function toBps(value: string, mode: ValueMode): bigint {
  const num = parseFloat(value)
  if (isNaN(num) || num <= 0) return 0n
  if (mode === 'percent') return BigInt(Math.round(num * 100))
  return BigInt(Math.round(num))
}

export function CreateMarket({ onClose }: { onClose: () => void }) {
  const [baseAsset, setBaseAsset] = useState('ETH')
  const [quoteAsset] = useState('USDC')
  const [expiryValue, setExpiryValue] = useState('30')
  const [expiryUnit, setExpiryUnit] = useState<ExpiryUnit>('days')
  const [ltvValue, setLtvValue] = useState('80')
  const [ltvMode, setLtvMode] = useState<ValueMode>('percent')
  const [liqValue, setLiqValue] = useState('85')
  const [liqMode, setLiqMode] = useState<ValueMode>('percent')
  const [minCollateral, setMinCollateral] = useState('10')

  const { createMarket, isPending, isConfirming, isSuccess, hash } = useCreateMarket()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const seconds = expiryUnit === 'hours'
      ? parseInt(expiryValue) * 3600
      : parseInt(expiryValue) * 86400
    const expiration = BigInt(Math.floor(Date.now() / 1000) + seconds)
    createMarket(
      baseAsset,
      quoteAsset,
      expiration,
      toBps(ltvValue, ltvMode),
      toBps(liqValue, liqMode),
      parseUSDC(minCollateral)
    )
  }

  if (isSuccess && hash) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
        <div
          className="bg-surface border border-border rounded-xl p-6 w-full max-w-md text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <h2 className="text-lg font-semibold text-text mb-1">Market Created</h2>
          <p className="text-text-secondary text-sm mb-4">
            {baseAsset}/{quoteAsset} forward market is now live.
          </p>

          <div className="bg-surface-2 rounded-lg p-3 mb-4">
            <p className="text-[10px] text-text-secondary mb-1">Transaction Hash</p>
            <p className="text-xs font-mono text-text break-all">{hash}</p>
          </div>

          <div className="flex gap-3">
            <a
              href={`https://testnet.snowtrace.io/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-text hover:bg-surface-2 transition-colors no-underline"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Snowtrace
            </a>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text mb-4">Create Forward Market</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Base Asset</label>
            <select
              value={baseAsset}
              onChange={(e) => setBaseAsset(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
            >
              <option value="ETH">ETH</option>
              <option value="BTC">BTC</option>
              <option value="AVAX">AVAX</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Expiry</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={expiryValue}
                onChange={(e) => setExpiryValue(e.target.value)}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                min="1"
              />
              <div className="flex bg-surface-2 border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpiryUnit('hours')}
                  className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    expiryUnit === 'hours' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text'
                  }`}
                >
                  Hours
                </button>
                <button
                  type="button"
                  onClick={() => setExpiryUnit('days')}
                  className={`px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                    expiryUnit === 'days' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text'
                  }`}
                >
                  Days
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">
              LTV {ltvMode === 'percent' ? `(${ltvValue}% = ${Math.round(parseFloat(ltvValue || '0') * 100)} bps)` : `(${ltvValue} bps = ${(parseFloat(ltvValue || '0') / 100).toFixed(1)}%)`}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  value={ltvValue}
                  onChange={(e) => setLtvValue(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 pr-10 text-text text-sm focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min="1"
                  step={ltvMode === 'percent' ? '1' : '100'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
                  {ltvMode === 'percent' ? '%' : 'bps'}
                </span>
              </div>
              <UnitToggle value={ltvMode} onChange={(m) => {
                if (m !== ltvMode) {
                  const num = parseFloat(ltvValue || '0')
                  setLtvValue(m === 'percent' ? (num / 100).toString() : (num * 100).toString())
                }
                setLtvMode(m)
              }} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">
              Liquidation Threshold {liqMode === 'percent' ? `(${liqValue}% = ${Math.round(parseFloat(liqValue || '0') * 100)} bps)` : `(${liqValue} bps = ${(parseFloat(liqValue || '0') / 100).toFixed(1)}%)`}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  value={liqValue}
                  onChange={(e) => setLiqValue(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 pr-10 text-text text-sm focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min="1"
                  step={liqMode === 'percent' ? '1' : '100'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
                  {liqMode === 'percent' ? '%' : 'bps'}
                </span>
              </div>
              <UnitToggle value={liqMode} onChange={(m) => {
                if (m !== liqMode) {
                  const num = parseFloat(liqValue || '0')
                  setLiqValue(m === 'percent' ? (num / 100).toString() : (num * 100).toString())
                }
                setLiqMode(m)
              }} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Min Collateral (USDC)</label>
            <input
              type="number"
              value={minCollateral}
              onChange={(e) => setMinCollateral(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-text-secondary text-sm hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || isConfirming}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirm in wallet...
                </span>
              ) : isConfirming ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </span>
              ) : 'Create Market'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
