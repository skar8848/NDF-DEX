import { useState, useMemo } from 'react'
import { useAllMarkets } from '../hooks/useForwardMarket'
import { MarketCard } from '../components/market/MarketCard'
import { CreateMarket } from '../components/market/CreateMarket'
import { AssetLogo } from '../components/trading/MarketSelector'

export function Markets() {
  const { data: markets, isLoading } = useAllMarkets()
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'settled'>('all')
  const [assetFilter, setAssetFilter] = useState<string>('all')

  const allAssets = useMemo(() => {
    if (!markets) return []
    const set = new Set<string>()
    ;(markets as any[]).forEach((m: any) => set.add(m.baseAsset))
    return Array.from(set)
  }, [markets])

  const filteredMarkets = useMemo(() => {
    if (!markets) return []
    return (markets as any[]).filter((m: any) => {
      if (statusFilter === 'active' && m.settled) return false
      if (statusFilter === 'settled' && !m.settled) return false
      if (assetFilter !== 'all' && m.baseAsset !== assetFilter) return false
      return true
    })
  }, [markets, statusFilter, assetFilter])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Forward Markets</h1>
          <p className="text-text-secondary text-sm">
            Trade non-deliverable forwards on crypto assets
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors cursor-pointer"
        >
          + Create Market
        </button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        {/* Status filter */}
        <div className="flex gap-1">
          {(['all', 'active', 'settled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                statusFilter === f
                  ? 'bg-surface-2 text-text'
                  : 'text-text-secondary hover:text-text hover:bg-surface-2'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {allAssets.length > 0 && (
          <>
            <div className="w-px h-6 bg-border" />

            {/* Asset filter */}
            <div className="flex gap-1">
              <button
                onClick={() => setAssetFilter('all')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  assetFilter === 'all'
                    ? 'bg-surface-2 text-text'
                    : 'text-text-secondary hover:text-text hover:bg-surface-2'
                }`}
              >
                All Assets
              </button>
              {allAssets.map((asset) => (
                <button
                  key={asset}
                  onClick={() => setAssetFilter(asset)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    assetFilter === asset
                      ? 'bg-surface-2 text-text'
                      : 'text-text-secondary hover:text-text hover:bg-surface-2'
                  }`}
                >
                  <AssetLogo asset={asset} size={16} />
                  {asset}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 animate-pulse h-48" />
          ))}
        </div>
      ) : filteredMarkets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMarkets.map((market: any) => (
            <MarketCard
              key={Number(market.id)}
              id={market.id}
              baseAsset={market.baseAsset}
              quoteAsset={market.quoteAsset}
              expiration={market.expiration}
              totalLongOI={market.totalLongOI}
              totalShortOI={market.totalShortOI}
              settled={market.settled}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-text-secondary">
          <p className="text-lg mb-2">No markets found</p>
          <p className="text-sm">Create the first forward market to start trading</p>
        </div>
      )}

      {showCreate && <CreateMarket onClose={() => setShowCreate(false)} />}
    </div>
  )
}
