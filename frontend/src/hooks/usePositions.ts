import { useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { useAccount } from 'wagmi'
import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { PositionManagerABI } from '../lib/abis'
import { CONTRACTS } from '../lib/config'

export type Position = {
  id: bigint
  trader: `0x${string}`
  marketId: bigint
  side: number // 0 = LONG, 1 = SHORT
  entryPrice: bigint
  size: bigint
  collateral: bigint
  timestamp: bigint
  isOpen: boolean
}

export function useUserPositions() {
  const { address } = useAccount()
  return useReadContract({
    address: CONTRACTS.PositionManager,
    abi: PositionManagerABI,
    functionName: 'getUserPositions',
    args: [address!],
    query: { enabled: !!address, refetchInterval: 5000 },
  })
}

export function useUserOpenPositions() {
  const { address } = useAccount()
  return useReadContract({
    address: CONTRACTS.PositionManager,
    abi: PositionManagerABI,
    functionName: 'getUserOpenPositions',
    args: [address!],
    query: { enabled: !!address, refetchInterval: 5000 },
  })
}

export function usePosition(positionId: bigint) {
  return useReadContract({
    address: CONTRACTS.PositionManager,
    abi: PositionManagerABI,
    functionName: 'getPosition',
    args: [positionId],
  })
}

export function useHealthFactor(positionId: bigint) {
  return useReadContract({
    address: CONTRACTS.PositionManager,
    abi: PositionManagerABI,
    functionName: 'getHealthFactor',
    args: [positionId],
    query: { refetchInterval: 5000 },
  })
}

export function useAddCollateral() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) toast.loading('Adding collateral...', { id: 'add-collateral' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success('Collateral added!', { id: 'add-collateral' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(`Failed: ${error.message.slice(0, 80)}`, { id: 'add-collateral' })
  }, [error])

  const addCollateral = (positionId: bigint, amount: bigint) => {
    writeContract({
      address: CONTRACTS.PositionManager,
      abi: PositionManagerABI,
      functionName: 'addCollateral',
      args: [positionId, amount],
    })
  }

  return { addCollateral, isPending, isConfirming, isSuccess, hash }
}

export function useSettlePosition() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) toast.loading('Settling position...', { id: 'settle-position' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success('Position settled!', { id: 'settle-position' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(`Settlement failed: ${error.message.slice(0, 80)}`, { id: 'settle-position' })
  }, [error])

  const settlePosition = (positionId: bigint) => {
    writeContract({
      address: CONTRACTS.PositionManager,
      abi: PositionManagerABI,
      functionName: 'settlePosition',
      args: [positionId],
    })
  }

  return { settlePosition, isPending, isConfirming, isSuccess, hash }
}

export function useBatchSettle() {
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const [isSettling, setIsSettling] = useState(false)
  const [settled, setSettled] = useState(0)
  const [total, setTotal] = useState(0)

  const batchSettle = useCallback(async (positionIds: bigint[]) => {
    if (positionIds.length === 0 || !publicClient) return
    setIsSettling(true)
    setSettled(0)
    setTotal(positionIds.length)
    toast.loading(`Settling 0/${positionIds.length}...`, { id: 'batch-settle' })

    for (let i = 0; i < positionIds.length; i++) {
      try {
        const hash = await writeContractAsync({
          address: CONTRACTS.PositionManager,
          abi: PositionManagerABI,
          functionName: 'settlePosition',
          args: [positionIds[i]],
        })
        toast.loading(`Confirming ${i + 1}/${positionIds.length}...`, { id: 'batch-settle' })
        // Wait for tx to be confirmed before prompting next signature
        await publicClient.waitForTransactionReceipt({ hash })
        setSettled(i + 1)
        toast.loading(`Settled ${i + 1}/${positionIds.length}...`, { id: 'batch-settle' })
      } catch (err: any) {
        toast.error(`Failed on position #${Number(positionIds[i])}: ${err.message?.slice(0, 60)}`, { id: 'batch-settle' })
        setIsSettling(false)
        return
      }
    }

    toast.success(`${positionIds.length} positions settled!`, { id: 'batch-settle' })
    setIsSettling(false)
  }, [writeContractAsync, publicClient])

  return { batchSettle, isSettling, settled, total }
}

export function useClosePosition() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) toast.loading('Closing position...', { id: 'close-position' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success('Position closed!', { id: 'close-position' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(`Close failed: ${error.message.slice(0, 80)}`, { id: 'close-position' })
  }, [error])

  const closePosition = (positionId: bigint) => {
    writeContract({
      address: CONTRACTS.PositionManager,
      abi: PositionManagerABI,
      functionName: 'closePosition',
      args: [positionId],
    })
  }

  return { closePosition, isPending, isConfirming, isSuccess, hash }
}

export function useSetTPSL() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) toast.loading('Setting TP/SL...', { id: 'set-tpsl' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success('TP/SL set!', { id: 'set-tpsl' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(`TP/SL failed: ${error.message.slice(0, 80)}`, { id: 'set-tpsl' })
  }, [error])

  const setTPSL = (positionId: bigint, tp: bigint, sl: bigint) => {
    writeContract({
      address: CONTRACTS.PositionManager,
      abi: PositionManagerABI,
      functionName: 'setTPSL',
      args: [positionId, tp, sl],
    })
  }

  return { setTPSL, isPending, isConfirming, isSuccess, hash }
}

export function useTPSL(positionId: bigint) {
  return useReadContract({
    address: CONTRACTS.PositionManager,
    abi: PositionManagerABI,
    functionName: 'getTPSL',
    args: [positionId],
    query: { refetchInterval: 5000 },
  })
}

export function useLiquidate() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) toast.loading('Liquidating position...', { id: 'liquidate' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success('Position liquidated!', { id: 'liquidate' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(`Liquidation failed: ${error.message.slice(0, 80)}`, { id: 'liquidate' })
  }, [error])

  const liquidate = (positionId: bigint) => {
    writeContract({
      address: CONTRACTS.PositionManager,
      abi: PositionManagerABI,
      functionName: 'liquidate',
      args: [positionId],
    })
  }

  return { liquidate, isPending, isConfirming, isSuccess, hash }
}
