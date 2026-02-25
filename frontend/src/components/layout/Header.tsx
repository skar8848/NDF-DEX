import { Link, useLocation } from 'react-router-dom'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { MockUSDCABI } from '../../lib/abis'
import { CONTRACTS } from '../../lib/config'
import { cn } from '../../lib/utils'
import { useTheme } from '../../hooks/useTheme'

const navLinks = [
  { to: '/trade/1', label: 'Trade' },
  { to: '/markets', label: 'Markets' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/vault', label: 'Vault' },
  { to: '/docs', label: 'Docs' },
]

export function Header() {
  const location = useLocation()
  const { isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const isCorrectNetwork = isConnected && chainId === 43113

  return (
    <header className="border-b border-border bg-surface px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white text-sm">
            T
          </div>
          <span className="text-lg font-bold text-text">Tenor</span>
        </Link>

        <nav className="flex gap-1">
          {navLinks.map((link) => {
            const isActive = link.to.startsWith('/trade')
              ? location.pathname.startsWith('/trade')
              : location.pathname === link.to
            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium no-underline transition-colors',
                  isActive
                    ? 'bg-surface-2 text-text'
                    : 'text-text-secondary hover:text-text hover:bg-surface-2'
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {/* Dark mode toggle */}
        <ThemeToggle />
        {/* Network indicator */}
        <button
          onClick={() => {
            if (!isCorrectNetwork && isConnected) switchChain({ chainId: 43113 })
          }}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors',
            isCorrectNetwork
              ? 'bg-surface-2 border-border cursor-default'
              : isConnected
                ? 'bg-danger/10 border-danger/20 hover:bg-danger/20 cursor-pointer'
                : 'bg-surface-2 border-border cursor-default'
          )}
        >
          {isCorrectNetwork ? (
            <>
              <div className="w-2 h-2 rounded-full bg-success" />
              <AvalancheLogo />
              <span className="text-xs font-medium text-text-secondary">Fuji</span>
            </>
          ) : isConnected ? (
            <>
              <div className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              <span className="text-xs font-medium text-danger">Switch to Fuji</span>
            </>
          ) : (
            <>
              <AvalancheLogo />
              <span className="text-xs font-medium text-text-secondary">Fuji</span>
            </>
          )}
        </button>

        <FaucetButton />
        <ConnectButton showBalance={false} />
      </div>
    </header>
  )
}

function AvalancheLogo() {
  return (
    <svg width="14" height="14" viewBox="0 0 254 254" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="127" cy="127" r="127" fill="#E84142"/>
      <path d="M171.8 130.3c4.4-7.6 11.5-7.6 15.9 0l27.4 48.1c4.4 7.6.8 13.8-8 13.8h-55.1c-8.7 0-12.3-6.2-8-13.8l27.8-48.1zm-53.4-93.2c4.4-7.6 11.4-7.6 15.8 0l5.4 9.8 12.8 23.1c3.5 7.2 3.5 15.7 0 22.9l-34.5 59.5c-4.4 7.2-12 11.6-20.3 11.6H60.5c-8.7 0-12.3-6.2-8-13.8l66-113.1z" fill="white"/>
    </svg>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg border border-border bg-surface-2 hover:bg-surface transition-colors cursor-pointer"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  )
}

function FaucetButton() {
  const { address } = useAccount()
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash })

  useEffect(() => {
    if (hash) toast.loading('Minting 10,000 USDC...', { id: 'faucet' })
  }, [hash])

  useEffect(() => {
    if (isSuccess) toast.success('10,000 USDC minted!', { id: 'faucet' })
  }, [isSuccess])

  useEffect(() => {
    if (error) toast.error('Faucet failed', { id: 'faucet' })
  }, [error])

  if (!address) return null

  return (
    <button
      onClick={() => {
        writeContract({
          address: CONTRACTS.MockUSDC,
          abi: MockUSDCABI,
          functionName: 'faucet',
        })
      }}
      disabled={isPending || isLoading}
      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors disabled:opacity-50 cursor-pointer"
    >
      {isPending || isLoading ? 'Minting...' : 'Faucet 10k USDC'}
    </button>
  )
}
