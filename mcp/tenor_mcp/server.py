"""Tenor MCP Server — AI-native interface to the NDF-DEX protocol on Avalanche."""

import json
from mcp.server.fastmcp import FastMCP
from . import contracts
from .config import CONTRACTS, COLLATERAL_TOKENS, PRICE_PRECISION, COLLATERAL_PRECISION

mcp = FastMCP(
    "Tenor DEX",
    instructions="Tenor is a Non-Deliverable Forward (NDF) DEX on Avalanche. "
    "Use these tools to read market data, order books, positions, and execute trades. "
    "Prices have 8 decimals (divide by 1e8). USDC amounts have 6 decimals (divide by 1e6). "
    "Side: 0 = LONG, 1 = SHORT. TimeInForce: 0 = GTC, 1 = IOC, 2 = FOK, 3 = POST_ONLY.",
)


# ---------------------------------------------------------------------------
# Market data
# ---------------------------------------------------------------------------

@mcp.tool()
async def get_active_markets() -> str:
    """List all active trading markets on Tenor (pairs, LTV, open interest, etc.)."""
    markets = await contracts.get_active_markets()
    if not markets:
        return "No active markets found."
    lines = []
    for m in markets:
        lines.append(
            f"Market #{m['id']}: {m['baseAsset']}/{m['quoteAsset']} | "
            f"LTV: {m['ltv_bps'] / 100:.0f}% | "
            f"Long OI: {m['total_long_oi']} | Short OI: {m['total_short_oi']} | "
            f"Settled: {m['settled']}"
        )
    return "\n".join(lines)


@mcp.tool()
async def get_market_info(market_id: int) -> str:
    """Get detailed info for a specific market by ID."""
    m = await contracts.get_market(market_id)
    if not m:
        return f"Market {market_id} not found."
    return json.dumps(m, indent=2)


@mcp.tool()
async def get_oracle_price(asset: str) -> str:
    """Get the current oracle price for an asset (e.g. 'ETH', 'BTC').

    Args:
        asset: The asset symbol (e.g. 'ETH', 'BTC')
    """
    result = await contracts.get_oracle_price(asset)
    return f"{asset} price: ${result['price']} (raw: {result['price_raw']}, updated: {result['timestamp']})"


# ---------------------------------------------------------------------------
# Order book
# ---------------------------------------------------------------------------

@mcp.tool()
async def get_order_book(market_id: int) -> str:
    """Get the full order book (bids and asks) for a market.

    Args:
        market_id: The market ID (e.g. 1 for ETH/USDC)
    """
    book = await contracts.get_order_book(market_id)
    lines = [f"=== Order Book for Market #{market_id} ===\n"]

    lines.append("ASKS (sells):")
    if book["asks"]:
        for o in reversed(book["asks"]):
            lines.append(f"  ${o['price']} | {o['amount']} contracts | filled: {o['filled']} | {o['status']}")
    else:
        lines.append("  (empty)")

    lines.append("\n--- spread ---\n")

    lines.append("BIDS (buys):")
    if book["bids"]:
        for o in book["bids"]:
            lines.append(f"  ${o['price']} | {o['amount']} contracts | filled: {o['filled']} | {o['status']}")
    else:
        lines.append("  (empty)")

    return "\n".join(lines)


@mcp.tool()
async def get_order(order_id: int) -> str:
    """Get details of a specific order by its ID.

    Args:
        order_id: The order ID
    """
    order = await contracts.get_order(order_id)
    if not order:
        return f"Order {order_id} not found."
    return json.dumps(order, indent=2)


