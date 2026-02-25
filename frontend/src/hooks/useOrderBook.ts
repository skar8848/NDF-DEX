import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useAccount } from 'wagmi'
import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { OrderBookABI, MockUSDCABI } from '../lib/abis'
import { CONTRACTS } from '../lib/config'

export type Order = {
  id: bigint
  trader: `0x${string}`
  marketId: bigint
  side: number // 0 = LONG, 1 = SHORT
  price: bigint
  amount: bigint
  filled: bigint
  collateral: bigint
  timestamp: bigint
  status: number // 0=OPEN, 1=FILLED, 2=PARTIAL, 3=CANCELLED
  timeInForce: number // 0=GTC, 1=IOC, 2=FOK, 3=POST_ONLY
}

export function useOrderBookData(marketId: bigint) {
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: 'getOrderBook',
    args: [marketId],
    query: { refetchInterval: 3000 },
  })
}

export function useUserOrders() {
  const { address } = useAccount()
  return useReadContract({
    address: CONTRACTS.OrderBook,
    abi: OrderBookABI,
    functionName: 'getUserOrders',
    args: [address!],
    query: {
      enabled: !!address,
      refetchInterval: 5000,
    },
  })
}

export function usePlaceLimitOrder() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const labelRef = useRef('Limit order')

  useEffect(() => {
    if (hash) toast.loading(`${labelRef.current} submitted...`, { id: 'limit-order' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success(`${labelRef.current} placed successfully!`, { id: 'limit-order' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(`Order failed: ${error.message.slice(0, 80)}`, { id: 'limit-order' })
  }, [error])

  const placeLimitOrder = (marketId: bigint, side: number, price: bigint, amount: bigint, orderLabel?: string, timeInForce?: number) => {
    labelRef.current = orderLabel ?? 'Limit order'
    if (timeInForce !== undefined) {
      writeContract({
        address: CONTRACTS.OrderBook,
        abi: OrderBookABI,
        functionName: 'placeLimitOrderAdvanced',
        args: [marketId, side, price, amount, timeInForce],
      })
    } else {
      writeContract({
        address: CONTRACTS.OrderBook,
        abi: OrderBookABI,
        functionName: 'placeLimitOrder',
        args: [marketId, side, price, amount],
      })
    }
  }

  return { placeLimitOrder, isPending, isConfirming, isSuccess, hash }
}

export function usePlaceMarketOrder() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) toast.loading('Market order submitted...', { id: 'market-order' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success('Market order executed!', { id: 'market-order' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(`Order failed: ${error.message.slice(0, 80)}`, { id: 'market-order' })
  }, [error])

  const placeMarketOrder = (marketId: bigint, side: number, amount: bigint) => {
    writeContract({
      address: CONTRACTS.OrderBook,
      abi: OrderBookABI,
      functionName: 'placeMarketOrder',
      args: [marketId, side, amount],
    })
  }

  return { placeMarketOrder, isPending, isConfirming, isSuccess, hash }
}

export function useCancelOrder() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const hashRef = useRef<`0x${string}` | undefined>(undefined)
  hashRef.current = hash

  useEffect(() => {
    if (hash) toast.loading('Cancelling order...', { id: 'cancel-order' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success('Order cancelled', { id: 'cancel-order' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error(`Cancel failed: ${error.message.slice(0, 80)}`, { id: 'cancel-order' })
  }, [error])

  // If component unmounts while tx is in-flight (order row disappears from list
  // after refetch), resolve the toast so it doesn't spin forever
  useEffect(() => {
    return () => {
      if (hashRef.current) {
        toast.success('Order cancelled', { id: 'cancel-order' })
      }
    }
  }, [])

  const cancelOrder = useCallback((orderId: bigint) => {
    writeContract({
      address: CONTRACTS.OrderBook,
      abi: OrderBookABI,
      functionName: 'cancelOrder',
      args: [orderId],
    })
  }, [writeContract])

  return { cancelOrder, isPending, isConfirming, isSuccess, hash }
}

export function useApproveUSDC() {
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  const [isRevoke, setIsRevoke] = useState(false)

  useEffect(() => {
    if (hash) toast.loading(isRevoke ? 'Revoking approval...' : 'Enabling 1-Click Trading...', { id: 'approve-usdc' })
  }, [hash, isRevoke])

  useEffect(() => {
    if (isSuccess) toast.success(isRevoke ? '1-Click Trading revoked' : '1-Click Trading enabled!', { id: 'approve-usdc' })
  }, [isSuccess, isRevoke])

  useEffect(() => {
    if (error) toast.error(`${isRevoke ? 'Revoke' : 'Approval'} failed: ${error.message.slice(0, 80)}`, { id: 'approve-usdc' })
  }, [error, isRevoke])

  const approve = (spender: `0x${string}`, amount: bigint) => {
    setIsRevoke(amount === 0n)
    writeContract({
      address: CONTRACTS.MockUSDC,
      abi: MockUSDCABI,
      functionName: 'approve',
      args: [spender, amount],
    })
  }

  return { approve, isPending, isConfirming, isSuccess, hash }
}

export function useUSDCBalance() {
  const { address } = useAccount()
  return useReadContract({
    address: CONTRACTS.MockUSDC,
    abi: MockUSDCABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address, refetchInterval: 5000 },
  })
}

export function useUSDCAllowance() {
  const { address } = useAccount()
  return useReadContract({
    address: CONTRACTS.MockUSDC,
    abi: MockUSDCABI,
    functionName: 'allowance',
    args: [address!, CONTRACTS.OrderBook],
    query: { enabled: !!address, refetchInterval: 5000 },
  })
}
