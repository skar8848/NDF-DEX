"""Contract interaction layer using Foundry's `cast` CLI."""

import asyncio
import json
import re
from .config import RPC_URL, CONTRACTS, PRIVATE_KEY, PRICE_PRECISION, COLLATERAL_PRECISION


async def _run_cast(*args: str) -> str:
    """Run a cast command and return stdout."""
    proc = await asyncio.create_subprocess_exec(
        "cast", *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"cast failed: {stderr.decode().strip()}")
    return stdout.decode().strip()


async def cast_call(contract: str, sig: str, *args: str) -> str:
    """Read-only call to a contract."""
    return await _run_cast(
        "call", contract, sig, *args,
        "--rpc-url", RPC_URL,
    )


async def cast_send(contract: str, sig: str, *args: str) -> str:
    """Send a transaction to a contract. Requires TENOR_PRIVATE_KEY."""
    if not PRIVATE_KEY:
        raise RuntimeError("TENOR_PRIVATE_KEY not set — cannot send transactions")
    return await _run_cast(
        "send", contract, sig, *args,
        "--rpc-url", RPC_URL,
        "--private-key", PRIVATE_KEY,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def format_price(raw: int) -> str:
    """Convert raw price (8 decimals) to human readable."""
    return f"{raw / PRICE_PRECISION:.2f}"


def format_usdc(raw: int) -> str:
    """Convert raw USDC (6 decimals) to human readable."""
    return f"{raw / COLLATERAL_PRECISION:.2f}"


def parse_uint(s: str) -> int:
    """Parse a uint256 from cast output (handles '123 [1.23e2]' format)."""
    s = s.strip()
    if s.startswith("0x"):
        return int(s, 16)
    # cast often appends " [1.23e10]" scientific notation — strip it
    if " [" in s:
        s = s.split(" [")[0]
    return int(s)


def parse_tuple_values(raw: str) -> list[str]:
    """Parse multi-line cast output into individual values."""
    return [line.strip() for line in raw.strip().splitlines() if line.strip()]


def strip_sci(s: str) -> str:
    """Strip cast's scientific notation suffix: '123 [1.23e2]' → '123'."""
    s = s.strip()
    if " [" in s:
        s = s.split(" [")[0]
    return s


# ---------------------------------------------------------------------------
# Oracle
# ---------------------------------------------------------------------------

async def get_oracle_price(asset: str) -> dict:
    raw = await cast_call(CONTRACTS["MockOracle"], "getPrice(string)(uint256,uint256)", asset)
    vals = parse_tuple_values(raw)
    price_raw = parse_uint(vals[0])
    timestamp = parse_uint(vals[1])
    return {
        "asset": asset,
        "price": format_price(price_raw),
        "price_raw": str(price_raw),
        "timestamp": timestamp,
    }


# ---------------------------------------------------------------------------
# ForwardMarket
# ---------------------------------------------------------------------------

async def get_active_markets() -> list[dict]:
    raw = await cast_call(CONTRACTS["ForwardMarket"], "getActiveMarkets()((uint256,string,string,uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256,uint8,address)[])")
    return _parse_markets(raw)


async def get_market(market_id: int) -> dict:
    raw = await cast_call(CONTRACTS["ForwardMarket"], "getMarket(uint256)((uint256,string,string,uint256,uint256,uint256,uint256,uint256,bool,uint256,uint256,uint8,address))", str(market_id))
    markets = _parse_markets(raw)
    return markets[0] if markets else {}


def _parse_cast_tuples(raw: str) -> list[list[str]]:
    """Parse cast tuple output into lists of field values.

    Handles formats like: (1, "ETH", "USDC", 123 [1.23e2], true, 0x...)
    """
    results = []
    # Find each top-level tuple by matching balanced parentheses
    depth = 0
    start = -1
    for i, ch in enumerate(raw):
        if ch == '(':
            if depth == 0:
                start = i + 1
            depth += 1
        elif ch == ')':
            depth -= 1
            if depth == 0 and start >= 0:
                inner = raw[start:i]
                # Split on commas, respecting quotes
                fields = []
                field_start = 0
                in_quote = False
                in_bracket = 0
                for j, c in enumerate(inner):
                    if c == '"':
                        in_quote = not in_quote
                    elif c == '[':
                        in_bracket += 1
                    elif c == ']':
                        in_bracket -= 1
                    elif c == ',' and not in_quote and in_bracket == 0:
                        fields.append(inner[field_start:j].strip())
                        field_start = j + 1
                fields.append(inner[field_start:].strip())
                results.append(fields)
                start = -1
    return results


def _parse_markets(raw: str) -> list[dict]:
    """Parse market tuples from cast output."""
    tuples = _parse_cast_tuples(raw)
    markets = []
    for t in tuples:
        if len(t) < 12:
            continue
        markets.append({
            "id": int(strip_sci(t[0])),
            "baseAsset": t[1].strip('"'),
            "quoteAsset": t[2].strip('"'),
            "expiration": int(strip_sci(t[3])),
            "ltv_bps": int(strip_sci(t[4])),
            "liquidation_threshold_bps": int(strip_sci(t[5])),
            "min_collateral": format_usdc(int(strip_sci(t[6]))),
            "settle_price": format_price(int(strip_sci(t[7]))),
            "settled": t[8].strip().lower() == "true",
            "total_long_oi": int(strip_sci(t[9])),
            "total_short_oi": int(strip_sci(t[10])),
        })
    return markets


# ---------------------------------------------------------------------------
# OrderBook — reads
# ---------------------------------------------------------------------------

async def get_order_book(market_id: int) -> dict:
    raw = await cast_call(
        CONTRACTS["OrderBook"],
        "getOrderBook(uint256)((uint256,address,uint256,uint8,uint256,uint256,uint256,uint256,uint256,uint8,uint8)[],(uint256,address,uint256,uint8,uint256,uint256,uint256,uint256,uint256,uint8,uint8)[])",
        str(market_id),
    )
    bids, asks = _parse_order_book(raw)
    return {"market_id": market_id, "bids": bids, "asks": asks}


async def get_order(order_id: int) -> dict:
    raw = await cast_call(
        CONTRACTS["OrderBook"],
        "getOrder(uint256)((uint256,address,uint256,uint8,uint256,uint256,uint256,uint256,uint256,uint8,uint8))",
        str(order_id),
    )
    orders = _parse_orders(raw)
    return orders[0] if orders else {}


async def get_user_orders(address: str) -> list[dict]:
    raw = await cast_call(
        CONTRACTS["OrderBook"],
        "getUserOrders(address)((uint256,address,uint256,uint8,uint256,uint256,uint256,uint256,uint256,uint8,uint8)[])",
        address,
    )
    return _parse_orders(raw)


async def get_fee_config() -> dict:
    raw = await cast_call(CONTRACTS["OrderBook"], "getFeeConfig()(uint256,uint256,bool,uint256,uint256,uint256)")
    vals = parse_tuple_values(raw)
    return {
        "taker_fee_bps": parse_uint(vals[0]),
        "maker_fee_bps": parse_uint(vals[1]),
        "maker_rebate_enabled": vals[2].lower() == "true",
        "protocol_fee_bps": parse_uint(vals[3]),
        "insurance_fee_bps": parse_uint(vals[4]),
        "lp_fee_bps": parse_uint(vals[5]),
    }


SIDE_NAMES = {0: "LONG", 1: "SHORT"}
STATUS_NAMES = {0: "OPEN", 1: "FILLED", 2: "PARTIALLY_FILLED", 3: "CANCELLED"}
TIF_NAMES = {0: "GTC", 1: "IOC", 2: "FOK", 3: "POST_ONLY"}


def _parse_orders(raw: str) -> list[dict]:
    tuples = _parse_cast_tuples(raw)
    orders = []
    for t in tuples:
        if len(t) < 11:
            continue
        side = int(strip_sci(t[3]))
        status = int(strip_sci(t[9]))
        tif = int(strip_sci(t[10]))
        orders.append({
            "id": int(strip_sci(t[0])),
            "trader": t[1].strip(),
            "market_id": int(strip_sci(t[2])),
            "side": SIDE_NAMES.get(side, str(side)),
            "price": format_price(int(strip_sci(t[4]))),
            "price_raw": strip_sci(t[4]),
            "amount": int(strip_sci(t[5])),
            "filled": int(strip_sci(t[6])),
            "collateral": format_usdc(int(strip_sci(t[7]))),
            "timestamp": int(strip_sci(t[8])),
            "status": STATUS_NAMES.get(status, str(status)),
            "time_in_force": TIF_NAMES.get(tif, str(tif)),
        })
    return orders


def _parse_order_book(raw: str) -> tuple[list[dict], list[dict]]:
    """Parse getOrderBook output into bids and asks lists."""
    # The output has two arrays: [bids], [asks]
    # Split on '], [' to separate them
    all_orders = _parse_orders(raw)
    # cast outputs bids first, then asks — split by detecting the boundary
    # We'll use a heuristic: bids and asks are returned in order
    # Actually, let's just return all parsed and let the caller know
    # The raw output format from cast for tuple arrays is complex
    # A simpler approach: split the raw output at the array boundary
    bracket_depth = 0
    split_idx = -1
    for i, ch in enumerate(raw):
        if ch == '[':
            bracket_depth += 1
        elif ch == ']':
            bracket_depth -= 1
            if bracket_depth == 0:
                split_idx = i
                break

    if split_idx > 0:
        bids_raw = raw[:split_idx + 1]
        asks_raw = raw[split_idx + 1:]
        return _parse_orders(bids_raw), _parse_orders(asks_raw)

    return all_orders, []


# ---------------------------------------------------------------------------
# PositionManager — reads
# ---------------------------------------------------------------------------

async def get_user_positions(address: str) -> list[dict]:
    raw = await cast_call(
        CONTRACTS["PositionManager"],
        "getUserOpenPositions(address)((uint256,address,uint256,uint8,uint256,uint256,uint256,uint256,bool)[])",
        address,
    )
    return _parse_positions(raw)


async def get_position(position_id: int) -> dict:
    raw = await cast_call(
        CONTRACTS["PositionManager"],
        "getPosition(uint256)((uint256,address,uint256,uint8,uint256,uint256,uint256,uint256,bool))",
        str(position_id),
    )
    positions = _parse_positions(raw)
    return positions[0] if positions else {}


async def get_health_factor(position_id: int) -> dict:
    raw = await cast_call(
        CONTRACTS["PositionManager"],
        "getHealthFactor(uint256)(uint256)",
        str(position_id),
    )
    hf = parse_uint(raw)
    return {
        "position_id": position_id,
        "health_factor": hf,
        "health_pct": f"{hf / 100:.2f}%",
        "liquidatable": hf < 10000,
    }


async def get_tpsl(position_id: int) -> dict:
    raw = await cast_call(
        CONTRACTS["PositionManager"],
        "getTPSL(uint256)((uint256,uint256))",
        str(position_id),
    )
    vals = re.findall(r'\d+', raw)
    tp = int(vals[0]) if len(vals) > 0 else 0
    sl = int(vals[1]) if len(vals) > 1 else 0
    return {
        "position_id": position_id,
        "take_profit": format_price(tp) if tp > 0 else "not set",
        "stop_loss": format_price(sl) if sl > 0 else "not set",
    }


def _parse_positions(raw: str) -> list[dict]:
    tuples = _parse_cast_tuples(raw)
    positions = []
    for t in tuples:
        if len(t) < 9:
            continue
        side = int(strip_sci(t[3]))
        positions.append({
            "id": int(strip_sci(t[0])),
            "trader": t[1].strip(),
            "market_id": int(strip_sci(t[2])),
            "side": SIDE_NAMES.get(side, str(side)),
            "entry_price": format_price(int(strip_sci(t[4]))),
            "size": int(strip_sci(t[5])),
            "collateral": format_usdc(int(strip_sci(t[6]))),
            "timestamp": int(strip_sci(t[7])),
            "is_open": t[8].strip().lower() == "true",
        })
    return positions


# ---------------------------------------------------------------------------
# USDC reads
# ---------------------------------------------------------------------------

async def get_usdc_balance(address: str) -> dict:
    raw = await cast_call(CONTRACTS["MockUSDC"], "balanceOf(address)(uint256)", address)
    balance = parse_uint(raw)
    return {"address": address, "balance": format_usdc(balance), "balance_raw": str(balance)}


async def get_usdc_allowance(owner: str, spender: str) -> dict:
    raw = await cast_call(CONTRACTS["MockUSDC"], "allowance(address,address)(uint256)", owner, spender)
    allowance = parse_uint(raw)
    return {
        "owner": owner,
        "spender": spender,
        "allowance": format_usdc(allowance),
        "allowance_raw": str(allowance),
    }


# ---------------------------------------------------------------------------
# Write operations (require private key)
# ---------------------------------------------------------------------------

async def approve_usdc(spender: str, amount: int) -> dict:
    result = await cast_send(CONTRACTS["MockUSDC"], "approve(address,uint256)", spender, str(amount))
    return {"status": "success", "tx": result}


async def place_limit_order(market_id: int, side: int, price: int, amount: int) -> dict:
    result = await cast_send(
        CONTRACTS["OrderBook"],
        "placeLimitOrder(uint256,uint8,uint256,uint256)",
        str(market_id), str(side), str(price), str(amount),
    )
    return {"status": "success", "tx": result}


async def place_limit_order_advanced(market_id: int, side: int, price: int, amount: int, tif: int) -> dict:
    result = await cast_send(
        CONTRACTS["OrderBook"],
        "placeLimitOrderAdvanced(uint256,uint8,uint256,uint256,uint8)",
        str(market_id), str(side), str(price), str(amount), str(tif),
    )
    return {"status": "success", "tx": result}


async def place_market_order(market_id: int, side: int, amount: int) -> dict:
    result = await cast_send(
        CONTRACTS["OrderBook"],
        "placeMarketOrder(uint256,uint8,uint256)",
        str(market_id), str(side), str(amount),
    )
    return {"status": "success", "tx": result}


async def cancel_order(order_id: int) -> dict:
    result = await cast_send(
        CONTRACTS["OrderBook"],
        "cancelOrder(uint256)",
        str(order_id),
    )
    return {"status": "success", "tx": result}


async def close_position(position_id: int, close_size: int) -> dict:
    result = await cast_send(
        CONTRACTS["PositionManager"],
        "closePosition(uint256,uint256)",
        str(position_id), str(close_size),
    )
    return {"status": "success", "tx": result}


async def set_tpsl(position_id: int, tp: int, sl: int) -> dict:
    result = await cast_send(
        CONTRACTS["PositionManager"],
        "setTPSL(uint256,uint256,uint256)",
        str(position_id), str(tp), str(sl),
    )
    return {"status": "success", "tx": result}


async def add_collateral(position_id: int, amount: int) -> dict:
    result = await cast_send(
        CONTRACTS["PositionManager"],
        "addCollateral(uint256,uint256)",
        str(position_id), str(amount),
    )
    return {"status": "success", "tx": result}
