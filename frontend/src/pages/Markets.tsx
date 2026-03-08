import { useState, useMemo } from 'react'
import { useAllMarkets } from '../hooks/useForwardMarket'
import { MarketCard } from '../components/market/MarketCard'
import { CreateMarket } from '../components/market/CreateMarket'
import { AssetLogo } from '../components/trading/MarketSelector'

type TypeFilter = 'all' | 'ndf' | 'forward' | 'settled'

export function Markets() {
  const { data: markets, isLoading } = useAllMarkets()
  const [showCreate, setShowCreate] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [assetFilter, setAssetFilter] = useState<string>('all')

  const allAssets = useMemo(() => {
    if (!markets) return []
    const set = new Set<string>()
    ;(markets as any[]).forEach((m: any) => set.add(m.baseAsset))
    return Array.from(set)
  }, [markets])

  // Counts per type
  const counts = useMemo(() => {
    if (!markets) return { all: 0, ndf: 0, forward: 0, settled: 0 }
    const arr = markets as any[]
    return {
      all: arr.filter((m: any) => !m.settled).length,
      ndf: arr.filter((m: any) => !m.settled && m.settlementType !== 1).length,
      forward: arr.filter((m: any) => !m.settled && m.settlementType === 1).length,
      settled: arr.filter((m: any) => m.settled).length,
    }
  }, [markets])

  const filteredMarkets = useMemo(() => {
    if (!markets) return []
    return (markets as any[]).filter((m: any) => {
      // Type filter
      if (typeFilter === 'all' && m.settled) return false
      if (typeFilter === 'ndf' && (m.settled || m.settlementType === 1)) return false
      if (typeFilter === 'forward' && (m.settled || m.settlementType !== 1)) return false
      if (typeFilter === 'settled' && !m.settled) return false
      // Asset filter
      if (assetFilter !== 'all' && m.baseAsset !== assetFilter) return false
      return true
    })
  }, [markets, typeFilter, assetFilter])

  const typeFilters: { id: TypeFilter; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'ndf', label: `NDF (${counts.ndf})` },
    { id: 'forward', label: `Forward (${counts.forward})` },
    { id: 'settled', label: `Settled (${counts.settled})` },
  ]

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text mb-1">Forward Markets</h1>
          <p className="text-text-secondary text-sm">
            Trade forward contracts on crypto assets
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
        {/* Type filter */}
        <div className="flex gap-1">
          {typeFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                typeFilter === f.id
                  ? 'bg-surface-2 text-text'
                  : 'text-text-secondary hover:text-text hover:bg-surface-2'
              }`}
            >
              {f.label}
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
              settlementType={market.settlementType}
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
