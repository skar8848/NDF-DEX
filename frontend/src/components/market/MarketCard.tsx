import { Link } from 'react-router-dom'
import { formatPrice, formatCountdown, formatExpiryDate } from '../../lib/utils'
import { useOraclePrice } from '../../hooks/usePriceData'
import { AssetLogo } from '../trading/MarketSelector'

type MarketCardProps = {
  id: bigint
  baseAsset: string
  quoteAsset: string
  expiration: bigint
  totalLongOI: bigint
  totalShortOI: bigint
  settled: boolean
  settlementType?: number
}

export function MarketCard({
  id,
  baseAsset,
  quoteAsset,
  expiration,
  totalLongOI,
  totalShortOI,
  settled,
  settlementType,
}: MarketCardProps) {
  const { data: priceData } = useOraclePrice(baseAsset)
  const price = priceData ? (priceData as [bigint, bigint])[0] : 0n

  return (
    <Link
      to={`/trade/${id}`}
      className="block bg-surface border border-border rounded-xl p-5 hover:border-primary/50 transition-all no-underline group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <AssetLogo asset={baseAsset} size={40} />
            <div className="absolute -bottom-1.5 -right-1.5">
              <AssetLogo asset={quoteAsset} size={22} />
            </div>
          </div>
          <div>
            <h3 className="text-text font-semibold text-base group-hover:text-primary transition-colors">
              {baseAsset}/{quoteAsset} <span className="font-normal text-text-secondary">{formatExpiryDate(expiration)}</span>
            </h3>
            <p className="text-text-secondary text-xs">
              {settlementType === 1 ? 'Physical Delivery' : 'NDF'} Forward
            </p>
          </div>
        </div>
        {settled ? (
          <span className="px-2 py-1 rounded-md bg-warning/10 text-warning text-xs font-medium">
            Settled
          </span>
        ) : (
          <span className="px-2 py-1 rounded-md bg-success/10 text-success text-xs font-medium">
            Active
          </span>
        )}
      </div>

      <div className="mb-4">
        <p className="text-2xl font-bold text-text">
          ${price ? formatPrice(price) : '—'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-surface-2 rounded-lg p-2.5">
          <p className="text-text-secondary mb-0.5">Expiry</p>
          <p className="text-text font-medium">
            {settled || Number(expiration) <= Math.floor(Date.now() / 1000)
              ? formatExpiryDate(expiration)
              : formatCountdown(expiration)}
          </p>
        </div>
        <div className="bg-surface-2 rounded-lg p-2.5">
          <p className="text-text-secondary mb-0.5">Open Interest</p>
          <p className="text-text font-medium">
            {Number(totalLongOI + totalShortOI)} contracts
          </p>
        </div>
      </div>
    </Link>
  )
}
