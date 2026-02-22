export function Vault() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-text">Vault</h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          Deposit USDC to earn yield from the protocol pool. Vaults provide liquidity for position payouts and earn fees from trading activity.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-sm font-medium text-primary">Coming Soon</span>
        </div>
      </div>
    </div>
  )
}
