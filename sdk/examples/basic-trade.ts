/**
 * Tenor Protocol SDK — Basic Trade Example
 *
 * This script demonstrates a complete trading workflow:
 *   1. Connect to Avalanche Fuji
 *   2. Mint test USDC
 *   3. Fetch markets and oracle prices
 *   4. Place a limit order
 *   5. Check positions
 *   6. Set TP/SL on a position
 *   7. Monitor the position
 *   8. Close the position
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx examples/basic-trade.ts
 */

import {
  TenorClient,
  formatPrice,
  formatUSDC,
  parsePrice,
  formatTimestamp,
  shortenAddress,
  Side,
} from '../src/index.js'

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined
if (!PRIVATE_KEY) {
  console.error('Set PRIVATE_KEY env var (0x-prefixed hex)')
  process.exit(1)
}

async function main() {
  // ── 1. Connect ────────────────────────────────────────────────
  console.log('\n--- Connecting to Tenor on Avalanche Fuji ---\n')

  const client = new TenorClient({
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    privateKey: PRIVATE_KEY,
  })

  console.log(`Wallet: ${client.account!.address}`)

  // ── 2. Mint test USDC ─────────────────────────────────────────
  console.log('\n--- Minting test USDC ---\n')

  const mintTx = await client.mintTestUSDC()
  console.log(`Faucet tx: ${mintTx}`)

  const balance = await client.getBalance()
  console.log(`USDC balance: $${formatUSDC(balance)}`)

  // ── 3. Fetch markets and prices ───────────────────────────────
  console.log('\n--- Markets ---\n')

  const markets = await client.getMarkets()
  for (const m of markets) {
    const price = await client.getPrice(m.baseAsset)
    console.log(
      `  Market #${m.id}: ${m.baseAsset}/${m.quoteAsset}` +
      ` | Price: $${formatPrice(price.price)}` +
      ` | Expires: ${formatTimestamp(m.expiration)}` +
      ` | Settled: ${m.settled}`
    )
  }

  if (markets.length === 0) {
    console.log('  No markets available. Exiting.')
    return
  }

  // ── 4. Place a limit order ────────────────────────────────────
  const market = markets[0]
  const { price: currentPrice } = await client.getPrice(market.baseAsset)

  // Place a long limit order 5% below the current price
  const limitPrice = (currentPrice * 95n) / 100n
  const size = 1n // 1 contract

  console.log(`\n--- Placing limit order ---\n`)
  console.log(`  Market: ${market.baseAsset}/${market.quoteAsset} (#${market.id})`)
  console.log(`  Side: LONG`)
  console.log(`  Price: $${formatPrice(limitPrice)} (5% below spot $${formatPrice(currentPrice)})`)
  console.log(`  Size: ${size} contract(s)`)

  const orderTx = await client.placeLimitOrder(market.id, 'long', limitPrice, size)
  console.log(`  Order tx: ${orderTx}`)

  // ── 5. Check order book ───────────────────────────────────────
  console.log(`\n--- Order Book for ${market.baseAsset}/${market.quoteAsset} ---\n`)

  const book = await client.getOrderBook(market.id)
  console.log(`  Bids: ${book.bids.length}`)
  for (const bid of book.bids.slice(0, 5)) {
    console.log(`    $${formatPrice(bid.price)} x ${bid.amount} (${shortenAddress(bid.trader)})`)
  }
  console.log(`  Asks: ${book.asks.length}`)
  for (const ask of book.asks.slice(0, 5)) {
    console.log(`    $${formatPrice(ask.price)} x ${ask.amount} (${shortenAddress(ask.trader)})`)
  }

  // ── 6. Check positions ────────────────────────────────────────
  console.log(`\n--- My Positions ---\n`)

  const positions = await client.getPositions(client.account!.address)
  if (positions.length === 0) {
    console.log('  No open positions (limit order may not have filled yet).')
    console.log('  Try placing a market order for immediate execution.')
    return
  }

  for (const pos of positions) {
    console.log(
      `  Position #${pos.id}: ${pos.side === Side.Long ? 'LONG' : 'SHORT'}` +
      ` | Entry: $${formatPrice(pos.entryPrice)}` +
      ` | Size: ${pos.size}` +
      ` | Collateral: $${formatUSDC(pos.collateral)}`
    )
  }

  // ── 7. Set TP/SL on the first position ────────────────────────
  const position = positions[0]
  const tp = parsePrice('3000') // Take profit at $3,000
  const sl = parsePrice('2000') // Stop loss at $2,000

  console.log(`\n--- Setting TP/SL on position #${position.id} ---\n`)
  console.log(`  Take Profit: $${formatPrice(tp)}`)
  console.log(`  Stop Loss:   $${formatPrice(sl)}`)

  const tpslTx = await client.setTPSL(position.id, tp, sl)
  console.log(`  TP/SL tx: ${tpslTx}`)

  // Verify
  const tpsl = await client.getTPSL(position.id)
  console.log(`  Confirmed TP: $${formatPrice(tpsl.takeProfitPrice)}`)
  console.log(`  Confirmed SL: $${formatPrice(tpsl.stopLossPrice)}`)

  // ── 8. Monitor position health ────────────────────────────────
  console.log(`\n--- Position Health ---\n`)

  const health = await client.getHealthFactor(position.id)
  console.log(`  Health factor: ${(Number(health) / 100).toFixed(2)}%`)

  // ── 9. Close position (partial 50%) ───────────────────────────
  console.log(`\n--- Closing 50% of position #${position.id} ---\n`)

  const closeTx = await client.closePosition(position.id, 50)
  console.log(`  Close tx: ${closeTx}`)

  // Final balance
  const finalBalance = await client.getBalance()
  console.log(`\n  Final USDC balance: $${formatUSDC(finalBalance)}\n`)
}

main().catch((err) => {
  console.error('\nError:', err.message ?? err)
  process.exit(1)
})
