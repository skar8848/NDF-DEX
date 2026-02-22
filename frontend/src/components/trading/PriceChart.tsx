import { useEffect, useRef, useMemo } from 'react'

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

  const symbol = useMemo(() => ASSET_TO_SYMBOL[baseAsset] ?? 'COINBASE:ETHUSD', [baseAsset])

  useEffect(() => {
    if (!containerRef.current) return

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
      backgroundColor: '#0a0a0f',
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

  return <div ref={containerRef} className="w-full h-full" />
}
