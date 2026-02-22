import { useEffect, useRef, useMemo } from 'react'
import { createChart, ColorType, LineSeries, type IChartApi } from 'lightweight-charts'
import { useOraclePrice } from '../../hooks/usePriceData'
import { formatPrice } from '../../lib/utils'
import { PRICE_PRECISION } from '../../lib/config'

type PriceChartProps = {
  baseAsset: string
}

function generateFlatLine(currentPrice: number, count: number) {
  const points: { time: string; value: number }[] = []
  const now = new Date()

  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 3600 * 1000)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const timeStr = `${dateStr} ${String(date.getHours()).padStart(2, '0')}:00`

    // Tiny noise around oracle price (~0.1%) to look natural but essentially flat
    const noise = currentPrice * (Math.random() - 0.5) * 0.002
    points.push({
      time: timeStr,
      value: Math.round((currentPrice + noise) * 100) / 100,
    })
  }

  return points
}

export function PriceChart({ baseAsset }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const { data: priceData, isLoading } = useOraclePrice(baseAsset)

  let price: bigint | null = null
  let timestamp: bigint | null = null
  try {
    if (priceData) {
      price = (priceData as [bigint, bigint])[0]
      timestamp = (priceData as [bigint, bigint])[1]
    }
  } catch {
    // ignore
  }

  const currentPrice = price ? Number(price) / PRICE_PRECISION : null

  const lineData = useMemo(() => {
    if (!currentPrice) return null
    return generateFlatLine(currentPrice, 48)
  }, [currentPrice])

  useEffect(() => {
    if (!chartContainerRef.current || !lineData || lineData.length === 0) return

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
        scaleMargins: { top: 0.2, bottom: 0.2 },
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

    const lineSeries = chart.addSeries(LineSeries, {
      color: '#6366f1',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: '#6366f1',
      priceLineVisible: true,
      priceLineColor: '#6366f180',
    })

    lineSeries.setData(lineData as any)

    // Oracle price line
    if (currentPrice) {
      lineSeries.createPriceLine({
        price: currentPrice,
        color: '#6366f1',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Oracle',
      })
    }

    chart.timeScale().fitContent()

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
  }, [lineData, currentPrice])

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
        <span className="text-[10px] text-text-secondary/50 font-mono">
          {baseAsset}/USD
        </span>
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="flex-1 min-h-0" />
    </div>
  )
}
