import { forwardMarket, positionManager, walletClient, publicClient } from '../contracts.js'
import { config } from '../config.js'
import { log } from '../utils/logger.js'
import { retry } from '../utils/retry.js'
import type { PositionData } from './positionMonitor.js'

type MarketInfo = {
  id: bigint
  baseAsset: string
  quoteAsset: string
  expiration: bigint
  settled: boolean
}

export async function checkAndSettle(
  positions: PositionData[],
  markets: MarketInfo[],
): Promise<number> {
  let settled = 0
  const now = BigInt(Math.floor(Date.now() / 1000))

  // 1. Settle expired but unsettled markets
  for (const market of markets) {
    if (market.settled) continue
    if (market.expiration > now) continue

    log.info('SETTLE', `Market #${market.id} (${market.baseAsset}/${market.quoteAsset}) expired — settling...`)

    const result = await retry(async () => {
      const hash = await walletClient.writeContract({
        address: config.addresses.forwardMarket,
        abi: forwardMarket.abi,
        functionName: 'settleMarket',
        args: [market.id],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      return receipt
    }, 'SETTLE')

    if (result) {
      log.success('SETTLE', `Market #${market.id} settled — tx: ${result.transactionHash}`)
      market.settled = true // mark locally to settle positions below
    }
  }

  // 2. Settle positions on settled markets
  const settledMarketIds = new Set(markets.filter((m) => m.settled).map((m) => m.id))

  for (const pos of positions) {
    if (!settledMarketIds.has(pos.marketId)) continue

    log.info('SETTLE', `Settling position #${pos.id} on settled market #${pos.marketId}`)

    const result = await retry(async () => {
      const hash = await walletClient.writeContract({
        address: config.addresses.positionManager,
        abi: positionManager.abi,
        functionName: 'settlePosition',
        args: [pos.id],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      return receipt
    }, 'SETTLE')

    if (result) {
      log.success('SETTLE', `Position #${pos.id} settled — tx: ${result.transactionHash}`)
      settled++
    }
  }

  return settled
}
