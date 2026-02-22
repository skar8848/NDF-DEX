import { positionManager, walletClient, publicClient } from '../contracts.js'
import { config } from '../config.js'
import { log } from '../utils/logger.js'
import { retry } from '../utils/retry.js'
import type { PositionData } from './positionMonitor.js'

const HEALTH_THRESHOLD = 10000n // 100% = PERCENT_BASE

export async function checkAndLiquidate(
  positions: PositionData[],
  healthMap: Map<bigint, bigint>,
): Promise<number> {
  let liquidated = 0

  for (const pos of positions) {
    const health = healthMap.get(pos.id)
    if (health === undefined) continue
    if (health >= HEALTH_THRESHOLD) continue

    log.info('LIQ', `Position #${pos.id} unhealthy (health=${health}) — liquidating...`)

    const result = await retry(async () => {
      const hash = await walletClient.writeContract({
        address: config.addresses.positionManager,
        abi: positionManager.abi,
        functionName: 'liquidate',
        args: [pos.id],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      return receipt
    }, 'LIQ')

    if (result) {
      log.success('LIQ', `Position #${pos.id} liquidated — tx: ${result.transactionHash}`)
      liquidated++
    }
  }

  return liquidated
}
