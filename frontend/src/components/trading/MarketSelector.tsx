import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { cn, formatPrice, formatExpiryDate } from '../../lib/utils'
import { useOraclePrice } from '../../hooks/usePriceData'
import type { MarketInfo } from '../../hooks/useForwardMarket'

const ASSET_LOGOS: Record<string, string> = {
  ETH: '/logos/ETH_Logo.png',
  BTC: '/logos/BTC_Logo.png',
  AVAX: '/logos/AVAX_Logo.png',
  USDC: '/logos/USDC_Logo.png',
}

function AssetLogo({ asset, size = 28 }: { asset: string; size?: number }) {
  const src = ASSET_LOGOS[asset]
  if (!src) {
    return (
      <div
        className="rounded-full bg-surface-2 flex items-center justify-center text-xs font-bold text-primary shrink-0"
        style={{ width: size, height: size }}
      >
        {asset.slice(0, 2)}
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={asset}
      className="rounded-full shrink-0 object-cover"
      style={{ width: size, height: size }}
    />
  )
}

type MarketSelectorProps = {
  markets: MarketInfo[]
  selectedMarketId: bigint
  onSelect: (marketId: bigint) => void
}

function MarketPriceLabel({ baseAsset }: { baseAsset: string }) {
  const { data: priceData } = useOraclePrice(baseAsset)
  const price = priceData ? (priceData as [bigint, bigint])[0] : null

  if (!price) return <span className="text-text-secondary text-xs">--</span>
  return <span className="text-text-secondary text-xs">${formatPrice(price)}</span>
}

export { AssetLogo, ASSET_LOGOS }

export function MarketSelector({ markets, selectedMarketId, onSelect }: MarketSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedMarket = markets.find((m) => m.id === selectedMarketId)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-surface-2 rounded-md transition-colors cursor-pointer"
      >
        {selectedMarket ? (
          <>
            <AssetLogo asset={selectedMarket.baseAsset} size={28} />
            <span className="font-semibold text-sm text-text">
              {selectedMarket.baseAsset}/{selectedMarket.quoteAsset}
              <span className="font-normal text-text-secondary ml-1.5">{formatExpiryDate(selectedMarket.expiration)}</span>
            </span>
          </>
        ) : (
          <span className="text-text-secondary text-sm">Select Market</span>
        )}
        <svg
          className={cn(
            'w-4 h-4 text-text-secondary transition-transform ml-2',
            isOpen && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-border">
            <p className="text-text-secondary text-xs font-medium px-2 py-1">Markets</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {markets.length === 0 ? (
              <div className="px-4 py-3 text-text-secondary text-sm">No markets available</div>
            ) : (
              markets.map((market) => (
                <Link
                  key={market.id.toString()}
                  to={`/trade/${market.id}`}
                  onClick={() => {
                    onSelect(market.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2 transition-colors no-underline cursor-pointer',
                    market.id === selectedMarketId && 'bg-surface-2'
                  )}
                >
                  <AssetLogo asset={market.baseAsset} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text">
                        {market.baseAsset}/{market.quoteAsset}
                        <span className="font-normal text-text-secondary ml-1">{formatExpiryDate(market.expiration)}</span>
                      </span>
                      {market.settled ? (
                        <span className="text-warning text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/10">
                          Settled
                        </span>
                      ) : (
                        <span className="text-success text-[10px] font-medium px-1.5 py-0.5 rounded bg-success/10">
                          Active
                        </span>
                      )}
                    </div>
                    <MarketPriceLabel baseAsset={market.baseAsset} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
