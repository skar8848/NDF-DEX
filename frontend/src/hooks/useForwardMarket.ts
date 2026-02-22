import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { ForwardMarketABI } from '../lib/abis'
import { CONTRACTS } from '../lib/config'

export type MarketInfo = {
  id: bigint
  baseAsset: string
  quoteAsset: string
  expiration: bigint
  ltv: bigint
  liquidationThreshold: bigint
  minCollateral: bigint
  settlePrice: bigint
  settled: boolean
  totalLongOI: bigint
  totalShortOI: bigint
}

export function useAllMarkets() {
  return useReadContract({
    address: CONTRACTS.ForwardMarket,
    abi: ForwardMarketABI,
    functionName: 'getAllMarkets',
    query: { refetchInterval: 10000 },
  })
}

export function useActiveMarkets() {
  return useReadContract({
    address: CONTRACTS.ForwardMarket,
    abi: ForwardMarketABI,
    functionName: 'getActiveMarkets',
    query: { refetchInterval: 10000 },
  })
}

export function useMarket(marketId: bigint) {
  return useReadContract({
    address: CONTRACTS.ForwardMarket,
    abi: ForwardMarketABI,
    functionName: 'getMarket',
    args: [marketId],
    query: { refetchInterval: 5000 },
  })
}

export function useMarketCount() {
  return useReadContract({
    address: CONTRACTS.ForwardMarket,
    abi: ForwardMarketABI,
    functionName: 'marketCount',
  })
}

export function useSettleMarket() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) toast.loading('Settling market...', { id: 'settle-market' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success('Market settled!', { id: 'settle-market' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(`Settlement failed: ${error.message.slice(0, 80)}`, { id: 'settle-market' })
  }, [error])

  const settleMarket = (marketId: bigint) => {
    writeContract({
      address: CONTRACTS.ForwardMarket,
      abi: ForwardMarketABI,
      functionName: 'settleMarket',
      args: [marketId],
    })
  }

  return { settleMarket, isPending, isConfirming, isSuccess, hash }
}

export function useCreateMarket() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) toast.loading('Creating market...', { id: 'create-market' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success('Market created successfully!', { id: 'create-market' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(`Failed to create market: ${error.message.slice(0, 80)}`, { id: 'create-market' })
  }, [error])

  const createMarket = (
    baseAsset: string,
    quoteAsset: string,
    expiration: bigint,
    ltv: bigint,
    liquidationThreshold: bigint,
    minCollateral: bigint
  ) => {
    writeContract({
      address: CONTRACTS.ForwardMarket,
      abi: ForwardMarketABI,
      functionName: 'createMarket',
      args: [baseAsset, quoteAsset, expiration, ltv, liquidationThreshold, minCollateral],
    })
  }

  return { createMarket, isPending, isConfirming, isSuccess, hash }
}
