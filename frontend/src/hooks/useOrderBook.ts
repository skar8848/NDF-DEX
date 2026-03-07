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

  const placeLimitOrder = (marketId: bigint, side: number, price: bigint, amount: bigint, orderLabel?: string, timeInForce?: number, token?: `0x${string}`) => {
    const collateralToken = token ?? CONTRACTS.MockUSDC
    labelRef.current = orderLabel ?? 'Limit order'
    if (timeInForce !== undefined) {
      writeContract({
        address: CONTRACTS.OrderBook,
        abi: OrderBookABI,
        functionName: 'placeLimitOrderAdvanced',
        args: [marketId, side, price, amount, timeInForce, collateralToken],
      })
    } else {
      writeContract({
        address: CONTRACTS.OrderBook,
        abi: OrderBookABI,
        functionName: 'placeLimitOrder',
        args: [marketId, side, price, amount, collateralToken],
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

  const placeMarketOrder = (marketId: bigint, side: number, amount: bigint, token?: `0x${string}`) => {
    writeContract({
      address: CONTRACTS.OrderBook,
      abi: OrderBookABI,
      functionName: 'placeMarketOrder',
      args: [marketId, side, amount, token ?? CONTRACTS.MockUSDC],
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
  const [mode, setMode] = useState<'1ct' | 'revoke' | 'trade'>('1ct')

  const label = mode === 'revoke' ? 'Revoking approval' : mode === 'trade' ? 'Approving USDC' : 'Enabling 1-Click Trading'

  useEffect(() => {
    if (hash) toast.loading(`${label}...`, { id: 'approve-usdc' })
  }, [hash, label])

  useEffect(() => {
    if (isSuccess) toast.success(mode === 'revoke' ? '1-Click Trading revoked' : mode === 'trade' ? 'USDC approved!' : '1-Click Trading enabled!', { id: 'approve-usdc' })
  }, [isSuccess, mode])

  useEffect(() => {
    if (error) toast.error(`${label} failed: ${error.message.slice(0, 80)}`, { id: 'approve-usdc' })
  }, [error, label])

  const approve = (spender: `0x${string}`, amount: bigint, token?: `0x${string}`) => {
    setMode(amount === 0n ? 'revoke' : amount >= 2n ** 128n ? '1ct' : 'trade')
    writeContract({
      address: token ?? CONTRACTS.MockUSDC,
      abi: MockUSDCABI,
      functionName: 'approve',
      args: [spender, amount],
    })
  }

  return { approve, isPending, isConfirming, isSuccess, hash }
}

export function useUSDCBalance(token?: `0x${string}`) {
  const { address } = useAccount()
  return useReadContract({
    address: token ?? CONTRACTS.MockUSDC,
    abi: MockUSDCABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address, refetchInterval: 5000 },
  })
}

export function useUSDCAllowance(token?: `0x${string}`) {
  const { address } = useAccount()
  return useReadContract({
    address: token ?? CONTRACTS.MockUSDC,
    abi: MockUSDCABI,
    functionName: 'allowance',
    args: [address!, CONTRACTS.OrderBook],
    query: { enabled: !!address, refetchInterval: 5000 },
  })
}
