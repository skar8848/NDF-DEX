import { useState } from 'react'
import { cn } from '../lib/utils'

// ─── Sidebar structure ───────────────────────────────────────────────
type DocPage = {
  id: string
  title: string
  icon: string
}

type DocSection = {
  label: string
  pages: DocPage[]
}

const sections: DocSection[] = [
  {
    label: 'Getting Started',
    pages: [
      { id: 'overview', title: 'Overview', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
      { id: 'architecture', title: 'Architecture', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
      { id: 'contracts', title: 'Deployed Contracts', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    ],
  },
  {
    label: 'Trading',
    pages: [
      { id: 'matching', title: 'Order Matching', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
      { id: 'orders', title: 'Advanced Orders', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { id: 'tpsl', title: 'Take Profit / Stop Loss', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
      { id: 'settlement', title: 'Settlement', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
      { id: 'fees', title: 'Fee System', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    ],
  },
  {
    label: 'Yield & Safety',
    pages: [
      { id: 'vault', title: 'TLP Vault', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      { id: 'insurance', title: 'Insurance Fund', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
      { id: 'collateral', title: 'Multi-Collateral', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    ],
  },
  {
    label: 'Developer',
    pages: [
      { id: 'cli', title: 'CLI Reference', icon: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { id: 'roadmap', title: 'Roadmap', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    ],
  },
]

const allPages = sections.flatMap(s => s.pages)

// ─── Contract addresses ──────────────────────────────────────────────
const contracts = [
  { name: 'ForwardMarket', role: 'Market creation & settlement', address: '0x7De1970F024cB1c2953dCBc850E895c4637f57E9' },
  { name: 'OrderBook', role: 'Limit orders & matching engine', address: '0xd92Ff3f1FF6AAC7E298BcF9634eB907B9B7e7Bf9' },
  { name: 'PositionManager', role: 'Position lifecycle & P&L', address: '0x7a867BC74482724C2B0b6F36DFb15f6691088a88' },
  { name: 'TenorVault', role: 'TLP passive liquidity vault', address: '0x62Ef155a07EA3bF04e6930d40Ad1549F973fB37D' },
  { name: 'InsuranceFund', role: 'Protocol solvency backstop', address: '0x3BC01a6710CF2f8DBa2E4bfD8b6F4C7F553E3BFC' },
  { name: 'CollateralManager', role: 'Multi-collateral support', address: '0xE5586FF57d8602F980bf36eE9a9B99144cd15b66' },
  { name: 'ChainlinkOracle', role: 'Price feed oracle', address: '0x6e1bebEf40dA65B2B5B39EFa1591a985C0EE884E' },
  { name: 'MockUSDC', role: 'Testnet USDC (faucet)', address: '0xDa9103E3121784fba3e60f5a95304833a5A904f1' },
  { name: 'MockWETH', role: 'Testnet WETH', address: '0x53bcf608A367661b3cafd4878624041F2ce522E3' },
]

// ─── Reusable doc components ─────────────────────────────────────────
function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-2xl font-bold text-text mb-2">{children}</h1>
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-text mt-8 mb-3 pb-2 border-b border-border">{children}</h2>
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-text mt-6 mb-2">{children}</h3>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text-secondary leading-relaxed mb-3">{children}</p>
}
function Code({ children }: { children: React.ReactNode }) {
  return <pre className="bg-[#0d0d14] border border-border rounded-lg p-4 text-xs font-mono text-text overflow-x-auto mb-4 whitespace-pre">{children}</pre>
}
function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="bg-surface-2 text-primary text-xs px-1.5 py-0.5 rounded font-mono">{children}</code>
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h, i) => <th key={i} className="text-left py-2 px-3 text-text-secondary font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/50">
              {row.map((cell, j) => <td key={j} className="py-2 px-3 text-text font-mono">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function Callout({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-primary/5 border-primary/20 text-primary',
    warning: 'bg-warning/10 border-warning/20 text-warning',
    success: 'bg-success/10 border-success/20 text-success',
  }
  return (
    <div className={`border rounded-lg p-3 mb-4 text-xs leading-relaxed ${styles[type]}`}>
      {children}
    </div>
  )
}
function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-text-secondary leading-relaxed mb-1.5 pl-1">{children}</li>
}

// ─── Page content ────────────────────────────────────────────────────

function OverviewPage() {
  return (
    <div>
      <H1>Tenor Protocol</H1>
      <P>Decentralized Non-Deliverable Forward (NDF) exchange built on Avalanche. Permissionless trading of cash-settled forward contracts on crypto assets with fully on-chain order matching, Chainlink oracle pricing, and automated position management.</P>

      <Callout type="info">Forward contracts on Tenor: two parties agree on a future price for an asset. At expiration, instead of delivering the underlying, the contract settles the price difference in USDC.</Callout>

      <H2>Key Features</H2>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { title: 'On-Chain CLOB', desc: 'Fully on-chain order book with automatic price-time priority matching' },
          { title: 'Chainlink Oracles', desc: 'Live price feeds for ETH, BTC, AVAX on Fuji testnet' },
          { title: 'Advanced Orders', desc: 'GTC, IOC, FOK, Post-Only time-in-force modes' },
          { title: 'TP/SL', desc: 'On-chain take-profit and stop-loss with keeper automation' },
          { title: 'TLP Vault', desc: 'Passive liquidity provision earning 60% of trading fees' },
          { title: 'Insurance Fund', desc: 'Protocol backstop covering solvency shortfalls' },
          { title: 'Multi-Collateral', desc: 'WETH, WBTC, WAVAX with oracle-based haircuts' },
          { title: 'Fee Rebates', desc: 'Maker rebates, builder codes, protocol/insurance/LP split' },
        ].map(f => (
          <div key={f.title} className="bg-surface-2 rounded-lg p-3 border border-border/50">
            <div className="text-xs font-semibold text-text mb-1">{f.title}</div>
            <div className="text-[10px] text-text-secondary">{f.desc}</div>
          </div>
        ))}
      </div>

      <H2>How It Works</H2>
      <div className="space-y-3 mb-6">
        {[
          { step: '1', title: 'Deposit USDC', desc: 'Get testnet USDC from the faucet and deposit as collateral' },
          { step: '2', title: 'Place Orders', desc: 'Place limit or market orders on any forward market (ETH, BTC, AVAX)' },
          { step: '3', title: 'Automatic Matching', desc: 'Orders are matched on-chain when prices cross. Positions are created for both sides.' },
          { step: '4', title: 'Manage Positions', desc: 'Set TP/SL, add collateral, or close early at mark price' },
          { step: '5', title: 'Settlement', desc: 'At expiry, positions settle at the Chainlink oracle price. PnL paid in USDC.' },
        ].map(s => (
          <div key={s.step} className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.step}</div>
            <div>
              <div className="text-sm font-medium text-text">{s.title}</div>
              <div className="text-xs text-text-secondary">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <H2>Tech Stack</H2>
      <Table
        headers={['Layer', 'Technology']}
        rows={[
          ['Smart Contracts', 'Solidity 0.8.24, Foundry, OpenZeppelin'],
          ['Oracle', 'Chainlink AggregatorV3 (Fuji feeds)'],
          ['Frontend', 'React 18, Vite, TypeScript, Tailwind CSS v4'],
          ['Web3', 'wagmi v2, viem, RainbowKit'],
          ['Keeper Bot', 'TypeScript, viem, Multicall3'],
          ['Charts', 'TradingView Lightweight Charts'],
          ['Chain', 'Avalanche Fuji Testnet (43113)'],
        ]}
      />
    </div>
  )
}

function ArchitecturePage() {
  return (
    <div>
      <H1>Architecture</H1>
      <P>The protocol consists of three core smart contracts, an oracle layer, and supporting infrastructure.</P>

      <H2>Core Contracts</H2>

      <H3>ForwardMarket</H3>
      <P>Registry and lifecycle manager for forward markets. Each market defines a tradeable forward contract with a base asset (e.g. ETH), expiration timestamp, LTV ratio, and liquidation threshold.</P>
      <Table
        headers={['Function', 'Description']}
        rows={[
          ['createMarket(...)', 'Creates a new forward market with risk parameters'],
          ['settleMarket(marketId)', 'Settles an expired market using the Chainlink oracle price'],
          ['getMarket(marketId)', 'Returns full market info (expiration, LTV, OI, settlement)'],
          ['updateOI(marketId, side, amount, isIncrease)', 'Updates open interest (called by PositionManager)'],
          ['setAuthorized(addr, status)', 'Grants/revokes OI update authorization'],
        ]}
      />

      <H3>OrderBook</H3>
      <P>On-chain CLOB with automatic matching engine, fee collection, and advanced order types. When a trader places an order, collateral is calculated and transferred. The matching engine immediately fills against resting orders.</P>
      <Table
        headers={['Function', 'Description']}
        rows={[
          ['placeLimitOrder(marketId, side, price, amount)', 'GTC limit order with immediate matching attempt'],
          ['placeLimitOrderAdvanced(..., timeInForce)', 'Advanced order with IOC/FOK/POST_ONLY support'],
          ['placeMarketOrder(marketId, side, amount)', 'Market order using extreme price bounds'],
          ['cancelOrder(orderId)', 'Cancel and refund remaining collateral'],
          ['getOrderBook(marketId)', 'Returns all open bids and asks'],
        ]}
      />

      <H3>PositionManager</H3>
      <P>Manages open positions, collateral, TP/SL orders, liquidation, early close, and settlement payouts.</P>
      <Table
        headers={['Function', 'Description']}
        rows={[
          ['openPosition(...)', 'Creates a new position (only callable by OrderBook)'],
          ['closePosition(positionId, closeSize)', 'Early close at oracle mark price. 0 = full close'],
          ['setTPSL(positionId, tp, sl)', 'Sets take-profit and/or stop-loss levels'],
          ['addCollateral(positionId, amount)', 'Deposits additional collateral'],
          ['liquidate(positionId)', 'Liquidates unhealthy position (5% bonus to liquidator)'],
          ['settlePosition(positionId)', 'Settles position on a settled market'],
        ]}
      />

      <H2>Supporting Contracts</H2>
      <Table
        headers={['Contract', 'Role']}
        rows={[
          ['ChainlinkOracle', 'Reads live prices from Chainlink AggregatorV3 feeds, normalized to 8 decimals'],
          ['InsuranceFund', 'Backstops PositionManager against solvency risk'],
          ['TenorVault', 'ERC20 vault (TLP) for passive USDC liquidity provision'],
          ['CollateralManager', 'Multi-collateral deposits with oracle-based haircuts'],
        ]}
      />

      <H2>Precision Constants</H2>
      <Code>{`PRICE_PRECISION      = 1e8   // 8 decimals for prices
COLLATERAL_PRECISION = 1e6   // 6 decimals for USDC
PERCENT_BASE         = 1e4   // 100% = 10000 basis points`}</Code>

      <H2>Keeper Bot</H2>
      <P>TypeScript service polling every 5 seconds. Each cycle: fetches markets and prices, checks all open positions for TP/SL triggers, liquidation conditions, and expired markets needing settlement.</P>
    </div>
  )
}

function ContractsPage() {
  return (
    <div>
      <H1>Deployed Contracts</H1>
      <P>All contracts are deployed on <strong className="text-text">Avalanche Fuji Testnet</strong> (Chain ID: 43113).</P>

      <Callout type="info">Click any address to view it on SnowTrace block explorer.</Callout>

      <div className="space-y-2 mb-6">
        {contracts.map(c => (
          <div key={c.name} className="flex items-center justify-between bg-surface-2 rounded-lg p-3 border border-border/50">
            <div>
              <div className="text-sm font-semibold text-text">{c.name}</div>
              <div className="text-[10px] text-text-secondary">{c.role}</div>
            </div>
            <a
              href={`https://testnet.snowtrace.io/address/${c.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-primary hover:text-primary-hover no-underline transition-colors"
            >
              {c.address.slice(0, 6)}...{c.address.slice(-4)}
            </a>
          </div>
        ))}
      </div>

      <H2>Chainlink Price Feeds (Fuji)</H2>
      <Table
        headers={['Asset', 'Feed Address']}
        rows={[
          ['ETH/USD', '0x86d67c3D38D2bCeE722E601025C25a575021c6EA'],
          ['BTC/USD', '0x31CF013A08c6Ac228C94551d535d5BAfE19c602a'],
          ['AVAX/USD', '0x5498BB86BC934c8D34FDA08E81D444153d0D06aD'],
        ]}
      />

      <H2>Quick Links</H2>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'GitHub', url: 'https://github.com/skar8848/ndf_dex', desc: 'Source code' },
          { label: 'SnowTrace', url: 'https://testnet.snowtrace.io', desc: 'Block explorer' },
          { label: 'AVAX Faucet', url: 'https://core.app/tools/testnet-faucet/?subnet=c&token=c', desc: 'Get testnet AVAX' },
        ].map(l => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="bg-surface-2 border border-border/50 rounded-lg p-3 no-underline hover:border-primary/30 transition-colors group">
            <div className="text-xs font-semibold text-text group-hover:text-primary transition-colors">{l.label}</div>
            <div className="text-[10px] text-text-secondary mt-0.5">{l.desc}</div>
          </a>
        ))}
      </div>
    </div>
  )
}

function MatchingPage() {
  return (
    <div>
      <H1>Order Matching Engine</H1>
      <P>Fully on-chain CLOB with automatic matching. When an order is placed, the matching engine immediately fills it against resting orders on the opposite side.</P>

      <H2>Order Book Structure</H2>
      <P>Two arrays per market:</P>
      <ul className="list-disc list-inside mb-4">
        <Li><strong className="text-text">Bids</strong> — LONG orders (buy interest), sorted by price descending</Li>
        <Li><strong className="text-text">Asks</strong> — SHORT orders (sell interest), sorted by price ascending</Li>
      </ul>

      <H2>Collateral Calculation</H2>
      <Code>{`collateral = (amount * price / PRICE_PRECISION)
           * COLLATERAL_PRECISION * PERCENT_BASE / ltv

Example: 10 ETH @ $2,500, 50% LTV
= 10 * 2500 * 1e6 * 10000 / 5000
= $50,000 USDC (2x leverage)`}</Code>

      <H2>Matching Algorithm</H2>
      <div className="space-y-2 mb-4">
        {[
          'Incoming order placed → collateral transferred from trader',
          'Scan opposite side: LONG incoming → scan asks, SHORT → scan bids',
          'Check price crossing: LONG price >= ask price, or SHORT price <= bid price',
          'Calculate match amount: min(remaining, resting available)',
          'Execute at resting order price (maker price wins)',
          'Create positions for both sides via PositionManager',
          'Repeat until fully filled or no more matching orders',
          'Unfilled remainder: rests in book (limit) or refunded (market)',
        ].map((step, i) => (
          <div key={i} className="flex gap-2 text-xs text-text-secondary">
            <span className="text-primary font-mono shrink-0">{i + 1}.</span>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <H2>Partial Fills</H2>
      <P>Collateral is allocated proportionally to the filled amount:</P>
      <Code>{`collatForFill = order.collateral * matchAmount / (order.amount - order.filled)`}</Code>

      <H2>Liquidation</H2>
      <Code>{`equity = collateral + PnL
maintenanceMargin = size * entryPrice * liqThreshold * CP / (PP * PB)
healthFactor = equity * PB / maintenanceMargin

If healthFactor < 10000 (100%) → liquidatable
Liquidator receives 5% bonus from remaining collateral`}</Code>
    </div>
  )
}

function OrdersPage() {
  return (
    <div>
      <H1>Advanced Order Types</H1>
      <P>Four time-in-force (TIF) modes for limit orders.</P>

      <H2>GTC — Good-Til-Cancelled</H2>
      <P>Default mode. Order stays on the book until filled or cancelled.</P>
      <Code>{`npx tsx src/cli.ts trade long ETH 5 --price 2500
npx tsx src/cli.ts trade long ETH 5 --price 2500 --tif gtc`}</Code>

      <H2>IOC — Immediate-Or-Cancel</H2>
      <P>Fills what's available immediately, cancels and refunds the remainder. Never added to the book.</P>
      <Code>{`npx tsx src/cli.ts trade long ETH 5 --price 2500 --tif ioc`}</Code>
      <Callout type="info">If 3 out of 5 contracts fill → fills 3, refunds collateral for remaining 2. If 0 fill → full refund.</Callout>

      <H2>FOK — Fill-Or-Kill</H2>
      <P>Must fill the entire order or the transaction reverts. Atomic all-or-nothing.</P>
      <Code>{`npx tsx src/cli.ts trade long ETH 5 --price 2500 --tif fok`}</Code>
      <Callout type="warning">Reverts with "insufficient liquidity (FOK)" if not enough volume at the price.</Callout>

      <H2>POST_ONLY — Add to Book Only</H2>
      <P>Ensures the order rests as a maker. Reverts if it would cross and match immediately.</P>
      <Code>{`npx tsx src/cli.ts trade long ETH 2 --price 2400 --tif post-only`}</Code>
      <Callout type="success">Market makers use this to guarantee earning maker rebates (2 bps) instead of paying taker fees (5 bps).</Callout>

      <H2>SDK Usage</H2>
      <Code>{`import { TimeInForce } from '@tenor-protocol/sdk'

await client.placeLimitOrderAdvanced(
  1n, 'long', parsePrice('2500'), 5n, TimeInForce.IOC
)
await client.placeLimitOrderAdvanced(
  1n, 'short', parsePrice('2400'), 3n, TimeInForce.POST_ONLY
)`}</Code>
    </div>
  )
}

function TPSLPage() {
  return (
    <div>
      <H1>Take Profit / Stop Loss</H1>
      <P>On-chain TP/SL orders stored in the PositionManager, executed by the keeper bot when oracle price crosses the threshold.</P>

      <H2>How It Works</H2>
      <div className="space-y-2 mb-4">
        {[
          'Trader sets TP/SL via setTPSL(positionId, tp, sl) — both optional (pass 0 to skip)',
          'Prices stored on-chain in tpslOrders mapping (8 decimals)',
          'Keeper polls every 5s, batch-fetches TP/SL via multicall',
          'When oracle price crosses threshold → keeper calls closePosition()',
          'Contract validates caller has TP/SL permission before closing',
        ].map((step, i) => (
          <div key={i} className="flex gap-2 text-xs text-text-secondary">
            <span className="text-primary font-mono shrink-0">{i + 1}.</span>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <H2>Trigger Conditions</H2>
      <Table
        headers={['Position', 'Take Profit', 'Stop Loss']}
        rows={[
          ['LONG', 'markPrice >= tpPrice', 'markPrice <= slPrice'],
          ['SHORT', 'markPrice <= tpPrice', 'markPrice >= slPrice'],
        ]}
      />

      <H2>Validation Rules</H2>
      <Table
        headers={['Position', 'TP must be...', 'SL must be...']}
        rows={[
          ['LONG', 'Above entry price', 'Below entry price'],
          ['SHORT', 'Below entry price', 'Above entry price'],
        ]}
      />

      <H2>Gain/Loss Calculation</H2>
      <Code>{`TP gain (LONG)  = (tpPrice - entryPrice) * size * CP / PP
TP ROE          = gain / collateral * 100%

SL loss (LONG)  = (entryPrice - slPrice) * size * CP / PP
SL ROE          = loss / collateral * 100%`}</Code>

      <H2>Exit Methods Comparison</H2>
      <Table
        headers={['Method', 'Trigger', 'Price Source', 'When']}
        rows={[
          ['Settlement', 'Market expired', 'Locked settlement price', 'After expiry'],
          ['Early Close', 'Trader calls', 'Live oracle mark price', 'Before expiry'],
          ['TP/SL', 'Price threshold', 'Live oracle mark price', 'Before expiry'],
          ['Liquidation', 'Health < 100%', 'Live oracle mark price', 'Before expiry'],
        ]}
      />
    </div>
  )
}

function SettlementPage() {
  return (
    <div>
      <H1>Forward Settlement</H1>
      <P>Forward contracts expire at a predetermined timestamp. At expiration, the market is settled using the Chainlink oracle price, and all positions are closed with PnL calculated against that price.</P>

      <H2>Two-Phase Settlement</H2>
      <H3>Phase 1: Market Settlement</H3>
      <P>Anyone calls <InlineCode>settleMarket(marketId)</InlineCode>. The contract reads the oracle price and locks it as the definitive settlement price. Once set, it's immutable.</P>

      <H3>Phase 2: Position Settlement</H3>
      <P>For each open position on the settled market, <InlineCode>settlePosition(positionId)</InlineCode> calculates PnL against the settlement price and distributes payouts.</P>

      <H2>PnL Calculation</H2>
      <Code>{`LONG PnL  = (settlePrice - entryPrice) * size * CP / PP
SHORT PnL = (entryPrice - settlePrice) * size * CP / PP

Payout:
  if PnL >= 0: payout = collateral + PnL (capped at balance)
  if PnL <  0: payout = max(collateral - |PnL|, 0)`}</Code>

      <H2>Worked Example</H2>
      <Table
        headers={['', 'Alice (LONG)', 'Bob (SHORT)']}
        rows={[
          ['Entry price', '$2,500', '$2,500'],
          ['Settlement price', '$2,800', '$2,800'],
          ['Size', '5 contracts', '5 contracts'],
          ['Collateral', '$25,000', '$25,000'],
          ['PnL', '+$1,500', '-$1,500'],
          ['Payout', '$26,500', '$23,500'],
          ['Return', '+6.0%', '-6.0%'],
        ]}
      />

      <H2>Settlement Guards</H2>
      <Table
        headers={['Check', 'Error']}
        rows={[
          ['Market exists', 'ForwardMarket: market not found'],
          ['Not already settled', 'ForwardMarket: already settled'],
          ['Market is expired', 'ForwardMarket: not expired'],
          ['Oracle returns valid price', 'ChainlinkOracle: invalid price'],
          ['Position is open', 'PositionManager: position closed'],
          ['Market is settled', 'PositionManager: market not settled'],
        ]}
      />
    </div>
  )
}

function FeesPage() {
  return (
    <div>
      <H1>Fee System</H1>
      <P>Comprehensive fee system inspired by Hyperliquid and GMX with maker rebates, fee splits, and builder codes.</P>

      <H2>Fee Structure</H2>
      <Table
        headers={['Type', 'Rate', 'Description']}
        rows={[
          ['Taker Fee', '5 bps (0.05%)', 'Charged to incoming (taker) order on each match'],
          ['Maker Rebate', '2 bps (0.02%)', 'Rebated to resting (maker) order collateral'],
        ]}
      />

      <H2>Fee Distribution</H2>
      <P>Net fees (taker fee minus maker rebate) are distributed:</P>
      <Table
        headers={['Destination', 'Share', 'Description']}
        rows={[
          ['Protocol', '30%', 'Goes to feeCollector address'],
          ['Insurance', '10%', 'Goes to InsuranceFund contract'],
          ['LP Vault', '60%', 'Goes to TenorVault (TLP holders)'],
        ]}
      />

      <H2>Builder Codes</H2>
      <P>Frontends and integrators can earn a share of taker fees (Hyperliquid-inspired):</P>
      <div className="space-y-2 mb-4">
        {[
          'Admin registers builder: registerBuilder(builder, feeBps)',
          'Trader sets their builder: setBuilderForTrader(trader, builder)',
          'On each trade, builder receives feeBps of the net fee',
        ].map((step, i) => (
          <div key={i} className="flex gap-2 text-xs text-text-secondary">
            <span className="text-primary font-mono shrink-0">{i + 1}.</span>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <H2>Example Flow</H2>
      <Callout type="info">
        Alice places LONG limit (maker). Bob places SHORT that crosses (taker).
        Bob pays 5 bps. Alice receives 2 bps rebate. Net 3 bps split: 30% protocol, 10% insurance, 60% LP vault.
      </Callout>

      <H2>View Functions</H2>
      <Code>{`getFeeConfig() → (takerBps, makerBps, rebateEnabled, protocolBps, insuranceBps, lpBps)
getFeeTotals() → (totalCollected, protocolFees, insuranceFees, builderFees, makerRebates)`}</Code>
    </div>
  )
}

function VaultPage() {
  return (
    <div>
      <H1>TLP Vault — Passive Liquidity</H1>
      <P>Inspired by Hyperliquid's HLP and GMX's GLP. TLP (Tenor LP) is an ERC20 token representing shares in the vault. As fee revenue flows in, share price increases — depositors profit without active trading.</P>

      <H2>Deposit</H2>
      <P>Depositor sends USDC to the vault, receives TLP shares proportional to vault value:</P>
      <Code>{`First deposit: 1 TLP = 1 USDC (scaled to 18 decimals)
Subsequent:    shares = amount * totalSupply / vaultBalance`}</Code>

      <H2>Withdraw (Two-Step)</H2>
      <P>Prevents flash loan attacks and provides stability:</P>
      <div className="space-y-2 mb-4">
        <div className="flex gap-2 text-xs text-text-secondary">
          <span className="text-primary font-mono shrink-0">1.</span>
          <span><strong className="text-text">Request</strong> — Starts the delay timer (default 24h). Shares are locked.</span>
        </div>
        <div className="flex gap-2 text-xs text-text-secondary">
          <span className="text-primary font-mono shrink-0">2.</span>
          <span><strong className="text-text">Execute</strong> — After delay, burns shares and sends proportional USDC.</span>
        </div>
      </div>

      <H2>Share Price</H2>
      <Code>{`sharePrice = vaultUSDCBalance / totalTLPSupply`}</Code>
      <Callout type="success">Share price only goes up as fees flow in — no impermanent loss.</Callout>

      <H2>Revenue Sources</H2>
      <ul className="list-disc list-inside mb-4">
        <Li><strong className="text-text">60% of all trading fees</strong> flow to the vault (configurable)</Li>
        <Li>Vault manager can approve OrderBook to use vault USDC for market making</Li>
      </ul>

      <H2>Configuration</H2>
      <Table
        headers={['Parameter', 'Default', 'Description']}
        rows={[
          ['depositCap', '0 (unlimited)', 'Maximum USDC in vault'],
          ['withdrawalDelay', '24 hours', 'Time between request and execute'],
          ['managementFeeBps', '0', 'Annual management fee'],
          ['performanceFeeBps', '0', 'Performance fee on profits'],
        ]}
      />

      <H2>Anti-Inflation Protection</H2>
      <Callout type="warning">First deposit mints 1000 "dead shares" to address(1) to prevent the classic ERC4626 first-depositor inflation attack.</Callout>
    </div>
  )
}

function InsurancePage() {
  return (
    <div>
      <H1>Insurance Fund</H1>
      <P>Backstops the PositionManager against solvency risk when PnL exceeds counterparty collateral.</P>

      <H2>Problem</H2>
      <P>When a position's PnL exceeds the counterparty's collateral, the PositionManager may not have enough USDC to pay out. Previously, payouts were silently capped.</P>

      <H2>Solution</H2>
      <P><InlineCode>InsuranceFund.sol</InlineCode> automatically covers shortfalls during settlement and early close.</P>

      <H2>Funding Sources</H2>
      <ul className="list-disc list-inside mb-4">
        <Li><strong className="text-text">Fee Revenue</strong> — 10% of all trading fees flow to the insurance fund</Li>
        <Li><strong className="text-text">Direct Deposits</strong> — Anyone can deposit USDC via <InlineCode>deposit(amount)</InlineCode></Li>
        <Li><strong className="text-text">Seed Funding</strong> — Initial deployment seeds the fund</Li>
      </ul>

      <H2>Shortfall Coverage Flow</H2>
      <div className="space-y-2 mb-4">
        {[
          'PositionManager detects payout > balance',
          'Calculates shortfall = payout - balance',
          'Calls insuranceFund.coverShortfall(positionId, shortfall)',
          'Insurance fund transfers up to its full balance',
          'Emits InsuranceCover or PartialCover event',
        ].map((step, i) => (
          <div key={i} className="flex gap-2 text-xs text-text-secondary">
            <span className="text-primary font-mono shrink-0">{i + 1}.</span>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <H2>Contract API</H2>
      <Code>{`deposit(uint256 amount)                        // Anyone
coverShortfall(uint256 positionId, uint256 amount) // Only PositionManager
getBalance() → uint256
getFundHealth() → (balance, totalCovered, totalDeposited)`}</Code>

      <H2>Security</H2>
      <ul className="list-disc list-inside mb-4">
        <Li><InlineCode>coverShortfall</InlineCode> restricted to PositionManager via <InlineCode>onlyPositionManager</InlineCode></Li>
        <Li>ReentrancyGuard on all state-changing functions</Li>
        <Li>SafeERC20 for all token transfers</Li>
      </ul>
    </div>
  )
}

function CollateralPage() {
  return (
    <div>
      <H1>Multi-Collateral Support</H1>
      <P>Accept WETH, WBTC, WAVAX, and other ERC20 tokens as collateral with oracle-based USD valuation and haircuts.</P>

      <H2>Supported Tokens</H2>
      <Table
        headers={['Token', 'Haircut', 'Effective Value']}
        rows={[
          ['USDC', '0%', '100% of market value'],
          ['WETH', '10%', '90% of market value'],
          ['WBTC', '10%', '90% of market value'],
          ['WAVAX', '20%', '80% of market value'],
        ]}
      />

      <H2>Haircut Mechanism</H2>
      <P>Volatile assets are valued at less than their market price as a safety buffer:</P>
      <Code>{`effectiveValue = marketValue * (1 - haircutPercent)

Example: 1 WETH at $2,500 with 10% haircut
= $2,500 * 0.90 = $2,250 effective collateral`}</Code>

      <H2>Contract API</H2>
      <Code>{`// Admin
addCollateralToken(token, priceAsset, decimals, haircutBps)

// Trader
depositCollateral(token, amount)
withdrawCollateral(token, amount)

// View
getCollateralValueUSD(trader) → totalUSD (6 decimals)
getDeposit(trader, token) → (balance, valueUSD)
getSupportedTokens() → address[]`}</Code>

      <H2>CLI</H2>
      <Code>{`npx tsx src/cli.ts collateral deposit WETH 1
npx tsx src/cli.ts collateral withdraw WETH 0.5
npx tsx src/cli.ts collateral status`}</Code>

      <Callout type="info">The CollateralManager is currently standalone. Future versions will integrate directly with the OrderBook for seamless multi-collateral trading.</Callout>
    </div>
  )
}

function CLIPage() {
  return (
    <div>
      <H1>CLI Reference</H1>
      <P>Command-line interface for trading and protocol management.</P>

      <H2>Setup</H2>
      <Code>{`cd keeper
cp .env.example .env   # Add your private key
npm install`}</Code>

      <H2>Commands</H2>
      <Table
        headers={['Command', 'Description']}
        rows={[
          ['markets', 'List all forward markets'],
          ['prices', 'Show live oracle prices for all assets'],
          ['book <marketId>', 'Display order book (bids & asks)'],
          ['positions', 'Show all open positions'],
          ['balance', 'Show wallet USDC/WETH/AVAX balances'],
          ['faucet', 'Mint 10,000 testnet USDC'],
          ['fees', 'Show fee configuration and totals'],
          ['insurance', 'Show insurance fund balance and health'],
          ['vault status', 'Show TLP vault stats'],
          ['vault deposit <amount>', 'Deposit USDC into TLP vault'],
          ['vault withdraw <shares>', 'Request TLP withdrawal'],
          ['vault execute', 'Execute pending withdrawal'],
          ['collateral status', 'Show multi-collateral deposits'],
          ['collateral deposit <token> <amount>', 'Deposit collateral'],
          ['collateral withdraw <token> <amount>', 'Withdraw collateral'],
        ]}
      />

      <H2>Trading</H2>
      <Code>{`# Place limit orders
npx tsx src/cli.ts trade long ETH 5 --price 2500
npx tsx src/cli.ts trade short BTC 1 --price 67000

# Advanced order types
npx tsx src/cli.ts trade long ETH 5 --price 2500 --tif ioc
npx tsx src/cli.ts trade long ETH 5 --price 2500 --tif fok
npx tsx src/cli.ts trade long ETH 2 --price 2400 --tif post-only

# Set TP/SL
npx tsx src/cli.ts tpsl <positionId> --tp 3000 --sl 2200

# Close positions
npx tsx src/cli.ts close <positionId>
npx tsx src/cli.ts close <positionId> --percent 50`}</Code>

      <H2>Keeper Bot</H2>
      <Code>{`# Run the keeper (polls every 5s)
npx tsx src/cli.ts keeper`}</Code>
      <P>The keeper automatically handles TP/SL execution, liquidations, and market settlements.</P>
    </div>
  )
}

function RoadmapPage() {
  return (
    <div>
      <H1>Roadmap</H1>
      <P>Tenor Protocol development roadmap from testnet to mainnet.</P>

      {[
        { phase: '1', title: 'Foundation (Current)', status: 'live', items: ['Core contracts on Fuji', '5 forward markets (ETH, BTC, AVAX + physical)', 'CLOB with automatic matching', 'Chainlink oracle integration', 'TP/SL + liquidation keeper', 'React trading frontend', 'CLI + SDK'] },
        { phase: '2', title: 'Hub Features (Current)', status: 'live', items: ['Fee system: maker/taker, rebates, builder codes', 'Insurance Fund', 'TLP Vault (passive liquidity)', 'Multi-Collateral (WETH, WBTC, WAVAX)', 'Advanced orders (IOC, FOK, POST_ONLY)', 'Audit fixes (inflation attack, access control)'] },
        { phase: '3', title: 'Market Expansion (Q2 2026)', status: 'next', items: ['Forward curve (multiple expiries per asset)', 'Commodity forwards (Gold/XAUUSD, Oil/WTIUSD)', 'FX forwards (EUR/USD, GBP/USD)', 'Interest rate forwards'] },
        { phase: '4', title: 'Unified Trading Account (Q3 2026)', status: 'planned', items: ['Cross-margin portfolio', 'Sub-accounts', 'Unified PnL across all positions', 'Portfolio-level risk management'] },
        { phase: '5', title: 'Advanced Trading (Q1 2027)', status: 'planned', items: ['Agent/bot trading SDK', 'Grid trading, DCA strategies', 'Batch operations', 'Conditional orders', 'API rate limits + WebSocket feeds'] },
        { phase: '6', title: 'Mainnet & Beyond (Q3 2027)', status: 'planned', items: ['Security audit', 'Avalanche C-Chain mainnet deployment', 'Real Chainlink feeds', 'Governance token', 'DAO treasury'] },
      ].map(phase => (
        <div key={phase.phase} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
              phase.status === 'live' ? 'bg-success/20 text-success' : phase.status === 'next' ? 'bg-primary/20 text-primary' : 'bg-surface-2 text-text-secondary'
            )}>{phase.phase}</div>
            <h3 className="text-sm font-semibold text-text">{phase.title}</h3>
            {phase.status === 'live' && <span className="text-[9px] px-1.5 py-0.5 bg-success/20 text-success rounded-full font-medium">LIVE</span>}
            {phase.status === 'next' && <span className="text-[9px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full font-medium">NEXT</span>}
          </div>
          <ul className="list-disc list-inside ml-8">
            {phase.items.map((item, i) => <Li key={i}>{item}</Li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ─── Page router ─────────────────────────────────────────────────────
function PageContent({ pageId }: { pageId: string }) {
  switch (pageId) {
    case 'overview': return <OverviewPage />
    case 'architecture': return <ArchitecturePage />
    case 'contracts': return <ContractsPage />
    case 'matching': return <MatchingPage />
    case 'orders': return <OrdersPage />
    case 'tpsl': return <TPSLPage />
    case 'settlement': return <SettlementPage />
    case 'fees': return <FeesPage />
    case 'vault': return <VaultPage />
    case 'insurance': return <InsurancePage />
    case 'collateral': return <CollateralPage />
    case 'cli': return <CLIPage />
    case 'roadmap': return <RoadmapPage />
    default: return <OverviewPage />
  }
}

// ─── Main Docs page ──────────────────────────────────────────────────
export function Docs() {
  const [activePage, setActivePage] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const currentIdx = allPages.findIndex(p => p.id === activePage)
  const prevPage = currentIdx > 0 ? allPages[currentIdx - 1] : null
  const nextPage = currentIdx < allPages.length - 1 ? allPages[currentIdx + 1] : null

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className={cn(
        'border-r border-border bg-surface shrink-0 overflow-y-auto no-scrollbar transition-all',
        sidebarOpen ? 'w-60' : 'w-0 border-r-0'
      )}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center font-bold text-white text-[10px]">T</div>
            <span className="text-sm font-bold text-text">Tenor Docs</span>
          </div>
          <div className="text-[10px] text-text-secondary mt-1">v7 — Avalanche Fuji</div>
        </div>

        <nav className="p-3 space-y-4">
          {sections.map(section => (
            <div key={section.label}>
              <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider px-2 mb-1.5">{section.label}</div>
              <div className="space-y-0.5">
                {section.pages.map(page => (
                  <button
                    key={page.id}
                    onClick={() => setActivePage(page.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors text-left cursor-pointer',
                      activePage === page.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-text-secondary hover:text-text hover:bg-surface-2'
                    )}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={page.icon} />
                    </svg>
                    {page.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-border mt-4">
          <a
            href="https://github.com/skar8848/ndf_dex"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-2 py-1.5 text-xs text-text-secondary hover:text-text no-underline transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-2 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="text-xs text-text-secondary">
            {sections.find(s => s.pages.some(p => p.id === activePage))?.label}
            <span className="mx-1.5 text-border">/</span>
            <span className="text-text">{allPages.find(p => p.id === activePage)?.title}</span>
          </div>
        </div>

        {/* Page content */}
        <div className="max-w-3xl mx-auto px-8 py-8">
          <PageContent pageId={activePage} />

          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between mt-12 pt-6 border-t border-border">
            {prevPage ? (
              <button
                onClick={() => setActivePage(prevPage.id)}
                className="flex items-center gap-2 text-xs text-text-secondary hover:text-primary transition-colors cursor-pointer group"
              >
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <div className="text-left">
                  <div className="text-[10px] text-text-secondary">Previous</div>
                  <div className="text-sm text-text font-medium">{prevPage.title}</div>
                </div>
              </button>
            ) : <div />}
            {nextPage ? (
              <button
                onClick={() => setActivePage(nextPage.id)}
                className="flex items-center gap-2 text-xs text-text-secondary hover:text-primary transition-colors cursor-pointer group"
              >
                <div className="text-right">
                  <div className="text-[10px] text-text-secondary">Next</div>
                  <div className="text-sm text-text font-medium">{nextPage.title}</div>
                </div>
                <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : <div />}
          </div>
        </div>
      </main>
    </div>
  )
}
