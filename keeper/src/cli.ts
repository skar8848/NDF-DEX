#!/usr/bin/env npx tsx
import { formatUnits, parseUnits } from 'viem'
import { config } from './config.js'
import {
  publicClient, walletClient, account,
  forwardMarket, ForwardMarketABI,
  positionManager, PositionManagerABI,
  oracleContract, MockOracleABI,
  orderBook, OrderBookABI,
  mockUsdc, MockUsdcABI,
} from './contracts.js'
import { fetchAllOpenPositions } from './services/positionMonitor.js'
import { fetchOraclePrices } from './services/priceService.js'

// ─── Helpers ─────────────────────────────────────────────────────

const PRICE_DECIMALS = 8
const USDC_DECIMALS = 6

function fmtPrice(price: bigint): string {
  return Number(formatUnits(price, PRICE_DECIMALS)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtUsdc(amount: bigint): string {
  return Number(formatUnits(amount, USDC_DECIMALS)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(ts: bigint): string {
  if (ts === 0n) return 'N/A'
  return new Date(Number(ts) * 1000).toLocaleString()
}

function parseSide(s: string): number {
  const lower = s.toLowerCase()
  if (lower === 'long' || lower === '0') return 0
  if (lower === 'short' || lower === '1') return 1
  throw new Error(`Invalid side: ${s} (use "long" or "short")`)
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag)
  if (idx === -1 || idx + 1 >= args.length) return undefined
  return args[idx + 1]
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag)
}

function die(msg: string): never {
  console.error(`Error: ${msg}`)
  process.exit(1)
}

async function waitTx(hash: `0x${string}`) {
  console.log(`  tx: ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (receipt.status === 'success') {
    console.log(`  Confirmed in block ${receipt.blockNumber}`)
  } else {
    console.error(`  Transaction REVERTED`)
  }
  return receipt
}

// ─── Commands ────────────────────────────────────────────────────

async function cmdMarkets() {
  const markets = await forwardMarket.read.getAllMarkets()
  if (markets.length === 0) { console.log('No markets found.'); return }

  console.log('')
  console.log('  ID  Pair              Expiration            LTV    Liq%   Long OI      Short OI     Settled')
  console.log('  ' + '─'.repeat(100))

  for (const m of markets) {
    const pair = `${m.baseAsset}/${m.quoteAsset}`.padEnd(16)
    const exp = fmtDate(m.expiration).padEnd(20)
    const ltv = `${Number(m.ltv) / 100}%`.padStart(6)
    const liq = `${Number(m.liquidationThreshold) / 100}%`.padStart(6)
    const longOI = fmtUsdc(m.totalLongOI).padStart(12)
    const shortOI = fmtUsdc(m.totalShortOI).padStart(12)
    const settled = m.settled ? 'YES' : 'NO'
    console.log(`  ${String(m.id).padStart(2)}  ${pair}${exp}${ltv}${liq}${longOI}${shortOI}     ${settled}`)
  }
  console.log('')
}

async function cmdPrices() {
  const markets = await forwardMarket.read.getAllMarkets()
  const assets = [...new Set(markets.map(m => m.baseAsset))]
  const prices = await fetchOraclePrices(assets)

  console.log('')
  console.log('  Asset        Price')
  console.log('  ' + '─'.repeat(30))
  for (const [asset, price] of prices) {
    console.log(`  ${asset.padEnd(12)}$${fmtPrice(price)}`)
  }
  console.log('')
}

async function cmdPositions(args: string[]) {
  const mine = hasFlag(args, '--mine')

  if (mine) {
    const positions = await publicClient.readContract({
      address: config.addresses.positionManager,
      abi: PositionManagerABI,
      functionName: 'getUserOpenPositions',
      args: [account.address],
    })
    printPositions(positions as any[], `My open positions (${account.address})`)
  } else {
    const positions = await fetchAllOpenPositions()
    printPositions(positions, 'All open positions')
  }
}

function printPositions(positions: any[], title: string) {
  if (positions.length === 0) { console.log(`\n  ${title}: none\n`); return }

  // Fetch markets for asset names
  console.log('')
  console.log(`  ${title} (${positions.length})`)
  console.log('')
  console.log('  ID    Trader           Market  Side    Entry Price    Size         Collateral   Opened')
  console.log('  ' + '─'.repeat(100))

  for (const p of positions) {
    const id = String(p.id).padStart(4)
    const trader = `${String(p.trader).slice(0, 6)}..${String(p.trader).slice(-4)}`.padEnd(15)
    const market = String(p.marketId).padStart(5)
    const side = (p.side === 0 ? 'LONG' : 'SHORT').padEnd(7)
    const entry = ('$' + fmtPrice(p.entryPrice)).padStart(13)
    const size = fmtUsdc(p.size).padStart(12)
    const coll = ('$' + fmtUsdc(p.collateral)).padStart(12)
    const opened = fmtDate(p.timestamp)
    console.log(`  ${id}  ${trader}${market}  ${side}${entry}${size}${coll}   ${opened}`)
  }
  console.log('')
}

async function cmdPosition(args: string[]) {
  if (args.length === 0) die('Usage: tenor position <id>')
  const positionId = BigInt(args[0])

  const [pos, tpsl, health] = await Promise.all([
    positionManager.read.getPosition([positionId]),
    positionManager.read.getTPSL([positionId]),
    positionManager.read.getHealthFactor([positionId]),
  ])

  // Fetch market info
  const markets = await forwardMarket.read.getAllMarkets()
  const market = markets.find(m => m.id === (pos as any).marketId)
  const asset = market ? `${market.baseAsset}/${market.quoteAsset}` : `Market #${(pos as any).marketId}`

  const p = pos as any
  const tp = tpsl as any

  console.log('')
  console.log(`  Position #${p.id}`)
  console.log('  ' + '─'.repeat(40))
  console.log(`  Market:       ${asset}`)
  console.log(`  Trader:       ${p.trader}`)
  console.log(`  Side:         ${p.side === 0 ? 'LONG' : 'SHORT'}`)
  console.log(`  Entry Price:  $${fmtPrice(p.entryPrice)}`)
  console.log(`  Size:         ${fmtUsdc(p.size)}`)
  console.log(`  Collateral:   $${fmtUsdc(p.collateral)}`)
  console.log(`  Health:       ${(Number(health) / 100).toFixed(2)}%`)
  console.log(`  Take Profit:  ${tp.takeProfitPrice > 0n ? '$' + fmtPrice(tp.takeProfitPrice) : 'Not set'}`)
  console.log(`  Stop Loss:    ${tp.stopLossPrice > 0n ? '$' + fmtPrice(tp.stopLossPrice) : 'Not set'}`)
  console.log(`  Open:         ${p.isOpen ? 'Yes' : 'No'}`)
  console.log(`  Opened:       ${fmtDate(p.timestamp)}`)
  console.log('')
}

async function cmdTrade(args: string[]) {
  // tenor trade long ETH 5 --price 2500
  // tenor trade short ETH 3 --market
  if (args.length < 3) die('Usage: tenor trade <long|short> <asset> <amount> [--price <price>] [--market]')

  const side = parseSide(args[0])
  const asset = args[1].toUpperCase()
  const amount = parseFloat(args[2])
  if (isNaN(amount) || amount <= 0) die('Invalid amount')

  const priceFlag = getFlag(args, '--price')
  const isMarket = hasFlag(args, '--market')

  if (!priceFlag && !isMarket) die('Specify --price <price> for limit order or --market for market order')

  // Find market by asset
  const markets = await forwardMarket.read.getAllMarkets()
  const market = markets.find(m => m.baseAsset.toUpperCase() === asset)
  if (!market) die(`No market found for asset: ${asset}. Available: ${markets.map(m => m.baseAsset).join(', ')}`)

  const amountRaw = parseUnits(String(amount), USDC_DECIMALS)

  // Approve USDC spending on OrderBook
  console.log(`  Approving USDC spend...`)
  const approveHash = await walletClient.writeContract({
    address: config.addresses.mockUsdc,
    abi: MockUsdcABI,
    functionName: 'approve',
    args: [config.addresses.orderBook, amountRaw * 10n], // generous approval
  })
  await waitTx(approveHash)

  if (isMarket) {
    console.log(`  Placing MARKET order: ${side === 0 ? 'LONG' : 'SHORT'} ${asset} size=${amount}`)
    const hash = await walletClient.writeContract({
      address: config.addresses.orderBook,
      abi: OrderBookABI,
      functionName: 'placeMarketOrder',
      args: [market.id, side, amountRaw],
    })
    await waitTx(hash)
  } else {
    const price = parseFloat(priceFlag!)
    if (isNaN(price) || price <= 0) die('Invalid price')
    const priceRaw = parseUnits(String(price), PRICE_DECIMALS)

    console.log(`  Placing LIMIT order: ${side === 0 ? 'LONG' : 'SHORT'} ${asset} size=${amount} @ $${price}`)
    const hash = await walletClient.writeContract({
      address: config.addresses.orderBook,
      abi: OrderBookABI,
      functionName: 'placeLimitOrder',
      args: [market.id, side, priceRaw, amountRaw],
    })
    await waitTx(hash)
  }

  console.log('  Done!')
}

async function cmdClose(args: string[]) {
  if (args.length === 0) die('Usage: tenor close <positionId> [--percent <1-100>]')

  const positionId = BigInt(args[0])
  const percentStr = getFlag(args, '--percent')

  let closeSize = 0n // 0 = full close
  if (percentStr) {
    const pct = parseInt(percentStr)
    if (isNaN(pct) || pct < 1 || pct > 100) die('--percent must be between 1 and 100')

    if (pct < 100) {
      // Fetch position to calculate partial size
      const pos = await positionManager.read.getPosition([positionId]) as any
      closeSize = (pos.size * BigInt(pct)) / 100n
      console.log(`  Closing ${pct}% of position #${positionId} (size: ${fmtUsdc(closeSize)})`)
    } else {
      console.log(`  Closing 100% of position #${positionId}`)
    }
  } else {
    console.log(`  Closing position #${positionId} (full)`)
  }

  const hash = await walletClient.writeContract({
    address: config.addresses.positionManager,
    abi: PositionManagerABI,
    functionName: 'closePosition',
    args: [positionId, closeSize],
  })
  await waitTx(hash)
  console.log('  Done!')
}

async function cmdTPSL(args: string[]) {
  if (args.length === 0) die('Usage: tenor tpsl <positionId> [--tp <price>] [--sl <price>]')

  const positionId = BigInt(args[0])
  const tpStr = getFlag(args, '--tp')
  const slStr = getFlag(args, '--sl')

  if (!tpStr && !slStr) die('Specify at least --tp <price> or --sl <price>')

  const tp = tpStr ? parseUnits(tpStr, PRICE_DECIMALS) : 0n
  const sl = slStr ? parseUnits(slStr, PRICE_DECIMALS) : 0n

  console.log(`  Setting TP/SL for position #${positionId}`)
  if (tp > 0n) console.log(`    Take Profit: $${tpStr}`)
  if (sl > 0n) console.log(`    Stop Loss:   $${slStr}`)

  const hash = await walletClient.writeContract({
    address: config.addresses.positionManager,
    abi: PositionManagerABI,
    functionName: 'setTPSL',
    args: [positionId, tp, sl],
  })
  await waitTx(hash)
  console.log('  Done!')
}

async function cmdFaucet() {
  console.log(`  Minting 10,000 USDC to ${account.address}...`)
  const hash = await walletClient.writeContract({
    address: config.addresses.mockUsdc,
    abi: MockUsdcABI,
    functionName: 'faucet',
    args: [],
  })
  await waitTx(hash)

  const balance = await publicClient.readContract({
    address: config.addresses.mockUsdc,
    abi: MockUsdcABI,
    functionName: 'balanceOf',
    args: [account.address],
  })
  console.log(`  New balance: $${fmtUsdc(balance as bigint)}`)
}

async function cmdBalance() {
  const [usdcBalance, avaxBalance] = await Promise.all([
    publicClient.readContract({
      address: config.addresses.mockUsdc,
      abi: MockUsdcABI,
      functionName: 'balanceOf',
      args: [account.address],
    }),
    publicClient.getBalance({ address: account.address }),
  ])

  console.log('')
  console.log(`  Wallet: ${account.address}`)
  console.log('  ' + '─'.repeat(50))
  console.log(`  USDC:   $${fmtUsdc(usdcBalance as bigint)}`)
  console.log(`  AVAX:   ${Number(formatUnits(avaxBalance, 18)).toFixed(4)}`)
  console.log('')
}

async function cmdKeeper() {
  const { main } = await import('./index.js')
  await main()
}

function printHelp() {
  console.log(`
  Tenor DEX CLI
  ${'─'.repeat(50)}

  USAGE
    npx tsx src/cli.ts <command> [options]
    npm run cli -- <command> [options]

  COMMANDS
    markets                              List all markets
    prices                               Live oracle prices
    positions                            All open positions
    positions --mine                     My open positions
    position <id>                        Position details
    trade <long|short> <asset> <amount>  Place an order
      --price <price>                      Limit order at price
      --market                             Market order
    close <id>                           Close position (full)
      --percent <1-100>                    Partial close
    tpsl <id>                            Set take-profit / stop-loss
      --tp <price>                         Take-profit price
      --sl <price>                         Stop-loss price
    faucet                               Mint 10,000 USDC
    balance                              Wallet balances
    keeper                               Start keeper bot

  EXAMPLES
    npx tsx src/cli.ts faucet
    npx tsx src/cli.ts trade long ETH 5 --price 2500
    npx tsx src/cli.ts trade short ETH 3 --market
    npx tsx src/cli.ts positions --mine
    npx tsx src/cli.ts tpsl 1 --tp 3000 --sl 2000
    npx tsx src/cli.ts close 1 --percent 50
    npx tsx src/cli.ts keeper
`)
}

// ─── Main dispatcher ─────────────────────────────────────────────

async function run() {
  const [cmd, ...args] = process.argv.slice(2)

  try {
    switch (cmd) {
      case 'markets':   return await cmdMarkets()
      case 'prices':    return await cmdPrices()
      case 'positions': return await cmdPositions(args)
      case 'position':  return await cmdPosition(args)
      case 'trade':     return await cmdTrade(args)
      case 'close':     return await cmdClose(args)
      case 'tpsl':      return await cmdTPSL(args)
      case 'faucet':    return await cmdFaucet()
      case 'balance':   return await cmdBalance()
      case 'keeper':    return await cmdKeeper()
      case 'help':
      case '--help':
      case '-h':        return printHelp()
      default:          return printHelp()
    }
  } catch (err: any) {
    if (err?.shortMessage) {
      console.error(`\n  Error: ${err.shortMessage}`)
      if (err.details) console.error(`  Details: ${err.details}`)
    } else if (err instanceof Error) {
      console.error(`\n  Error: ${err.message}`)
    } else {
      console.error(`\n  Error:`, err)
    }
    process.exit(1)
  }
}

run()