@mcp.tool()
async def get_user_orders(address: str) -> str:
    """Get all orders (open, filled, cancelled) for a wallet address.

    Args:
        address: The wallet address (0x...)
    """
    orders = await contracts.get_user_orders(address)
    if not orders:
        return f"No orders found for {address}."
    lines = [f"Orders for {address}:\n"]
    for o in orders:
        lines.append(
            f"  #{o['id']} | {o['side']} ${o['price']} x{o['amount']} | "
            f"filled: {o['filled']} | {o['status']} | {o['time_in_force']}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Positions
# ---------------------------------------------------------------------------

@mcp.tool()
async def get_user_positions(address: str) -> str:
    """Get all open positions for a wallet address.

    Args:
        address: The wallet address (0x...)
    """
    positions = await contracts.get_user_positions(address)
    if not positions:
        return f"No open positions for {address}."
    lines = [f"Open positions for {address}:\n"]
    for p in positions:
        lines.append(
            f"  #{p['id']} | {p['side']} | entry: ${p['entry_price']} | "
            f"size: {p['size']} | collateral: ${p['collateral']} | open: {p['is_open']}"
        )
    return "\n".join(lines)


@mcp.tool()
async def get_position(position_id: int) -> str:
    """Get details of a specific position.

    Args:
        position_id: The position ID
    """
    pos = await contracts.get_position(position_id)
    if not pos:
        return f"Position {position_id} not found."
    return json.dumps(pos, indent=2)


@mcp.tool()
async def get_health_factor(position_id: int) -> str:
    """Check the health factor of a position. Below 100% = liquidatable.

    Args:
        position_id: The position ID
    """
    hf = await contracts.get_health_factor(position_id)
    status = "LIQUIDATABLE" if hf["liquidatable"] else "HEALTHY"
    return f"Position #{position_id}: health = {hf['health_pct']} ({status})"


@mcp.tool()
async def get_tpsl(position_id: int) -> str:
    """Get take-profit and stop-loss levels for a position.

    Args:
        position_id: The position ID
    """
    tpsl = await contracts.get_tpsl(position_id)
    return f"Position #{position_id}: TP = {tpsl['take_profit']}, SL = {tpsl['stop_loss']}"


# ---------------------------------------------------------------------------
# USDC
# ---------------------------------------------------------------------------

@mcp.tool()
async def get_usdc_balance(address: str) -> str:
    """Get the USDC balance of a wallet.

    Args:
        address: The wallet address (0x...)
    """
    result = await contracts.get_usdc_balance(address)
    return f"USDC balance for {address}: ${result['balance']}"


@mcp.tool()
async def get_usdc_allowance(owner: str, spender: str) -> str:
    """Check how much USDC the owner has approved for a spender contract.

    Args:
        owner: The wallet address that owns the USDC
        spender: The contract address approved to spend (default: OrderBook)
    """
    result = await contracts.get_usdc_allowance(owner, spender)
    return f"Allowance: {owner} → {spender}: ${result['allowance']}"


@mcp.tool()
async def get_fee_config() -> str:
    """Get the current fee configuration of the OrderBook."""
    fees = await contracts.get_fee_config()
    return (
        f"Taker fee: {fees['taker_fee_bps']} bps | Maker fee: {fees['maker_fee_bps']} bps | "
        f"Maker rebate: {fees['maker_rebate_enabled']} | "
        f"Protocol: {fees['protocol_fee_bps']} bps | Insurance: {fees['insurance_fee_bps']} bps | LP: {fees['lp_fee_bps']} bps"
    )


# ---------------------------------------------------------------------------
# Trading (write operations — require TENOR_PRIVATE_KEY)
# ---------------------------------------------------------------------------

@mcp.tool()
async def place_limit_order(market_id: int, side: int, price: float, amount: int, token: str = "USDC") -> str:
    """Place a limit order on the order book. Requires TENOR_PRIVATE_KEY env var.

    Args:
        market_id: The market ID (e.g. 1 for ETH/USDC)
        side: 0 for LONG, 1 for SHORT
        price: The limit price in USD (e.g. 2500.00)
        amount: Number of contracts
        token: Collateral token to use: USDC, USDT, or AUSD (default: USDC)
    """
    price_raw = int(price * PRICE_PRECISION)
    side_name = "LONG" if side == 0 else "SHORT"
    token_key = COLLATERAL_TOKENS.get(token.upper(), "MockUSDC")
    token_addr = CONTRACTS.get(token_key, CONTRACTS["MockUSDC"])
    result = await contracts.place_limit_order(market_id, side, price_raw, amount, token_addr)
    return f"Limit order placed: {side_name} {amount} contracts @ ${price:.2f} (collateral: {token.upper()})\n{result['tx']}"


@mcp.tool()
async def place_market_order(market_id: int, side: int, amount: int, token: str = "USDC") -> str:
    """Place a market order. Requires TENOR_PRIVATE_KEY env var.

    Args:
        market_id: The market ID
        side: 0 for LONG, 1 for SHORT
        amount: Number of contracts
        token: Collateral token to use: USDC, USDT, or AUSD (default: USDC)
    """
    side_name = "LONG" if side == 0 else "SHORT"
    token_key = COLLATERAL_TOKENS.get(token.upper(), "MockUSDC")
    token_addr = CONTRACTS.get(token_key, CONTRACTS["MockUSDC"])
    result = await contracts.place_market_order(market_id, side, amount, token_addr)
    return f"Market order placed: {side_name} {amount} contracts (collateral: {token.upper()})\n{result['tx']}"


@mcp.tool()
async def cancel_order(order_id: int) -> str:
    """Cancel an open order. Requires TENOR_PRIVATE_KEY env var.

    Args:
        order_id: The order ID to cancel
    """
    result = await contracts.cancel_order(order_id)
    return f"Order #{order_id} cancelled.\n{result['tx']}"


@mcp.tool()
async def close_position(position_id: int, close_size: int) -> str:
    """Close a position (fully or partially). Requires TENOR_PRIVATE_KEY env var.

    Args:
        position_id: The position ID
        close_size: Number of contracts to close (use full size for full close)
    """
    result = await contracts.close_position(position_id, close_size)
    return f"Position #{position_id} closed ({close_size} contracts).\n{result['tx']}"


@mcp.tool()
async def set_tpsl(position_id: int, take_profit: float, stop_loss: float) -> str:
    """Set take-profit and/or stop-loss on a position. Use 0 to unset. Requires TENOR_PRIVATE_KEY.

    Args:
        position_id: The position ID
        take_profit: TP price in USD (0 to unset)
        stop_loss: SL price in USD (0 to unset)
    """
    tp_raw = int(take_profit * PRICE_PRECISION) if take_profit > 0 else 0
    sl_raw = int(stop_loss * PRICE_PRECISION) if stop_loss > 0 else 0
    result = await contracts.set_tpsl(position_id, tp_raw, sl_raw)
    tp_str = f"${take_profit:.2f}" if take_profit > 0 else "none"
    sl_str = f"${stop_loss:.2f}" if stop_loss > 0 else "none"
    return f"Position #{position_id}: TP = {tp_str}, SL = {sl_str}\n{result['tx']}"


@mcp.tool()
async def approve_usdc(amount: float) -> str:
    """Approve the OrderBook to spend USDC. Requires TENOR_PRIVATE_KEY.

    Args:
        amount: USDC amount to approve (use 0 to revoke, -1 for unlimited)
    """
    if amount < 0:
        amount_raw = 2**256 - 1  # max uint256
        label = "unlimited"
    else:
        amount_raw = int(amount * COLLATERAL_PRECISION)
        label = f"${amount:.2f}"
    result = await contracts.approve_usdc(CONTRACTS["OrderBook"], amount_raw)
    return f"USDC approval set to {label} for OrderBook.\n{result['tx']}"


@mcp.tool()
async def add_collateral(position_id: int, amount: float) -> str:
    """Add USDC collateral to a position. Requires TENOR_PRIVATE_KEY.

    Args:
        position_id: The position ID
        amount: USDC amount to add
    """
    amount_raw = int(amount * COLLATERAL_PRECISION)
    result = await contracts.add_collateral(position_id, amount_raw)
    return f"Added ${amount:.2f} collateral to position #{position_id}.\n{result['tx']}"


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main():
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
