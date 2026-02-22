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
  mockWeth, MockWethABI,
  InsuranceFundABI,
  TenorVaultABI,
  CollateralManagerABI,
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

function fmtTimeLeft(expiration: bigint): string {
  const now = Date.now() / 1000
  const diff = Number(expiration) - now
  if (diff <= 0) return 'EXPIRED'
  if (diff < 60) return `${Math.floor(diff)}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
  return `${Math.floor(diff / 86400)}d`
}

async function cmdMarkets() {
  const markets = await forwardMarket.read.getAllMarkets()
  if (markets.length === 0) { console.log('No markets found.'); return }

  console.log('')
  console.log('  ID  Pair              Type       Expires In   LTV    Long OI      Short OI     Status')
  console.log('  ' + '─'.repeat(100))

  for (const m of markets) {
    const pair = `${m.baseAsset}/${m.quoteAsset}`.padEnd(16)
    const type = (m.settlementType === 1 ? 'PHYSICAL' : 'CASH').padEnd(10)
    const timeLeft = fmtTimeLeft(m.expiration).padEnd(12)
    const ltv = `${Number(m.ltv) / 100}%`.padStart(6)
    const longOI = String(m.totalLongOI).padStart(12)
    const shortOI = String(m.totalShortOI).padStart(12)
    const status = m.settled ? 'SETTLED' : (Number(m.expiration) < Date.now() / 1000 ? 'EXPIRED' : 'ACTIVE')
    console.log(`  ${String(m.id).padStart(2)}  ${pair}${type}${timeLeft}${ltv}${longOI}${shortOI}     ${status}`)
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
    const size = String(p.size).padStart(12)
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
  console.log(`  Size:         ${p.size} contracts`)
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
  // tenor trade long ETH 2 --price 1950 --mid 4
  if (args.length < 3) die('Usage: tenor trade <long|short> <asset> <amount> [--price <price>] [--market] [--mid <marketId>]')

  const side = parseSide(args[0])
  const asset = args[1].toUpperCase()
  const amount = parseFloat(args[2])
  if (isNaN(amount) || amount <= 0) die('Invalid amount')

  const priceFlag = getFlag(args, '--price')
  const isMarket = hasFlag(args, '--market')
  const midFlag = getFlag(args, '--mid')

  if (!priceFlag && !isMarket) die('Specify --price <price> for limit order or --market for market order')

  // Find market by ID or by asset name
  const markets = await forwardMarket.read.getAllMarkets()
  let market: any
  if (midFlag) {
    market = markets.find(m => String(m.id) === midFlag)
    if (!market) die(`No market found with ID: ${midFlag}`)
  } else {
    market = markets.find(m => m.baseAsset.toUpperCase() === asset && !m.settled)
    if (!market) die(`No market found for asset: ${asset}. Available: ${markets.map(m => m.baseAsset).join(', ')}`)
  }

  // amount = number of contracts (raw), not USDC
  const amountRaw = BigInt(Math.floor(amount))

  // Estimate collateral: amount * price / PRICE_PRECISION * COLLATERAL_PRECISION * PERCENT_BASE / ltv
  const priceForCalc = isMarket
    ? (await oracleContract.read.getPrice([asset]))[0]
    : parseUnits(String(parseFloat(priceFlag!)), PRICE_DECIMALS)
  const collateralEstimate = amountRaw * priceForCalc / config.PRICE_PRECISION
    * config.COLLATERAL_PRECISION * config.PERCENT_BASE / market.ltv
  console.log(`  Estimated collateral: $${fmtUsdc(collateralEstimate)}`)

  // Approve USDC spending on OrderBook (enough for collateral)
  console.log(`  Approving USDC spend...`)
  const approveHash = await walletClient.writeContract({
    address: config.addresses.mockUsdc,
    abi: MockUsdcABI,
    functionName: 'approve',
    args: [config.addresses.orderBook, collateralEstimate * 2n],
  })
  await waitTx(approveHash)

  const tifFlag = getFlag(args, '--tif')
  const tifMap: Record<string, number> = { gtc: 0, ioc: 1, fok: 2, 'post-only': 3 }
  const tif = tifFlag ? tifMap[tifFlag.toLowerCase()] : undefined

  if (isMarket) {
    console.log(`  Placing MARKET order: ${side === 0 ? 'LONG' : 'SHORT'} ${asset} x${amount} contracts`)
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

    const tifLabel = tifFlag ? tifFlag.toUpperCase() : 'GTC'
    console.log(`  Placing ${tifLabel} LIMIT order: ${side === 0 ? 'LONG' : 'SHORT'} ${asset} x${amount} @ $${price}`)

    if (tif !== undefined && tif !== 0) {
      const hash = await walletClient.writeContract({
        address: config.addresses.orderBook,
        abi: OrderBookABI,
        functionName: 'placeLimitOrderAdvanced',
        args: [market.id, side, priceRaw, amountRaw, tif],
      })
      await waitTx(hash)
    } else {
      const hash = await walletClient.writeContract({
        address: config.addresses.orderBook,
        abi: OrderBookABI,
        functionName: 'placeLimitOrder',
        args: [market.id, side, priceRaw, amountRaw],
      })
      await waitTx(hash)
    }
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
      const pos = await positionManager.read.getPosition([positionId]) as any
      closeSize = (pos.size * BigInt(pct)) / 100n
      console.log(`  Closing ${pct}% of position #${positionId} (${closeSize} of ${pos.size} contracts)`)
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
  const [usdcBalance, wethBalance, avaxBalance] = await Promise.all([
    publicClient.readContract({
      address: config.addresses.mockUsdc,
      abi: MockUsdcABI,
      functionName: 'balanceOf',
      args: [account.address],
    }),
    publicClient.readContract({
      address: config.addresses.mockWeth,
      abi: MockWethABI,
      functionName: 'balanceOf',
      args: [account.address],
    }),
    publicClient.getBalance({ address: account.address }),
  ])

  console.log('')
  console.log(`  Wallet: ${account.address}`)
  console.log('  ' + '─'.repeat(50))
  console.log(`  USDC:   $${fmtUsdc(usdcBalance as bigint)}`)
  console.log(`  WETH:   ${Number(formatUnits(wethBalance as bigint, 18)).toFixed(6)}`)
  console.log(`  AVAX:   ${Number(formatUnits(avaxBalance, 18)).toFixed(4)}`)
  console.log('')
}

