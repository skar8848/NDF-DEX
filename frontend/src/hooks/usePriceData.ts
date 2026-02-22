import { useReadContract } from 'wagmi'
import { MockOracleABI } from '../lib/abis'
import { CONTRACTS } from '../lib/config'

export function useOraclePrice(asset: string) {
  return useReadContract({
    address: CONTRACTS.MockOracle,
    abi: MockOracleABI,
    functionName: 'getPrice',
    args: [asset],
    query: { refetchInterval: 5000 },
  })
}
