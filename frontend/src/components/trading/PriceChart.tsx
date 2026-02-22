import { useEffect, useRef, useMemo } from 'react'
import { createChart, ColorType, CandlestickSeries, HistogramSeries, type IChartApi } from 'lightweight-charts'
import { useOraclePrice } from '../../hooks/usePriceData'
import { formatPrice } from '../../lib/utils'
import { PRICE_PRECISION } from '../../lib/config'

type PriceChartProps = {
  baseAsset: string
}

function generateHistoricalCandles(currentPrice: number, count: number) {
  const candles: {
    time: string
    open: number
    high: number
    low: number
    close: number
    volume: number
  }[] = []

  const now = new Date()
  let price = currentPrice * (1 - 0.08 + Math.random() * 0.06)

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 3600 * 1000)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const timeStr = `${dateStr} ${String(date.getHours()).padStart(2, '0')}:00`

    // Trending toward current price with random walk
    const trend = (currentPrice - price) * 0.02
    const volatility = currentPrice * 0.008
    const change = trend + (Math.random() - 0.5) * volatility

    const open = price
    price += change
    const close = price
    const high = Math.max(open, close) + Math.random() * volatility * 0.5
    const low = Math.min(open, close) - Math.random() * volatility * 0.5
    const volume = Math.floor(50 + Math.random() * 200)

    candles.push({
      time: timeStr,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    })
  }

  return candles
}

export function PriceChart({ baseAsset }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const { data: priceData, isLoading } = useOraclePrice(baseAsset)
  const price = priceData ? (priceData as [bigint, bigint])[0] : null
  const timestamp = priceData ? (priceData as [bigint, bigint])[1] : null

  const currentPrice = price ? Number(price) / PRICE_PRECISION : null

  const candles = useMemo(() => {
    if (!currentPrice) return null
    return generateHistoricalCandles(currentPrice, 72)
  }, [currentPrice])

  useEffect(() => {
    if (!chartContainerRef.current || !candles || candles.length === 0) return

    const container = chartContainerRef.current
    if (container.clientWidth === 0 || container.clientHeight === 0) return

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8888a0',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#2a2a3e40' },
        horzLines: { color: '#2a2a3e40' },
      },
      crosshair: {
        vertLine: { color: '#6366f180', width: 1, style: 2, labelBackgroundColor: '#6366f1' },
        horzLine: { color: '#6366f180', width: 1, style: 2, labelBackgroundColor: '#6366f1' },
      },
      rightPriceScale: {
        borderColor: '#2a2a3e',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#2a2a3e',
        timeVisible: true,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: container.clientHeight,
    })

    chartRef.current = chart

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b98180',
      wickDownColor: '#ef444480',
    })

    candleSeries.setData(candles as any)

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#6366f130',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    })

    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time,
        value: c.volume,
        color: c.close >= c.open ? '#10b98130' : '#ef444430',
      })) as any
    )

    chart.timeScale().fitContent()

    // Add current price line
    if (currentPrice) {
      candleSeries.createPriceLine({
        price: currentPrice,
        color: '#6366f1',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Oracle',
      })
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      chart.applyOptions({ width, height })
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [candles, currentPrice])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary text-sm">Loading price data...</div>
      </div>
    )
  }

  if (!price) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-text-secondary text-sm">No price data available</p>
          <p className="text-text-secondary/60 text-xs mt-1">Oracle not set for {baseAsset}</p>
        </div>
      </div>
    )
  }

  const priceFormatted = formatPrice(price)
  const lastUpdate = timestamp
    ? new Date(Number(timestamp) * 1000).toLocaleTimeString()
    : '--'

  return (
    <div className="flex flex-col h-full">
      {/* Price header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text font-mono">${priceFormatted}</span>
            <span className="text-xs text-text-secondary">Oracle Price</span>
          </div>
          <span className="text-[10px] text-text-secondary/60">
            Last update: {lastUpdate}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-secondary/50 font-mono">
            {baseAsset}/USD
          </span>
          <div className="flex gap-0.5">
            {['1H', '4H', '1D', '1W'].map((tf, i) => (
              <button
                key={tf}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-colors cursor-pointer ${
                  i === 0
                    ? 'bg-surface-2 text-text'
                    : 'text-text-secondary hover:text-text hover:bg-surface-2'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TradingView Chart */}
      <div ref={chartContainerRef} className="flex-1 min-h-0" />
    </div>
  )
}
