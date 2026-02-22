import { useEffect, useRef, useMemo, useState } from 'react'
import { createChart, ColorType, LineSeries, type IChartApi, type UTCTimestamp } from 'lightweight-charts'
import { useOraclePrice } from '../../hooks/usePriceData'
import { formatPrice } from '../../lib/utils'
import { PRICE_PRECISION } from '../../lib/config'

type PriceChartProps = {
  baseAsset: string
}

function generateFlatLine(currentPrice: number, count: number): { time: UTCTimestamp; value: number }[] {
  const points: { time: UTCTimestamp; value: number }[] = []
  const nowSec = Math.floor(Date.now() / 1000)

  for (let i = count - 1; i >= 0; i--) {
    const t = nowSec - i * 3600
    const noise = currentPrice * (Math.random() - 0.5) * 0.002
    points.push({
      time: t as UTCTimestamp,
      value: Math.round((currentPrice + noise) * 100) / 100,
    })
  }

  return points
}

export function PriceChart({ baseAsset }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [containerReady, setContainerReady] = useState(false)
  const { data: priceData, isLoading } = useOraclePrice(baseAsset)

  let price: bigint | null = null
  let timestamp: bigint | null = null
  try {
    if (priceData) {
      const d = priceData as [bigint, bigint]
      price = d[0]
      timestamp = d[1]
    }
  } catch {
    // ignore parse errors
  }

  const currentPrice = price ? Number(price) / PRICE_PRECISION : null

  const lineData = useMemo(() => {
    if (!currentPrice || currentPrice <= 0) return null
    return generateFlatLine(currentPrice, 48)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrice])

  // Wait for container to get real dimensions
  useEffect(() => {
    const el = chartContainerRef.current
    if (!el) return
    // Check immediately
    if (el.clientWidth > 50 && el.clientHeight > 50) {
      setContainerReady(true)
      return
    }
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 50 && height > 50) setContainerReady(true)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Create chart
  useEffect(() => {
    if (!chartContainerRef.current || !lineData || !containerReady) return

    const container = chartContainerRef.current
    const w = container.clientWidth
    const h = container.clientHeight
    if (w < 50 || h < 50) return

    // Cleanup old chart
    if (chartRef.current) {
      try { chartRef.current.remove() } catch { /* */ }
      chartRef.current = null
    }

    try {
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
        width: w,
        height: h,
      })

      chartRef.current = chart

      const series = chart.addSeries(LineSeries, {
        color: '#6366f1',
        lineWidth: 2,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBackgroundColor: '#6366f1',
        priceLineVisible: true,
        priceLineColor: '#6366f180',
      })

      series.setData(lineData)

      if (currentPrice) {
        series.createPriceLine({
          price: currentPrice,
          color: '#6366f1',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Oracle',
        })
      }

      chart.timeScale().fitContent()

      // Resize listener
      const ro = new ResizeObserver((entries) => {
        const rect = entries[0].contentRect
        if (rect.width > 0 && rect.height > 0) {
          chart.applyOptions({ width: rect.width, height: rect.height })
        }
      })
      ro.observe(container)

      return () => {
        ro.disconnect()
        try { chart.remove() } catch { /* */ }
        chartRef.current = null
      }
    } catch (err) {
      console.error('Chart creation failed:', err)
    }
  }, [lineData, currentPrice, containerReady])

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

      {/* Chart container */}
      <div ref={chartContainerRef} className="flex-1 min-h-0" />
    </div>
  )
}
