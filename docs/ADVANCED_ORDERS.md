# Advanced Order Types

Tenor Protocol supports four time-in-force (TIF) modes for limit orders.

## Order Types

### GTC — Good-Til-Cancelled (Default)
Standard limit order. Stays on the book until filled or cancelled.

```bash
npx tsx src/cli.ts trade long ETH 5 --price 2500
npx tsx src/cli.ts trade long ETH 5 --price 2500 --tif gtc
```

### IOC — Immediate-Or-Cancel
Fills what's available immediately, cancels and refunds the remainder.

**Use case**: Want to fill at a specific price but don't want unfilled orders sitting on the book.

```bash
npx tsx src/cli.ts trade long ETH 5 --price 2500 --tif ioc
```

**Behavior**:
- If 3 out of 5 contracts fill → fills 3, refunds collateral for remaining 2
- If 0 fill → order cancelled entirely, full collateral refunded
- Never added to the order book

### FOK — Fill-Or-Kill
Must fill the entire order or the transaction reverts.

**Use case**: Atomic fills where partial fills are unacceptable.

```bash
npx tsx src/cli.ts trade long ETH 5 --price 2500 --tif fok
```

**Behavior**:
- Pre-checks available liquidity at the specified price
- If enough liquidity exists → fills entirely
- If not → reverts with "insufficient liquidity (FOK)"

### POST_ONLY — Add to Book Only
Ensures the order is added to the book as a maker order. Reverts if it would match.

**Use case**: Market makers who want to earn maker rebates, never pay taker fees.

```bash
npx tsx src/cli.ts trade long ETH 2 --price 2400 --tif post-only
```

**Behavior**:
- Checks if the order would cross any resting orders
- If would match → reverts with "would match (post-only)"
- If no match → added to the book as a resting order

## Backward Compatibility

The existing `placeLimitOrder()` function continues to work as GTC. Advanced TIF is accessed via:

```solidity
placeLimitOrderAdvanced(marketId, side, price, amount, timeInForce)
```

## SDK

```typescript
import { TimeInForce } from '@tenor-protocol/sdk'

await client.placeLimitOrderAdvanced(1n, 'long', parsePrice('2500'), 5n, TimeInForce.IOC)
await client.placeLimitOrderAdvanced(1n, 'short', parsePrice('2400'), 3n, TimeInForce.POST_ONLY)
```
