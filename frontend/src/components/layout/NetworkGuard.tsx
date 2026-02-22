import { useAccount, useChainId, useSwitchChain } from 'wagmi'

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  if (!isConnected || chainId === 43113) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-surface border border-border rounded-2xl p-8 max-w-md text-center shadow-2xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-danger/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-text mb-2">Wrong Network</h2>
        <p className="text-text-secondary text-sm mb-6">
          Tenor runs on <span className="text-text font-medium">Avalanche Fuji Testnet</span>.
          Please switch your network to continue.
        </p>

        <button
          onClick={() => switchChain({ chainId: 43113 })}
          disabled={isPending}
          className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 cursor-pointer"
          style={{
            backgroundImage: 'linear-gradient(135deg, #E84142 0%, #ef6566 100%)',
          }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Switching...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg width="18" height="18" viewBox="0 0 254 254" fill="none">
                <circle cx="127" cy="127" r="127" fill="white" fillOpacity="0.2"/>
                <path d="M171.8 130.3c4.4-7.6 11.5-7.6 15.9 0l27.4 48.1c4.4 7.6.8 13.8-8 13.8h-55.1c-8.7 0-12.3-6.2-8-13.8l27.8-48.1zm-53.4-93.2c4.4-7.6 11.4-7.6 15.8 0l5.4 9.8 12.8 23.1c3.5 7.2 3.5 15.7 0 22.9l-34.5 59.5c-4.4 7.2-12 11.6-20.3 11.6H60.5c-8.7 0-12.3-6.2-8-13.8l66-113.1z" fill="white"/>
              </svg>
              Switch to Avalanche Fuji
            </span>
          )}
        </button>

        <p className="text-text-secondary/50 text-xs mt-4">
          Chain ID: 43113 &middot; Testnet
        </p>
      </div>
    </div>
  )
}
