import { useState } from 'react'
import { useCreateMarket } from '../../hooks/useForwardMarket'
import { parseUSDC } from '../../lib/utils'

export function CreateMarket({ onClose }: { onClose: () => void }) {
  const [baseAsset, setBaseAsset] = useState('ETH')
  const [quoteAsset] = useState('USDC')
  const [daysToExpiry, setDaysToExpiry] = useState('30')
  const [ltv, setLtv] = useState('8000')
  const [liqThreshold, setLiqThreshold] = useState('8500')
  const [minCollateral, setMinCollateral] = useState('10')

  const { createMarket, isPending, isConfirming, isSuccess } = useCreateMarket()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const expiration = BigInt(Math.floor(Date.now() / 1000) + parseInt(daysToExpiry) * 86400)
    createMarket(
      baseAsset,
      quoteAsset,
      expiration,
      BigInt(ltv),
      BigInt(liqThreshold),
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
            <label className="block text-xs text-text-secondary mb-1">Days to Expiry</label>
            <input
              type="number"
              value={daysToExpiry}
              onChange={(e) => setDaysToExpiry(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
              min="1"
              max="365"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">LTV (bps)</label>
              <input
                type="number"
                value={ltv}
                onChange={(e) => setLtv(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1">Liq Threshold (bps)</label>
              <input
                type="number"
                value={liqThreshold}
                onChange={(e) => setLiqThreshold(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Min Collateral (USDC)</label>
            <input
              type="number"
              value={minCollateral}
              onChange={(e) => setMinCollateral(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-border text-text-secondary text-sm hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || isConfirming}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {isPending ? 'Confirming...' : isConfirming ? 'Creating...' : isSuccess ? 'Created!' : 'Create Market'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
