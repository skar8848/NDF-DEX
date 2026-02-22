import { WagmiProvider, http, fallback } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { avalancheFuji } from '../lib/config'

const config = getDefaultConfig({
  appName: 'Tenor',
  // Get a project ID at https://cloud.walletconnect.com
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '21fef48091f12692cad574a6f7753643',
  chains: [avalancheFuji],
  transports: {
    [avalancheFuji.id]: fallback([
      http('https://avalanche-fuji-c-chain-rpc.publicnode.com'),
      http('https://avalanche-fuji.drpc.org'),
      http('https://api.avax-test.network/ext/bc/C/rpc'),
    ]),
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
})

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#6366f1',
            accentColorForeground: 'white',
            borderRadius: 'medium',
            overlayBlur: 'small',
          })}
          initialChain={avalancheFuji}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
