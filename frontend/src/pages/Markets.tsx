import { useState } from 'react'
import { useAllMarkets } from '../hooks/useForwardMarket'
import { MarketCard } from '../components/market/MarketCard'
import { CreateMarket } from '../components/market/CreateMarket'

export function Markets() {
  const { data: markets, isLoading } = useAllMarkets()
  const [showCreate, setShowCreate] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'settled'>('all')

  const filteredMarkets = markets?.filter((m: any) => {
    if (filter === 'active') return !m.settled
    if (filter === 'settled') return m.settled
    return true
  })

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
          className="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors"
        >
          + Create Market
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['all', 'active', 'settled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-surface-2 text-text'
                : 'text-text-secondary hover:text-text hover:bg-surface-2'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface border border-border rounded-xl p-5 animate-pulse h-48" />
          ))}
        </div>
      ) : filteredMarkets && filteredMarkets.length > 0 ? (
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
