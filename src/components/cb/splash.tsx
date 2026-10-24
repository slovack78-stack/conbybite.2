import { useEffect, useRef, useState } from 'react'

const WORD = 'HELLO FRIEND'

export function Splash({ onDone }: { onDone: () => void }) {
  const [out, setOut] = useState(false)
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 3200)
    const t2 = setTimeout(() => doneRef.current(), 3900)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  const skip = () => {
    setOut(true)
    setTimeout(() => doneRef.current(), 500)
  }

  return (
    <div
      className={`cb-splash ${out ? 'is-out' : ''}`}
      onClick={skip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && skip()}
      aria-label="HELLO FRIEND — BY SLOVACK. Toque para entrar."
    >
      <div className="text-center px-4 select-none">
        <h1 className="cb-hello">
          {WORD.split('').map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.08 * i}s` }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </h1>
        <div className="cb-line" />
        <p className="cb-by">BY SLOVACK</p>
      </div>
    </div>
  )
}
