import { useEffect, useRef, useMemo } from 'react'
import { useOraclePrice } from '../../hooks/usePriceData'
import { formatPrice } from '../../lib/utils'

type PriceChartProps = {
  baseAsset: string
}

const ASSET_TO_SYMBOL: Record<string, string> = {
  ETH: 'COINBASE:ETHUSD',
  BTC: 'COINBASE:BTCUSD',
  AVAX: 'COINBASE:AVAXUSD',
}

export function PriceChart({ baseAsset }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<HTMLDivElement | null>(null)
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

  const symbol = useMemo(() => ASSET_TO_SYMBOL[baseAsset] ?? 'COINBASE:ETHUSD', [baseAsset])

  useEffect(() => {
    if (!containerRef.current) return

    // Clear previous widget
    if (widgetRef.current) {
      widgetRef.current.innerHTML = ''
    }

    const wrapper = document.createElement('div')
    wrapper.className = 'tradingview-widget-container'
    wrapper.style.width = '100%'
    wrapper.style.height = '100%'

    const widgetDiv = document.createElement('div')
    widgetDiv.className = 'tradingview-widget-container__widget'
    widgetDiv.style.width = '100%'
    widgetDiv.style.height = '100%'
    wrapper.appendChild(widgetDiv)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.type = 'text/javascript'
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      gridColor: 'rgba(42, 42, 62, 0.25)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      withdateranges: true,
      details: false,
      hotlist: false,
      show_popup_button: false,
      studies: ['STD;EMA'],
      overrides: {
        'paneProperties.backgroundType': 'solid',
        'paneProperties.background': '#0a0a14',
        'mainSeriesProperties.candleStyle.upColor': '#22c55e',
        'mainSeriesProperties.candleStyle.downColor': '#ef4444',
        'mainSeriesProperties.candleStyle.borderUpColor': '#22c55e',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ef4444',
        'mainSeriesProperties.candleStyle.wickUpColor': '#22c55e',
        'mainSeriesProperties.candleStyle.wickDownColor': '#ef4444',
      },
    })
    wrapper.appendChild(script)

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(wrapper)
    widgetRef.current = wrapper

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      widgetRef.current = null
    }
  }, [symbol])

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
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-text font-mono">${priceFormatted}</span>
            <span className="text-[10px] text-text-secondary">Oracle</span>
          </div>
          <span className="text-[10px] text-text-secondary/60">
            Updated: {lastUpdate}
          </span>
        </div>
        <span className="text-[10px] text-text-secondary/50 font-mono">
          {baseAsset}/USD
        </span>
      </div>

      {/* TradingView Advanced Chart Widget */}
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  )
}
