<p align="center">
  <img src="https://img.shields.io/badge/Avalanche-E84142?style=for-the-badge&logo=avalanche&logoColor=white" />
  <img src="https://img.shields.io/badge/Solidity-363636?style=for-the-badge&logo=solidity&logoColor=white" />
  <img src="https://img.shields.io/badge/Chainlink-375BD2?style=for-the-badge&logo=chainlink&logoColor=white" />
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
</p>

<h1 align="center">NDF-DEX</h1>
<p align="center"><strong>The First On-Chain Non-Deliverable Forward Exchange on Avalanche</strong></p>

<p align="center">
  Trade crypto forward contracts with on-chain order matching, Chainlink oracle settlement, and zero counterparty risk.
</p>

---

## What is NDF-DEX?

**NDF-DEX** brings Non-Deliverable Forwards (NDFs) — a $7 trillion/day traditional finance instrument — to DeFi for the first time on Avalanche.

A Non-Deliverable Forward is a cash-settled contract where two parties agree on a future price for an asset. At expiration, instead of delivering the asset, the contract settles the **price difference** in USDC. No physical delivery, pure price exposure.

```
Example: ETH/USDC 30-day Forward

Alice goes LONG  at $2,500 (5 contracts)  →  deposits $3,125 USDC collateral
Bob   goes SHORT at $2,500 (5 contracts)  →  deposits $3,125 USDC collateral

30 days later, ETH settles at $2,800 (via Chainlink oracle):

Alice PnL: ($2,800 - $2,500) × 5 = +$1,500  →  receives $4,625
Bob   PnL: ($2,500 - $2,800) × 5 = -$1,500  →  receives $1,625
```

## Why This Matters

| TradFi NDFs | NDF-DEX |
|---|---|
| $7T daily volume, banks only | Permissionless, anyone can trade |
| Bilateral, counterparty risk | Smart contract escrow, zero default risk |
| T+2 settlement, manual | Instant settlement via Chainlink oracle |
| Opaque OTC market | Transparent on-chain order book |
| Minimum $1M notional | Trade any size |

## Key Features

- **On-Chain Order Book** — Full limit order book with price-time priority matching engine, partial fills, and market orders
- **Chainlink Oracle Settlement** — Real-time price feeds (ETH/USD, BTC/USD, AVAX/USD) for trustless settlement at expiry
- **Collateralized Positions** — All positions backed by USDC with configurable LTV ratios
- **Liquidation Engine** — Under-collateralized positions can be liquidated with 5% bonus to liquidators
- **Cash Settlement** — Automatic PnL calculation and USDC distribution at market expiry
- **Permissionless Markets** — Anyone can create new forward markets for any asset pair

## Architecture

```
ndf_dex/
├── contracts/                # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── core/
│   │   │   ├── ForwardMarket.sol       # Market creation, settlement, OI tracking
│   │   │   ├── OrderBook.sol           # On-chain CLOB with matching engine
│   │   │   └── PositionManager.sol     # Positions, collateral, liquidation
│   │   ├── oracle/
│   │   │   ├── ChainlinkOracle.sol     # Live Chainlink price feeds (Fuji)
│   │   │   └── MockOracle.sol          # Mock oracle for testing
│   │   ├── tokens/
│   │   │   ├── MockUSDC.sol            # ERC20 mock USDC (faucet enabled)
│   │   │   └── MockWETH.sol            # ERC20 mock WETH
│   │   ├── libraries/
│   │   │   ├── MathLib.sol             # PnL, health factor, collateral math
│   │   │   └── OrderLib.sol            # Data structures & enums
│   │   └── interfaces/                 # Contract interfaces
│   ├── script/
│   │   └── Deploy.s.sol                # Automated Fuji deployment
│   └── test/                           # 20 unit & integration tests
│       ├── ForwardMarket.t.sol         # 8 tests
│       ├── OrderBook.t.sol             # 7 tests
│       └── Settlement.t.sol            # 5 tests
└── frontend/                 # React trading interface
    └── src/
        ├── pages/            # Landing, Trade, Markets, Portfolio
        ├── components/       # Trading UI, order book, charts, landing
        ├── hooks/            # wagmi contract hooks with toast notifications
        ├── providers/        # Web3 (wagmi + RainbowKit + Fuji)
        └── lib/              # ABIs, config, utilities
```

## Smart Contracts

| Contract | Description |
|---|---|
| **ForwardMarket** | Creates and manages forward markets with configurable LTV, liquidation threshold, and expiration. Settlement triggers via Chainlink oracle price. |
| **OrderBook** | Full on-chain Central Limit Order Book (CLOB) with automatic matching engine. Supports limit orders, market orders, partial fills, and cancellations. |
| **PositionManager** | Manages open positions, collateral deposits/withdrawals, liquidation with 5% bonus, and cash settlement at expiry. |
| **ChainlinkOracle** | Production oracle reading live Chainlink price feeds on Fuji (ETH/USD, BTC/USD, AVAX/USD). Normalizes all feeds to 8 decimals. Falls back to manual prices for unsupported assets. |
| **MockUSDC** | ERC20 mock USDC (6 decimals) with public faucet — mint 10,000 USDC per call for testing. |

### Order Matching Engine

The OrderBook implements a price-time priority CLOB:

```
New LONG limit order at $2,500 arrives:
  1. Scan SHORT orders (asks) from lowest price up
  2. If ask price ≤ $2,500 → MATCH
     - Transfer collateral from both sides
     - Create positions via PositionManager
     - Update order fill status
  3. Remaining unfilled amount → rest in order book
  4. Supports partial fills (order can match with multiple counterparties)
```

