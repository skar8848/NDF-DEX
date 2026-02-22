import { useState } from 'react'
import { useCreateMarket } from '../../hooks/useForwardMarket'
import { parseUSDC } from '../../lib/utils'

type ExpiryUnit = 'hours' | 'days'

export function CreateMarket({ onClose }: { onClose: () => void }) {
  const [baseAsset, setBaseAsset] = useState('ETH')
  const [quoteAsset] = useState('USDC')
  const [expiryValue, setExpiryValue] = useState('30')
  const [expiryUnit, setExpiryUnit] = useState<ExpiryUnit>('days')
  const [ltvPercent, setLtvPercent] = useState('80')
  const [liqPercent, setLiqPercent] = useState('85')
  const [minCollateral, setMinCollateral] = useState('10')

  const { createMarket, isPending, isConfirming, isSuccess } = useCreateMarket()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const seconds = expiryUnit === 'hours'
      ? parseInt(expiryValue) * 3600
      : parseInt(expiryValue) * 86400
    const expiration = BigInt(Math.floor(Date.now() / 1000) + seconds)
    const ltvBps = BigInt(Math.round(parseFloat(ltvPercent) * 100))
    const liqBps = BigInt(Math.round(parseFloat(liqPercent) * 100))
    createMarket(
      baseAsset,
      quoteAsset,
      expiration,
      ltvBps,
      liqBps,
      parseUSDC(minCollateral)
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">LTV (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={ltvPercent}
                  onChange={(e) => setLtvPercent(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 pr-8 text-text text-sm focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min="1"
                  max="100"
                  step="1"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Liq Threshold (%)</label>
              <div className="relative">
                <input
                  type="number"
                  value={liqPercent}
                  onChange={(e) => setLiqPercent(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 pr-8 text-text text-sm focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min="1"
                  max="100"
                  step="1"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">%</span>
              </div>
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
              {isPending ? 'Confirming...' : isConfirming ? 'Creating...' : isSuccess ? 'Created!' : 'Create Market'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
