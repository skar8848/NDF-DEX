import { positionManager, publicClient, PositionManagerABI } from '../contracts.js'
import { config } from '../config.js'
import { log } from '../utils/logger.js'

export type PositionData = {
  id: bigint
  trader: `0x${string}`
  marketId: bigint
  side: number // 0=LONG, 1=SHORT
  entryPrice: bigint
  size: bigint
  collateral: bigint
  timestamp: bigint
  isOpen: boolean
}

export type TPSLData = {
  takeProfitPrice: bigint
  stopLossPrice: bigint
}

export async function fetchAllOpenPositions(): Promise<PositionData[]> {
  const count = await positionManager.read.getOpenPositionCount()
  if (count === 0n) return []

  const total = Number(count)
  const pageSize = config.positionPageSize
  const allPositions: PositionData[] = []

  for (let offset = 0; offset < total; offset += pageSize) {
    const ids = await positionManager.read.getOpenPositionIds([BigInt(offset), BigInt(pageSize)])

    // Batch fetch positions via multicall
    const calls = ids.map((id) => ({
      address: config.addresses.positionManager,
      abi: PositionManagerABI,
      functionName: 'getPosition' as const,
      args: [id] as const,
    }))

    const results = await publicClient.multicall({ contracts: calls })

    for (const result of results) {
      if (result.status === 'success') {
        const p = result.result as PositionData
        if (p.isOpen) allPositions.push(p)
      }
    }
  }

  log.info('MONITOR', `Fetched ${allPositions.length} open positions`)
  return allPositions
}

export async function fetchTPSL(positionId: bigint): Promise<TPSLData> {
  return await positionManager.read.getTPSL([positionId]) as TPSLData
}

export async function batchFetchTPSL(positionIds: bigint[]): Promise<Map<bigint, TPSLData>> {
  const map = new Map<bigint, TPSLData>()

  const calls = positionIds.map((id) => ({
    address: config.addresses.positionManager,
    abi: PositionManagerABI,
    functionName: 'getTPSL' as const,
    args: [id] as const,
  }))

  const results = await publicClient.multicall({ contracts: calls })

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'success') {
      map.set(positionIds[i], results[i].result as TPSLData)
    }
  }

  return map
}

export async function batchFetchHealthFactors(positionIds: bigint[]): Promise<Map<bigint, bigint>> {
  const map = new Map<bigint, bigint>()

  const calls = positionIds.map((id) => ({
    address: config.addresses.positionManager,
    abi: PositionManagerABI,
    functionName: 'getHealthFactor' as const,
    args: [id] as const,
  }))

  const results = await publicClient.multicall({ contracts: calls })

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'success') {
      map.set(positionIds[i], results[i].result as bigint)
    }
  }

  return map
}