async function cmdSettleMarket(args: string[]) {
  if (args.length === 0) die('Usage: tenor settle-market <marketId>')
  const marketId = BigInt(args[0])

  console.log(`  Settling market #${marketId}...`)
  const hash = await walletClient.writeContract({
    address: config.addresses.forwardMarket,
    abi: ForwardMarketABI,
    functionName: 'settleMarket',
    args: [marketId],
  })
  await waitTx(hash)
  console.log('  Market settled!')
}

async function cmdSettle(args: string[]) {
  if (args.length === 0) die('Usage: tenor settle <positionId>')
  const positionId = BigInt(args[0])

  // Check WETH balance before (to show physical delivery)
  const wethBefore = await publicClient.readContract({
    address: config.addresses.mockWeth,
    abi: MockWethABI,
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint
  const usdcBefore = await publicClient.readContract({
    address: config.addresses.mockUsdc,
    abi: MockUsdcABI,
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint

  console.log(`  Settling position #${positionId}...`)
  console.log(`  Before: USDC=$${fmtUsdc(usdcBefore)} | WETH=${Number(formatUnits(wethBefore, 18)).toFixed(6)}`)

  const hash = await walletClient.writeContract({
    address: config.addresses.positionManager,
    abi: PositionManagerABI,
    functionName: 'settlePosition',
    args: [positionId],
  })
  await waitTx(hash)

  // Check balances after
  const wethAfter = await publicClient.readContract({
    address: config.addresses.mockWeth,
    abi: MockWethABI,
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint
  const usdcAfter = await publicClient.readContract({
    address: config.addresses.mockUsdc,
    abi: MockUsdcABI,
    functionName: 'balanceOf',
    args: [account.address],
  }) as bigint

  console.log(`  After:  USDC=$${fmtUsdc(usdcAfter)} | WETH=${Number(formatUnits(wethAfter, 18)).toFixed(6)}`)

  const wethDelta = wethAfter - wethBefore
  const usdcDelta = usdcAfter - usdcBefore
  if (wethDelta > 0n) console.log(`  >> Received ${Number(formatUnits(wethDelta, 18)).toFixed(6)} WETH (PHYSICAL DELIVERY)`)
  if (usdcDelta > 0n) console.log(`  >> Received $${fmtUsdc(usdcDelta)} USDC`)
  if (usdcDelta < 0n) console.log(`  >> Paid $${fmtUsdc(-usdcDelta)} USDC`)
  console.log('  Done!')
}

async function cmdBook(args: string[]) {
  if (args.length === 0) die('Usage: tenor book <marketId>')
  const marketId = BigInt(args[0])

  const [bids, asks] = await orderBook.read.getOrderBook([marketId]) as [any[], any[]]

  console.log('')
  console.log(`  Order Book - Market #${marketId}`)
  console.log('  ' + '─'.repeat(70))

  if (asks.length > 0) {
    console.log('  ASKS (sell orders):')
    for (const o of [...asks].sort((a: any, b: any) => Number(b.price - a.price))) {
      const remaining = Number(o.amount) - Number(o.filled)
      console.log(`    $${fmtPrice(o.price)}  x${remaining} contracts  (${o.trader.slice(0, 8)}...)`)
    }
  } else {
    console.log('  ASKS: empty')
  }

  console.log('  ' + '-'.repeat(40))

  if (bids.length > 0) {
    console.log('  BIDS (buy orders):')
    for (const o of [...bids].sort((a: any, b: any) => Number(b.price - a.price))) {
      const remaining = Number(o.amount) - Number(o.filled)
      console.log(`    $${fmtPrice(o.price)}  x${remaining} contracts  (${o.trader.slice(0, 8)}...)`)
    }
  } else {
    console.log('  BIDS: empty')
  }
  console.log('')
}

async function cmdFees() {
  const [feeConfig, feeTotals] = await Promise.all([
    publicClient.readContract({
      address: config.addresses.orderBook,
      abi: OrderBookABI,
      functionName: 'getFeeConfig',
    }),
    publicClient.readContract({
      address: config.addresses.orderBook,
      abi: OrderBookABI,
      functionName: 'getFeeTotals',
    }),
  ])

  const fc = feeConfig as any[]
  const ft = feeTotals as any[]

  console.log('')
  console.log('  Fee Configuration')
  console.log('  ' + '─'.repeat(40))
  console.log(`  Taker Fee:      ${Number(fc[0]) / 100}%`)
  console.log(`  Maker Rebate:   ${Number(fc[1]) / 100}% (${fc[2] ? 'enabled' : 'disabled'})`)
  console.log(`  Protocol Split: ${Number(fc[3]) / 100}%`)
  console.log(`  Insurance:      ${Number(fc[4]) / 100}%`)
  console.log(`  LP Vault:       ${Number(fc[5]) / 100}%`)
  console.log('')
  console.log('  Fee Totals')
  console.log('  ' + '─'.repeat(40))
  console.log(`  Total Collected:  $${fmtUsdc(ft[0])}`)
  console.log(`  Protocol Fees:    $${fmtUsdc(ft[1])}`)
  console.log(`  Insurance Fees:   $${fmtUsdc(ft[2])}`)
  console.log(`  Builder Fees:     $${fmtUsdc(ft[3])}`)
  console.log(`  Maker Rebates:    $${fmtUsdc(ft[4])}`)
  console.log('')
}

async function cmdInsurance() {
  const insuranceAddr = process.env.INSURANCE_FUND
  if (!insuranceAddr) { console.log('  INSURANCE_FUND address not set'); return }

  const [balance, health] = await Promise.all([
    publicClient.readContract({
      address: insuranceAddr as `0x${string}`,
      abi: InsuranceFundABI,
      functionName: 'getBalance',
    }),
    publicClient.readContract({
      address: insuranceAddr as `0x${string}`,
      abi: InsuranceFundABI,
      functionName: 'getFundHealth',
    }),
  ])

  const h = health as any[]
  console.log('')
  console.log('  Insurance Fund')
  console.log('  ' + '─'.repeat(40))
  console.log(`  Balance:        $${fmtUsdc(balance as bigint)}`)
  console.log(`  Total Deposited: $${fmtUsdc(h[2])}`)
  console.log(`  Total Covered:   $${fmtUsdc(h[1])}`)
  console.log('')
}

async function cmdVault(args: string[]) {
  const vaultAddr = process.env.TENOR_VAULT
  if (!vaultAddr) { console.log('  TENOR_VAULT address not set'); return }

  const subcmd = args[0]

  if (subcmd === 'deposit' && args[1]) {
    const amount = parseUnits(args[1], USDC_DECIMALS)
    console.log(`  Approving USDC...`)
    const approveHash = await walletClient.writeContract({
      address: config.addresses.mockUsdc,
      abi: MockUsdcABI,
      functionName: 'approve',
      args: [vaultAddr as `0x${string}`, amount],
    })
    await waitTx(approveHash)

    console.log(`  Depositing $${args[1]} into TLP vault...`)
    const hash = await walletClient.writeContract({
      address: vaultAddr as `0x${string}`,
      abi: TenorVaultABI,
      functionName: 'deposit',
      args: [amount],
    })
    await waitTx(hash)
    console.log('  Done!')
  } else if (subcmd === 'withdraw' && args[1]) {
    const shares = BigInt(args[1])
    console.log(`  Requesting withdrawal of ${shares} TLP shares...`)
    const hash = await walletClient.writeContract({
      address: vaultAddr as `0x${string}`,
      abi: TenorVaultABI,
      functionName: 'requestWithdraw',
      args: [shares],
    })
    await waitTx(hash)
    console.log('  Withdrawal requested! Execute after delay.')
  } else if (subcmd === 'execute') {
    console.log(`  Executing pending withdrawal...`)
    const hash = await walletClient.writeContract({
      address: vaultAddr as `0x${string}`,
      abi: TenorVaultABI,
      functionName: 'executeWithdraw',
    })
    await waitTx(hash)
    console.log('  Done!')
  } else {
    // status
    const [sharePrice, totalValue, supply, myShares] = await Promise.all([
      publicClient.readContract({ address: vaultAddr as `0x${string}`, abi: TenorVaultABI, functionName: 'sharePrice' }),
      publicClient.readContract({ address: vaultAddr as `0x${string}`, abi: TenorVaultABI, functionName: 'totalValue' }),
      publicClient.readContract({ address: vaultAddr as `0x${string}`, abi: TenorVaultABI, functionName: 'totalSupply' }),
      publicClient.readContract({ address: vaultAddr as `0x${string}`, abi: TenorVaultABI, functionName: 'balanceOf', args: [account.address] }),
    ])

    console.log('')
    console.log('  TLP Vault')
    console.log('  ' + '─'.repeat(40))
    console.log(`  Share Price:   $${(Number(sharePrice as bigint) / 1e18).toFixed(6)}`)
    console.log(`  Total Value:   $${fmtUsdc(totalValue as bigint)}`)
    console.log(`  Total Supply:  ${formatUnits(supply as bigint, 18)} TLP`)
    console.log(`  My Shares:     ${formatUnits(myShares as bigint, 18)} TLP`)
    console.log('')
  }
}

async function cmdCollateral(args: string[]) {
  const cmAddr = process.env.COLLATERAL_MANAGER
  if (!cmAddr) { console.log('  COLLATERAL_MANAGER address not set'); return }

  const subcmd = args[0]

  if (subcmd === 'deposit' && args[1] && args[2]) {
    const tokenAddr = args[1] === 'WETH' ? config.addresses.mockWeth : args[1] as `0x${string}`
    const amount = parseUnits(args[2], args[1] === 'WETH' ? 18 : 6)

    console.log(`  Approving token...`)
    const approveAbi = [{ type: 'function' as const, name: 'approve' as const, inputs: [{ name: 'spender', type: 'address' as const }, { name: 'amount', type: 'uint256' as const }], outputs: [{ type: 'bool' as const }], stateMutability: 'nonpayable' as const }]
    const approveHash = await walletClient.writeContract({
      address: tokenAddr,
      abi: approveAbi,
      functionName: 'approve',
      args: [cmAddr as `0x${string}`, amount],
    })
    await waitTx(approveHash)

    console.log(`  Depositing ${args[2]} ${args[1]}...`)
    const hash = await walletClient.writeContract({
      address: cmAddr as `0x${string}`,
      abi: CollateralManagerABI,
      functionName: 'depositCollateral',
      args: [tokenAddr, amount],
    })
    await waitTx(hash)
    console.log('  Done!')
  } else if (subcmd === 'withdraw' && args[1] && args[2]) {
    const tokenAddr = args[1] === 'WETH' ? config.addresses.mockWeth : args[1] as `0x${string}`
    const amount = parseUnits(args[2], args[1] === 'WETH' ? 18 : 6)

    console.log(`  Withdrawing ${args[2]} ${args[1]}...`)
    const hash = await walletClient.writeContract({
      address: cmAddr as `0x${string}`,
      abi: CollateralManagerABI,
      functionName: 'withdrawCollateral',
      args: [tokenAddr, amount],
    })
    await waitTx(hash)
    console.log('  Done!')
  } else {
    // status
    const totalValue = await publicClient.readContract({
      address: cmAddr as `0x${string}`,
      abi: CollateralManagerABI,
      functionName: 'getCollateralValueUSD',
      args: [account.address],
    })
    console.log('')
    console.log('  Collateral Status')
    console.log('  ' + '─'.repeat(40))
    console.log(`  Total USD Value: $${fmtUsdc(totalValue as bigint)} (after haircuts)`)
    console.log('')
  }
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
    markets                              List all markets (cash + physical)
    prices                               Live oracle prices
    positions                            All open positions
    positions --mine                     My open positions
    position <id>                        Position details
    book <marketId>                      View order book
    trade <long|short> <asset> <amount>  Place an order
      --price <price>                      Limit order at price
      --market                             Market order
      --tif <gtc|ioc|fok|post-only>        Time-in-force (default: gtc)
    close <id>                           Close position (full)
      --percent <1-100>                    Partial close
    tpsl <id>                            Set take-profit / stop-loss
      --tp <price>                         Take-profit price
      --sl <price>                         Stop-loss price
    fees                                 Show fee config + totals
    insurance                            Show insurance fund status
    vault [deposit|withdraw|execute|status]  TLP vault operations
    collateral [deposit|withdraw|status]     Multi-collateral management
    settle-market <id>                   Settle an expired market
    settle <positionId>                  Settle position (shows token received)
    faucet                               Mint 10,000 USDC
    balance                              Wallet balances (USDC + WETH + AVAX)
    keeper                               Start keeper bot

  EXAMPLES
    npx tsx src/cli.ts faucet
    npx tsx src/cli.ts trade long ETH 5 --price 2500
    npx tsx src/cli.ts trade long ETH 2 --price 2500 --tif ioc
    npx tsx src/cli.ts trade short ETH 3 --market
    npx tsx src/cli.ts fees
    npx tsx src/cli.ts vault deposit 1000
    npx tsx src/cli.ts vault status
    npx tsx src/cli.ts collateral deposit WETH 1
    npx tsx src/cli.ts book 4
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
      case 'fees':      return await cmdFees()
      case 'insurance': return await cmdInsurance()
      case 'vault':     return await cmdVault(args)
      case 'collateral': return await cmdCollateral(args)
      case 'settle-market': return await cmdSettleMarket(args)
      case 'settle':    return await cmdSettle(args)
      case 'book':      return await cmdBook(args)
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
