import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-30 blur-[120px]"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-20 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #E84142 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full opacity-15 blur-[80px]"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-medium text-text-secondary">
            Live on Avalanche Fuji Testnet
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
        >
          <span className="text-text">Trade the Future.</span>
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #E84142 50%, #818cf8 100%)',
            }}
          >
            Today.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          The first decentralized exchange for Non-Deliverable Forward contracts.
          Hedge exposure, speculate on future prices, and settle on-chain with zero counterparty risk
          &mdash; powered by Avalanche.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center justify-center gap-4"
        >
          <Link
            to="/trade/1"
            className="group relative inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white no-underline transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(99,102,241,0.3)]"
            style={{
              backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            }}
          >
            Launch App
            <svg
              className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            to="/markets"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-text-secondary border border-border no-underline transition-all duration-300 hover:border-primary/50 hover:text-text hover:bg-surface"
          >
            Explore Markets
          </Link>
        </motion.div>

        {/* Tech stack badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-10 flex items-center justify-center gap-3 flex-wrap"
        >
          <TechBadge label="Avalanche" color="#E84142" />
          <TechBadge label="Chainlink Oracles" color="#375BD2" />
          <TechBadge label="On-Chain Order Book" color="#6366f1" />
          <TechBadge label="Cash Settlement" color="#10b981" />
        </motion.div>

        {/* Decorative terminal preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-12 max-w-2xl mx-auto"
        >
          <div className="rounded-xl border border-border bg-surface/80 backdrop-blur-sm p-1 shadow-2xl shadow-primary/5">
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border">
              <div className="w-2.5 h-2.5 rounded-full bg-danger/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
              <span className="ml-3 text-xs text-text-secondary font-mono">ETH/USDC Forward - Mar 2026</span>
            </div>
            <div className="p-5 font-mono text-sm text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Forward Price</span>
                <span className="text-text font-semibold">$2,847.50</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Spot Price (Chainlink)</span>
                <span className="text-text">$2,780.00</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Premium</span>
                <span className="text-accent">+2.43%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Expiry</span>
                <span className="text-text">28d 14h</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">Your Position</span>
                <span className="text-success font-semibold">Long 5.0 ETH &middot; +$337.50</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

function TechBadge({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border"
      style={{
        borderColor: `${color}30`,
        backgroundColor: `${color}08`,
        color: `${color}`,
      }}
    >
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  )
}
