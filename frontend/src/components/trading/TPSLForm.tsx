import { useState } from 'react'
import { useSetTPSL, useTPSL } from '../../hooks/usePositions'
import { formatPrice, parsePrice } from '../../lib/utils'
import { PRICE_PRECISION } from '../../lib/config'
import type { Position } from '../../hooks/usePositions'

type Props = {
  position: Position
  onClose: () => void
}

export function TPSLForm({ position, onClose }: Props) {
  const { data: tpslData } = useTPSL(position.id)
  const tpsl = tpslData as { takeProfitPrice: bigint; stopLossPrice: bigint } | undefined
  const { setTPSL, isPending, isConfirming, isSuccess } = useSetTPSL()

  const [tp, setTp] = useState(() => {
    if (tpsl && tpsl.takeProfitPrice > 0n) return (Number(tpsl.takeProfitPrice) / PRICE_PRECISION).toString()
    return ''
  })
  const [sl, setSl] = useState(() => {
    if (tpsl && tpsl.stopLossPrice > 0n) return (Number(tpsl.stopLossPrice) / PRICE_PRECISION).toString()
    return ''
  })
  const [error, setError] = useState('')

  const isLong = position.side === 0
  const entryNum = Number(position.entryPrice) / PRICE_PRECISION

  const handleSubmit = () => {
    setError('')
    const tpVal = tp ? parseFloat(tp) : 0
    const slVal = sl ? parseFloat(sl) : 0

    if (tpVal === 0 && slVal === 0) {
      setError('Set at least TP or SL')
      return
    }

    if (isLong) {
      if (tpVal > 0 && tpVal <= entryNum) {
        setError('TP must be above entry for LONG')
        return
      }
      if (slVal > 0 && slVal >= entryNum) {
        setError('SL must be below entry for LONG')
        return
      }
    } else {
      if (tpVal > 0 && tpVal >= entryNum) {
        setError('TP must be below entry for SHORT')
        return
      }
      if (slVal > 0 && slVal <= entryNum) {
        setError('SL must be above entry for SHORT')
        return
      }
    }

    const tpBigint = tp ? parsePrice(tp) : 0n
    const slBigint = sl ? parsePrice(sl) : 0n
    setTPSL(position.id, tpBigint, slBigint)
  }

  if (isSuccess) {
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-surface rounded-lg border border-border p-4 w-80 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text">Set TP/SL</h3>
          <button onClick={onClose} className="text-text-secondary hover:text-text text-xs cursor-pointer">X</button>
        </div>

        <div className="text-xs text-text-secondary">
          Position #{position.id.toString()} &middot;{' '}
          <span className={isLong ? 'text-long' : 'text-short'}>{isLong ? 'LONG' : 'SHORT'}</span>
          {' '}@ ${formatPrice(position.entryPrice)}
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-text-secondary uppercase tracking-wider">Take Profit</label>
            <input
              type="number"
              step="0.01"
              value={tp}
              onChange={(e) => setTp(e.target.value)}
              placeholder={isLong ? `> ${entryNum}` : `< ${entryNum}`}
              className="w-full mt-0.5 px-2 py-1.5 text-xs bg-surface-2 border border-border rounded text-text placeholder:text-text-secondary/40"
            />
          </div>
          <div>
            <label className="text-[10px] text-text-secondary uppercase tracking-wider">Stop Loss</label>
            <input
              type="number"
              step="0.01"
              value={sl}
              onChange={(e) => setSl(e.target.value)}
              placeholder={isLong ? `< ${entryNum}` : `> ${entryNum}`}
              className="w-full mt-0.5 px-2 py-1.5 text-xs bg-surface-2 border border-border rounded text-text placeholder:text-text-secondary/40"
            />
          </div>
        </div>

        {error && <p className="text-[10px] text-short">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={isPending || isConfirming}
          className="w-full py-1.5 text-xs font-medium rounded bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-40 cursor-pointer"
        >
          {isPending ? 'Confirm in wallet...' : isConfirming ? 'Confirming...' : 'Set TP/SL'}
        </button>
      </div>
    </div>
  )
}
