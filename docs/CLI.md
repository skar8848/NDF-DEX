# Tenor DEX CLI Reference

Command-line interface for interacting with Tenor Protocol on Avalanche Fuji testnet.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/ndf_dex.git
cd ndf_dex/keeper

# Install dependencies
npm install
```

## Environment Variables

Create a `.env` file in the `keeper/` directory:

```env
# Required — your wallet private key (with 0x prefix)
KEEPER_PRIVATE_KEY=0xabc123...

# Optional — defaults shown
RPC_URL=https://avalanche-fuji-c-chain-rpc.publicnode.com
POSITION_MANAGER=0xAB6b565384773C70da8D9e254aFB4B59d710eaD7
FORWARD_MARKET=0x281dc4C64D2BF3508bA2670897f321a31F5e1e65
MOCK_ORACLE=0x23196688CDc03348d712BBc2E74CeA4Eea1e60EB
ORDER_BOOK=0x74AeE1AdBcE40B984beA4B09deAf581c6139cbC9
MOCK_USDC=0xA41BCF380ff358c849619538fda0Dd38214E019d
POLL_INTERVAL_MS=5000
```

## Running the CLI

```bash
# Using npm script
npm run cli -- <command> [options]

# Using npx directly
npx tsx src/cli.ts <command> [options]
```

---

## Commands

### `markets` -- List all forward markets

Displays every market on the protocol: pair, expiration, LTV, liquidation threshold, open interest, and settlement status.

```bash
tenor markets
```

**Example output:**

```
  ID  Pair              Expiration            LTV    Liq%   Long OI      Short OI     Settled
  ────────────────────────────────────────────────────────────────────────────────────────
   0  ETH/USD           3/15/2026, 12:00 AM   50.00% 80.00%    1,250.00    1,100.00     NO
   1  BTC/USD           6/30/2026, 12:00 AM   50.00% 80.00%      500.00      450.00     NO
```

---

### `prices` -- Oracle prices

Fetches the current oracle price for each unique base asset across all markets.

```bash
tenor prices
```

**Example output:**

```
  Asset        Price
  ──────────────────────────────
  ETH         $2,534.50
  BTC         $64,120.00
```

---

### `positions` -- List all open positions

Shows every open position on the protocol (all traders).

```bash
tenor positions
```

#### `positions --mine` -- My open positions

Filters to show only positions owned by the wallet specified in `KEEPER_PRIVATE_KEY`.

```bash
tenor positions --mine
```

**Example output:**

```
  My open positions (0xF4c0...1e42) (2)

  ID    Trader           Market  Side    Entry Price    Size         Collateral   Opened
  ────────────────────────────────────────────────────────────────────────────────────────
     1  0xF4c0..1e42        0  LONG     $2,500.00           5    $2,500.00   2/20/2026, 3:15 PM
     2  0xF4c0..1e42        0  SHORT    $2,600.00           3    $1,560.00   2/21/2026, 10:30 AM
```

---

### `position <id>` -- Position details

Shows full details for a single position including health factor and TP/SL levels.

```bash
tenor position 1
```

**Example output:**

```
  Position #1
  ────────────────────────────────────────
  Market:       ETH/USD
  Trader:       0xF4c09A9121dd457E3947Aa8971AB37ef35e920C2
  Side:         LONG
  Entry Price:  $2,500.00
  Size:         5 contracts
  Collateral:   $2,500.00
  Health:       156.30%
  Take Profit:  $3,000.00
  Stop Loss:    $2,000.00
  Open:         Yes
  Opened:       2/20/2026, 3:15:00 PM
```

---

### `trade <long|short> <asset> <amount>` -- Place an order

Place a limit or market order.

#### Limit order

Specify a price with `--price`:

```bash
tenor trade long ETH 5 --price 2500
```

This places a LONG limit order for 5 ETH contracts at $2,500.

#### Market order

Use `--market` to execute at the best available price:

```bash
tenor trade short ETH 3 --market
```

This places a SHORT market order for 3 ETH contracts.

**Flags:**

| Flag | Description |
|------|-------------|
| `--price <price>` | Limit order at the specified price |
| `--market` | Market order (execute immediately) |

**Notes:**
- You must specify exactly one of `--price` or `--market`.
- The CLI automatically estimates collateral and approves USDC spending before placing the order.
- `<amount>` is the number of contracts, not a USDC dollar amount.

---

### `close <id>` -- Close a position

Close an open position completely.

```bash
tenor close 1
```

#### Partial close

Close a percentage of the position with `--percent`:

```bash
tenor close 1 --percent 50
```

This closes 50% of position #1 (half the contracts).

**Flags:**

| Flag | Description |
|------|-------------|
| `--percent <1-100>` | Close only a percentage of the position |

---

### `tpsl <id>` -- Set take-profit / stop-loss

Configure TP and/or SL levels for an open position.

```bash
tenor tpsl 1 --tp 3000 --sl 2000
```

You can set only one:

```bash
# Take-profit only
tenor tpsl 1 --tp 3000

