import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Hero } from '../components/landing/Hero'
import { Features } from '../components/landing/Features'
import { HowItWorks } from '../components/landing/HowItWorks'
import { Stats } from '../components/landing/Stats'
import { useTheme } from '../hooks/useTheme'

export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal landing header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white text-sm">
              T
            </div>
            <span className="text-lg font-bold text-text">Tenor</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-6">
            <a href="#features" className="text-sm text-text-secondary hover:text-text transition-colors no-underline">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-text-secondary hover:text-text transition-colors no-underline">
              How It Works
            </a>
            <LandingThemeToggle />
            <Link
              to="/trade/1"
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white no-underline transition-all duration-300 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              style={{
                backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              }}
            >
              Launch App
            </Link>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main>
        <Hero />

        <div id="features">
          <Stats />
        </div>

        <Features />

        <div id="how-it-works">
          <HowItWorks />
        </div>

        {/* Powered by section */}
        <section className="py-16 px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto text-center"
          >
            <p className="text-xs uppercase tracking-widest text-text-secondary mb-6">Powered by</p>
            <div className="flex items-center justify-center gap-10 flex-wrap">
              <div className="flex items-center gap-2 text-text-secondary">
                <svg width="24" height="24" viewBox="0 0 254 254" fill="none">
                  <circle cx="127" cy="127" r="127" fill="#E84142"/>
                  <path d="M171.8 130.3c4.4-7.6 11.5-7.6 15.9 0l27.4 48.1c4.4 7.6.8 13.8-8 13.8h-55.1c-8.7 0-12.3-6.2-8-13.8l27.8-48.1zm-53.4-93.2c4.4-7.6 11.4-7.6 15.8 0l5.4 9.8 12.8 23.1c3.5 7.2 3.5 15.7 0 22.9l-34.5 59.5c-4.4 7.2-12 11.6-20.3 11.6H60.5c-8.7 0-12.3-6.2-8-13.8l66-113.1z" fill="white"/>
                </svg>
                <span className="font-semibold text-text">Avalanche</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary">
                <svg width="24" height="24" viewBox="0 0 37 40" fill="none">
                  <path d="M18.5 0L0 11.5V28.5L18.5 40L37 28.5V11.5L18.5 0Z" fill="#375BD2"/>
                  <path d="M18.5 6L6 13.5V26.5L18.5 34L31 26.5V13.5L18.5 6Z" fill="white"/>
                  <path d="M18.5 12L12 16V24L18.5 28L25 24V16L18.5 12Z" fill="#375BD2"/>
                </svg>
                <span className="font-semibold text-text">Chainlink</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                  <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                </svg>
                <span className="font-semibold text-text">Solidity</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <path d="M8 21h8M12 17v4"/>
                </svg>
                <span className="font-semibold text-text">React</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              background: 'radial-gradient(ellipse at center, #6366f1 0%, transparent 70%)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl mx-auto text-center relative"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-text mb-4">
              Ready to Trade Forwards?
            </h2>
            <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
              Connect your wallet and start trading Non-Deliverable Forwards on Avalanche. No sign-up required.
            </p>
            <Link
              to="/trade/1"
              className="group inline-flex items-center gap-2 px-10 py-4 rounded-xl font-semibold text-white text-lg no-underline transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(99,102,241,0.3)]"
              style={{
                backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
              }}
            >
              Start Trading
              <svg
                className="w-5 h-5 transition-transform group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8 px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center font-bold text-white text-[10px]">
                T
              </div>
              <span className="text-sm text-text-secondary">
                Tenor &middot; Built on Avalanche
              </span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-xs text-text-secondary/50">
                Fuji Testnet &middot; Chain ID 43113
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

function LandingThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      className="p-1.5 rounded-lg border border-border/50 hover:bg-surface transition-colors cursor-pointer"
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
