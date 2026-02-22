import { config } from './config.js'
import { forwardMarket, account } from './contracts.js'
import { log } from './utils/logger.js'
import { fetchAllOpenPositions, batchFetchTPSL, batchFetchHealthFactors } from './services/positionMonitor.js'
import { fetchOraclePrices } from './services/priceService.js'
import { checkAndTriggerTPSL } from './services/tpslKeeper.js'
import { checkAndLiquidate } from './services/liquidationKeeper.js'
import { checkAndSettle } from './services/settlementKeeper.js'

async function runCycle() {
  // 1. Fetch all markets
  const markets = await forwardMarket.read.getAllMarkets()
  const uniqueAssets = [...new Set(markets.map((m) => m.baseAsset))]

  // Build market lookup
  const marketMap = new Map(markets.map((m) => [m.id, { baseAsset: m.baseAsset }]))

  // 2. Fetch oracle prices
  const prices = await fetchOraclePrices(uniqueAssets)

  // 3. Fetch all open positions
  const positions = await fetchAllOpenPositions()
  if (positions.length === 0) {
    log.info('LOOP', 'No open positions')
    return
  }

  const positionIds = positions.map((p) => p.id)

  // 4. Batch fetch TP/SL and health factors
  const [tpslMap, healthMap] = await Promise.all([
    batchFetchTPSL(positionIds),
    batchFetchHealthFactors(positionIds),
  ])

  // 5. Settlement: expired markets + their positions
  const settledCount = await checkAndSettle(positions, [...markets] as any)
  if (settledCount > 0) log.info('LOOP', `Settled ${settledCount} positions`)

  // 6. TP/SL triggers
  const tpslCount = await checkAndTriggerTPSL(positions, tpslMap, prices, marketMap)
  if (tpslCount > 0) log.info('LOOP', `Closed ${tpslCount} positions via TP/SL`)

  // 7. Liquidations
  const liqCount = await checkAndLiquidate(positions, healthMap)
  if (liqCount > 0) log.info('LOOP', `Liquidated ${liqCount} positions`)
}

export async function main() {
  log.info('KEEPER', '═══════════════════════════════════════')
  log.info('KEEPER', '  Tenor DEX Keeper Bot Starting...')
  log.info('KEEPER', '═══════════════════════════════════════')
  log.info('KEEPER', `Keeper address: ${account.address}`)
  log.info('KEEPER', `PositionManager: ${config.addresses.positionManager}`)
  log.info('KEEPER', `ForwardMarket: ${config.addresses.forwardMarket}`)
  log.info('KEEPER', `Oracle: ${config.addresses.mockOracle}`)
  log.info('KEEPER', `Poll interval: ${config.pollIntervalMs}ms`)

  // Main loop
  while (true) {
    try {
      await runCycle()
    } catch (err) {
      log.error('LOOP', 'Cycle failed', err)
    }

    await new Promise((r) => setTimeout(r, config.pollIntervalMs))
  }
}

// Auto-run only when executed directly (not imported by CLI)
const isDirectRun = process.argv[1]?.includes('index')
if (isDirectRun) {
  main().catch((err) => {
    log.error('FATAL', 'Keeper crashed', err)
    process.exit(1)
  })
}
