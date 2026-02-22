import { oracleContract } from '../contracts.js'
import { log } from '../utils/logger.js'

export type PriceMap = Map<string, bigint>

export async function fetchOraclePrices(assets: string[]): Promise<PriceMap> {
  const prices: PriceMap = new Map()

  for (const asset of assets) {
    try {
      const [price] = await oracleContract.read.getPrice([asset])
      prices.set(asset, price)
    } catch (err) {
      log.error('PRICE', `Failed to fetch price for ${asset}`, err)
    }
  }

  return prices
}
