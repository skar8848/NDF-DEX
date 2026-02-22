import { PRICE_PRECISION, COLLATERAL_PRECISION } from './config'

export function formatPrice(price: bigint): string {
  const num = Number(price) / PRICE_PRECISION
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formatUSDC(amount: bigint): string {
  const num = Number(amount) / COLLATERAL_PRECISION
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function parseUSDC(amount: string): bigint {
  return BigInt(Math.round(parseFloat(amount) * COLLATERAL_PRECISION))
}

export function parsePrice(price: string): bigint {
  return BigInt(Math.round(parseFloat(price) * PRICE_PRECISION))
}

export function formatCountdown(expiration: bigint): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = Number(expiration) - now
  if (diff <= 0) return 'Expired'

  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const minutes = Math.floor((diff % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatPnL(pnl: bigint): string {
  const num = Number(pnl) / COLLATERAL_PRECISION
  const sign = num >= 0 ? '+' : ''
  return `${sign}$${num.toFixed(2)}`
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatExpiryDate(expiration: bigint): string {
  const date = new Date(Number(expiration) * 1000)
  const day = date.getDate()
  const month = SHORT_MONTHS[date.getMonth()]
  return `${day} ${month}`
}

export function formatMarketName(baseAsset: string, quoteAsset: string, expiration: bigint): string {
  return `${baseAsset}/${quoteAsset} - ${formatExpiryDate(expiration)}`
}