### Settlement & PnL

```solidity
// Long PnL  = (settlePrice - entryPrice) × size × COLLATERAL_PRECISION / PRICE_PRECISION
// Short PnL = (entryPrice - settlePrice) × size × COLLATERAL_PRECISION / PRICE_PRECISION

// Health Factor = (collateral × liquidationThreshold) / (maintenanceMargin × PERCENT_BASE)
// If healthFactor < 1.0 → position is liquidatable (5% bonus to liquidator)
```

### Chainlink Integration

```solidity
// Fuji Testnet Price Feeds
ETH/USD  → 0x86d67c3D38D2bCeE722E601025C25a575021c6EA
BTC/USD  → 0x31CF013A08c6Ac228C94551d535d5BAfE19c602a
AVAX/USD → 0x5498BB86BC934c8D34FDA08E81D444153d0D06aD
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Smart Contracts** | Solidity 0.8.24, Foundry, OpenZeppelin |
| **Oracle** | Chainlink AggregatorV3 (live Fuji feeds) |
| **Frontend** | React 18, Vite, TypeScript |
| **Styling** | Tailwind CSS v4, Framer Motion |
| **Web3** | wagmi v2, viem, RainbowKit |
| **Notifications** | Sonner (toast notifications for all tx) |
| **Charts** | TradingView Lightweight Charts |
| **Target Chain** | Avalanche Fuji Testnet (Chain ID 43113) |

## Deployed Contracts (Avalanche Fuji)

All contracts are **live and verified** on Avalanche Fuji Testnet:

| Contract | Address | SnowTrace |
|---|---|---|
| **MockUSDC** | `0x47f5a33714a84178F83f65Be6ecBcB79ACe6ef44` | [View](https://testnet.snowtrace.io/address/0x47f5a33714a84178F83f65Be6ecBcB79ACe6ef44) |
| **MockWETH** | `0x06618AE2Ca9a684431e20A4be056a74A9Dc25A10` | [View](https://testnet.snowtrace.io/address/0x06618AE2Ca9a684431e20A4be056a74A9Dc25A10) |
| **MockOracle** | `0x05B2512B64E43b44d94a6241d3745d5965c700d9` | [View](https://testnet.snowtrace.io/address/0x05B2512B64E43b44d94a6241d3745d5965c700d9) |
| **ForwardMarket** | `0x9BB9CD8a6Caeaa06cBdB35FAc37D88C3b7b3DfC2` | [View](https://testnet.snowtrace.io/address/0x9BB9CD8a6Caeaa06cBdB35FAc37D88C3b7b3DfC2) |
| **OrderBook** | `0xc6727c3cF00e374d72B1348173E4308083BC97e2` | [View](https://testnet.snowtrace.io/address/0xc6727c3cF00e374d72B1348173E4308083BC97e2) |
| **PositionManager** | `0xBDb0b90825b4d5f8dA0A9D54fb2E72EA02618C56` | [View](https://testnet.snowtrace.io/address/0xBDb0b90825b4d5f8dA0A9D54fb2E72EA02618C56) |

**Initial Markets:**
- Market #1: ETH/USDC Forward (30-day expiry)
- Market #2: BTC/USDC Forward (30-day expiry)
- Market #3: AVAX/USDC Forward (7-day expiry)

## Getting Started

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- MetaMask or compatible wallet with [Fuji AVAX](https://faucet.avax.network/)

### Smart Contracts

```bash
cd contracts

# Install dependencies
forge install

# Run all 20 tests
forge test -vvv

# Deploy to Fuji (with MockOracle)
forge script script/Deploy.s.sol --rpc-url https://api.avax-test.network/ext/bc/C/rpc --broadcast --private-key $PRIVATE_KEY

# Deploy to Fuji (with Chainlink Oracle)
USE_CHAINLINK=true forge script script/Deploy.s.sol --rpc-url https://api.avax-test.network/ext/bc/C/rpc --broadcast --private-key $PRIVATE_KEY
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build
```

## Testing

```bash
cd contracts && forge test -vvv
```

**20 tests** covering:

| Suite | Tests | Coverage |
|---|---|---|
| ForwardMarket | 8 | Market creation, settlement, reverts, active market filtering |
| OrderBook | 7 | Limit orders, matching, partial fills, cancellation, price crossing |
| Settlement | 5 | Long/short profit, liquidation, collateral management, settlement guards |

## How It Works (E2E Flow)

```
1. Connect Wallet     → MetaMask on Avalanche Fuji
2. Get Test USDC      → Click "Faucet 10k USDC" in header
3. Approve USDC       → One-time approval for OrderBook contract
4. Choose Market      → ETH/USDC, BTC/USDC, or AVAX/USDC forward
5. Place Order        → Limit or market order, long or short
6. Automatic Match    → When prices cross, orders match on-chain
7. Monitor Position   → Track PnL, health factor in Portfolio
8. Settlement         → At expiry, oracle settles all positions in USDC
```

## Innovation & Differentiators

1. **First NDF protocol on Avalanche** — Bringing a $7T/day TradFi instrument to DeFi
2. **Fully on-chain CLOB** — No off-chain components, everything verifiable on Avalanche
3. **Chainlink-powered settlement** — Trustless price discovery at expiry
4. **Permissionless market creation** — Anyone can create forwards for any asset pair
5. **Production-ready math** — Precise 8-decimal price and 6-decimal collateral arithmetic throughout

## License

MIT
