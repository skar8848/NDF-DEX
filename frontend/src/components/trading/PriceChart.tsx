import { useEffect, useRef, useMemo } from 'react'
import { useTheme } from '../../hooks/useTheme'

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
  const { theme } = useTheme()

  const symbol = useMemo(() => ASSET_TO_SYMBOL[baseAsset] ?? 'COINBASE:ETHUSD', [baseAsset])

  useEffect(() => {
    if (!containerRef.current) return

    if (widgetRef.current) {
      widgetRef.current.innerHTML = ''
    }

    const isDark = theme === 'dark'
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
      theme: isDark ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      backgroundColor: isDark ? '#0c0c1d' : '#ffffff',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(26, 26, 26, 0.1)',
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
        'paneProperties.background': isDark ? '#0c0c1d' : '#ffffff',
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
  }, [symbol, theme])

  return <div ref={containerRef} className="w-full h-full" />
}
