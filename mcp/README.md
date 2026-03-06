# Tenor MCP Server

MCP server for the **Tenor NDF-DEX** protocol on Avalanche Fuji. Lets AI agents (Claude, Cursor) read market data, order books, positions, and execute trades directly on-chain.

## Setup

```bash
cd mcp
python3 -m venv .venv
.venv/bin/pip install -e .
```

## Usage

### With Claude Code

Add to your Claude Code MCP settings (`.claude.json` or via `/mcp`):

```json
{
  "mcpServers": {
    "tenor": {
      "command": "/Users/albanderouin/NDF-DEX/mcp/.venv/bin/tenor-mcp"
    }
  }
}
```

For write operations (placing orders, etc.), set the private key:

```json
{
  "mcpServers": {
    "tenor": {
      "command": "/Users/albanderouin/NDF-DEX/mcp/.venv/bin/tenor-mcp",
      "env": {
        "TENOR_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### With Cursor

Add to Cursor MCP settings:

```json
{
  "tenor": {
    "command": "/Users/albanderouin/NDF-DEX/mcp/.venv/bin/tenor-mcp"
  }
}
```

### Standalone

```bash
.venv/bin/tenor-mcp
```

## Tools (20)

### Read-only (no key needed)
| Tool | Description |
|------|-------------|
| `get_active_markets` | List all trading markets |
| `get_market_info` | Market details by ID |
| `get_oracle_price` | Current price for ETH, BTC, AVAX |
| `get_order_book` | Full order book (bids/asks) |
| `get_order` | Single order details |
| `get_user_orders` | All orders for a wallet |
| `get_user_positions` | Open positions for a wallet |
| `get_position` | Single position details |
| `get_health_factor` | Position health (liquidation risk) |
| `get_tpsl` | TP/SL levels for a position |
| `get_usdc_balance` | USDC balance of a wallet |
| `get_usdc_allowance` | USDC approval amount |
| `get_fee_config` | Fee structure |

### Write (requires TENOR_PRIVATE_KEY)
| Tool | Description |
|------|-------------|
| `place_limit_order` | Place a limit order |
| `place_market_order` | Place a market order |
| `cancel_order` | Cancel an open order |
| `close_position` | Close a position |
| `set_tpsl` | Set take-profit / stop-loss |
| `add_collateral` | Add collateral to a position |
| `approve_usdc` | Approve USDC for trading |

## Requirements

- Python 3.10+
- [Foundry](https://book.getfoundry.sh/) (`cast` CLI)
