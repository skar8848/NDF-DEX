import { useState } from 'react'

const docs = [
  {
    category: 'Protocol',
    items: [
      { title: 'Architecture', desc: 'System overview, contract interactions, and data flow', file: 'ARCHITECTURE.md' },
      { title: 'Settlement', desc: 'How forward contracts settle at maturity', file: 'SETTLEMENT.md' },
      { title: 'Order Matching', desc: 'Price-time priority matching engine', file: 'MATCHING.md' },
    ],
  },
  {
    category: 'Trading',
    items: [
      { title: 'Advanced Orders', desc: 'IOC, FOK, Post-Only order types', file: 'ADVANCED_ORDERS.md' },
      { title: 'TP/SL', desc: 'Take-profit and stop-loss mechanics', file: 'TPSL.md' },
      { title: 'Fee System', desc: 'Maker/taker fees, rebates, builder codes, fee splits', file: 'FEE_SYSTEM.md' },
    ],
  },
  {
    category: 'Yield & Safety',
    items: [
      { title: 'TLP Vault', desc: 'Passive liquidity provision with TLP shares', file: 'VAULT.md' },
      { title: 'Insurance Fund', desc: 'Protocol backstop for solvency risk', file: 'INSURANCE_FUND.md' },
      { title: 'Multi-Collateral', desc: 'WETH, WBTC, WAVAX as collateral with haircuts', file: 'MULTI_COLLATERAL.md' },
    ],
  },
  {
    category: 'Developer',
    items: [
      { title: 'CLI Reference', desc: 'Command-line interface for trading and admin', file: 'CLI.md' },
      { title: 'Roadmap', desc: 'Current progress and future plans', file: 'ROADMAP.md' },
      { title: 'Improvements', desc: 'Changelog and upgrade history', file: 'IMPROVEMENTS.md' },
    ],
  },
]

const contracts = [
  { name: 'ForwardMarket', desc: 'Market creation & settlement', address: '0x7De1970F024cB1c2953dCBc850E895c4637f57E9' },
  { name: 'OrderBook', desc: 'Limit orders & matching engine', address: '0xd92Ff3f1FF6AAC7E298BcF9634eB907B9B7e7Bf9' },
  { name: 'PositionManager', desc: 'Position lifecycle & P&L', address: '0x7a867BC74482724C2B0b6F36DFb15f6691088a88' },
  { name: 'TenorVault', desc: 'TLP passive liquidity vault', address: '0x62Ef155a07EA3bF04e6930d40Ad1549F973fB37D' },
  { name: 'InsuranceFund', desc: 'Protocol solvency backstop', address: '0x3BC01a6710CF2f8DBa2E4bfD8b6F4C7F553E3BFC' },
  { name: 'CollateralManager', desc: 'Multi-collateral support', address: '0xE5586FF57d8602F980bf36eE9a9B99144cd15b66' },
  { name: 'ChainlinkOracle', desc: 'Price feed oracle', address: '0x6e1bebEf40dA65B2B5B39EFa1591a985C0EE884E' },
  { name: 'MockUSDC', desc: 'Testnet USDC (faucet)', address: '0xDa9103E3121784fba3e60f5a95304833a5A904f1' },
]

function shortenAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function Docs() {
  const [expandedSection, setExpandedSection] = useState<string | null>('Protocol')

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-text">Documentation</h1>
        <p className="text-sm text-text-secondary">
          Tenor Protocol — decentralized forward exchange on Avalanche
        </p>
      </div>

      {/* Documentation sections */}
      <div className="space-y-3">
        {docs.map((section) => {
          const isOpen = expandedSection === section.category
          return (
            <div key={section.category} className="bg-surface border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedSection(isOpen ? null : section.category)}
                className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-surface-2 transition-colors"
              >
                <span className="text-sm font-semibold text-text">{section.category}</span>
                <svg
                  className={`w-4 h-4 text-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <div className="border-t border-border">
                  {section.items.map((item) => (
                    <a
                      key={item.file}
                      href={`https://github.com/skar8848/ndf_dex/blob/main/docs/${item.file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-5 py-3 hover:bg-surface-2 transition-colors border-b border-border last:border-b-0 no-underline group"
                    >
                      <div>
                        <div className="text-sm font-medium text-text group-hover:text-primary transition-colors">
                          {item.title}
                        </div>
                        <div className="text-xs text-text-secondary mt-0.5">{item.desc}</div>
                      </div>
                      <svg className="w-4 h-4 text-text-secondary group-hover:text-primary transition-colors flex-shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Deployed Contracts */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">Deployed Contracts (Fuji Testnet)</h2>
        </div>
        <div className="divide-y divide-border">
          {contracts.map((c) => (
            <div key={c.name} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="text-sm font-medium text-text">{c.name}</div>
                <div className="text-xs text-text-secondary">{c.desc}</div>
              </div>
              <a
                href={`https://testnet.snowtrace.io/address/${c.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-primary hover:text-primary-hover no-underline transition-colors"
              >
                {shortenAddr(c.address)}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <a
          href="https://github.com/skar8848/ndf_dex"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-surface border border-border rounded-xl p-4 hover:border-primary/30 transition-colors no-underline group"
        >
          <div className="text-sm font-semibold text-text group-hover:text-primary transition-colors">GitHub</div>
          <div className="text-xs text-text-secondary mt-1">Source code</div>
        </a>
        <a
          href="https://testnet.snowtrace.io"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-surface border border-border rounded-xl p-4 hover:border-primary/30 transition-colors no-underline group"
        >
          <div className="text-sm font-semibold text-text group-hover:text-primary transition-colors">SnowTrace</div>
          <div className="text-xs text-text-secondary mt-1">Block explorer</div>
        </a>
        <a
          href="https://core.app/tools/testnet-faucet/?subnet=c&token=c"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-surface border border-border rounded-xl p-4 hover:border-primary/30 transition-colors no-underline group"
        >
          <div className="text-sm font-semibold text-text group-hover:text-primary transition-colors">AVAX Faucet</div>
          <div className="text-xs text-text-secondary mt-1">Get testnet AVAX</div>
        </a>
      </div>
    </div>
  )
}