# Stop-loss only
tenor tpsl 1 --sl 2000
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--tp <price>` | Take-profit price (position auto-closes when reached) |
| `--sl <price>` | Stop-loss price (position auto-closes when reached) |

**Notes:**
- At least one of `--tp` or `--sl` must be specified.
- The keeper bot monitors these levels and triggers the close when the oracle price crosses them.
- For LONG positions: TP triggers when price >= tp, SL triggers when price <= sl.
- For SHORT positions: TP triggers when price <= tp, SL triggers when price >= sl.

---

### `faucet` -- Mint test USDC

Mint 10,000 test USDC to your wallet. Testnet only.

```bash
tenor faucet
```

**Example output:**

```
  Minting 10,000 USDC to 0xF4c09A9121dd457E3947Aa8971AB37ef35e920C2...
  tx: 0xabc123...
  Confirmed in block 12345678
  New balance: $10,000.00
```

---

### `balance` -- Wallet balances

Shows your USDC and AVAX balances.

```bash
tenor balance
```

**Example output:**

```
  Wallet: 0xF4c09A9121dd457E3947Aa8971AB37ef35e920C2
  ──────────────────────────────────────────────────
  USDC:   $10,000.00
  AVAX:   1.5000
```

---

### `keeper` -- Run the keeper bot

Starts the automated keeper service that continuously monitors positions for:
- **TP/SL triggers** -- closes positions when price hits take-profit or stop-loss
- **Liquidations** -- liquidates undercollateralized positions (health < 100%)
- **Settlements** -- settles expired markets and their positions

```bash
tenor keeper
```

The keeper polls every `POLL_INTERVAL_MS` milliseconds (default: 5000ms = 5 seconds).

Press `Ctrl+C` to stop.

---

## Example Workflows

### Complete trading flow

```bash
# 1. Get some test USDC
npm run cli -- faucet

# 2. Check your balance
npm run cli -- balance

# 3. See available markets
npm run cli -- markets

# 4. Check the current price
npm run cli -- prices

# 5. Place a long limit order on ETH at $2,500
npm run cli -- trade long ETH 5 --price 2500

# 6. Check your positions
npm run cli -- positions --mine

# 7. Set TP/SL on position #1
npm run cli -- tpsl 1 --tp 3000 --sl 2000

# 8. View position details
npm run cli -- position 1

# 9. Close 50% of the position
npm run cli -- close 1 --percent 50

# 10. Close the remaining position entirely
npm run cli -- close 1
```

### Running the keeper bot

```bash
# Make sure KEEPER_PRIVATE_KEY is set in .env
# The keeper needs AVAX for gas
npm run cli -- keeper
```

The keeper will log its activity:

```
[INFO][MONITOR] Fetched 3 open positions
[INFO][PRICE] ETH = $2,534.50
[INFO][TPSL] TP triggered for position #1 (LONG ETH) @ $3001.23
[SUCCESS][TPSL] Position #1 closed (TP) — tx: 0xabc...
[INFO][LIQ] Position #5 unhealthy (health=8500) — liquidating...
[SUCCESS][LIQ] Position #5 liquidated — tx: 0xdef...
```

---

## Contract Addresses (v4 Fuji)

| Contract | Address |
|----------|---------|
| MockUSDC | `0xA41BCF380ff358c849619538fda0Dd38214E019d` |
| MockWETH | `0xC2DFD7581C9D27ac195C3873f12b93e7eCd4B24c` |
| Oracle | `0x23196688CDc03348d712BBc2E74CeA4Eea1e60EB` |
| ForwardMarket | `0x281dc4C64D2BF3508bA2670897f321a31F5e1e65` |
| OrderBook | `0x74AeE1AdBcE40B984beA4B09deAf581c6139cbC9` |
| PositionManager | `0xAB6b565384773C70da8D9e254aFB4B59d710eaD7` |

**Chain:** Avalanche Fuji (Chain ID: 43113)
**RPC:** `https://api.avax-test.network/ext/bc/C/rpc`
**Explorer:** https://testnet.snowtrace.io
