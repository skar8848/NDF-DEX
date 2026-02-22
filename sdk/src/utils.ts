import { formatUnits, parseUnits } from 'viem'
import { PRICE_DECIMALS, USDC_DECIMALS } from './constants.js'

/**
 * Format a raw price (8 decimals) to a human-readable string.
 *
 * @example
 * formatPrice(250000000000n) // "2,500.00"
 */
export function formatPrice(price: bigint): string {
  return Number(formatUnits(price, PRICE_DECIMALS)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Parse a human-readable price string into the 8-decimal raw format.
 *
 * @example
 * parsePrice("2500")   // 250000000000n
 * parsePrice("2500.5") // 250050000000n
 */
export function parsePrice(price: string): bigint {
  return parseUnits(price, PRICE_DECIMALS)
}

/**
 * Format a raw USDC amount (6 decimals) to a human-readable string.
 *
 * @example
 * formatUSDC(10000000000n) // "10,000.00"
 */
export function formatUSDC(amount: bigint): string {
  return Number(formatUnits(amount, USDC_DECIMALS)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Parse a human-readable USDC amount into the 6-decimal raw format.
 *
 * @example
 * parseUSDC("100")   // 100000000n
 * parseUSDC("99.50") // 99500000n
 */
export function parseUSDC(amount: string): bigint {
  return parseUnits(amount, USDC_DECIMALS)
}

/**
 * Format a unix timestamp (bigint seconds) to a locale date string.
 * Returns "N/A" for zero timestamps.
 */
export function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return 'N/A'
  return new Date(Number(ts) * 1000).toLocaleString()
}

/**
 * Shorten an Ethereum address for display.
 *
 * @example
 * shortenAddress("0xAB6b565384773C70da8D9e254aFB4B59d710eaD7")
 * // "0xAB6b...eaD7"
 */
export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
