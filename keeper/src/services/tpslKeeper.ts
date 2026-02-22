import { positionManager, walletClient, publicClient } from '../contracts.js'
import { config } from '../config.js'
import { log } from '../utils/logger.js'
import { retry } from '../utils/retry.js'
import type { PositionData, TPSLData } from './positionMonitor.js'
import type { PriceMap } from './priceService.js'

type MarketData = { baseAsset: string }

export async function checkAndTriggerTPSL(
  positions: PositionData[],
  tpslMap: Map<bigint, TPSLData>,
  prices: PriceMap,
  marketMap: Map<bigint, MarketData>,
): Promise<number> {
  let triggered = 0

  for (const pos of positions) {
    const tpsl = tpslMap.get(pos.id)
    if (!tpsl) continue

    const hasTP = tpsl.takeProfitPrice > 0n
    const hasSL = tpsl.stopLossPrice > 0n
    if (!hasTP && !hasSL) continue

    const market = marketMap.get(pos.marketId)
    if (!market) continue

    const price = prices.get(market.baseAsset)
    if (!price) continue

    const isLong = pos.side === 0

    const tpTriggered = hasTP && (isLong ? price >= tpsl.takeProfitPrice : price <= tpsl.takeProfitPrice)
    const slTriggered = hasSL && (isLong ? price <= tpsl.stopLossPrice : price >= tpsl.stopLossPrice)

    if (!tpTriggered && !slTriggered) continue

    const reason = tpTriggered ? 'TP' : 'SL'
    log.info('TPSL', `${reason} triggered for position #${pos.id} (${isLong ? 'LONG' : 'SHORT'} ${market.baseAsset}) @ $${Number(price) / 1e8}`)

    const result = await retry(async () => {
      const hash = await walletClient.writeContract({
        address: config.addresses.positionManager,
        abi: positionManager.abi,
        functionName: 'closePosition',
        args: [pos.id],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      return receipt
    }, 'TPSL')

    if (result) {
      log.success('TPSL', `Position #${pos.id} closed (${reason}) — tx: ${result.transactionHash}`)
      triggered++
    }
  }

  return triggered
}
