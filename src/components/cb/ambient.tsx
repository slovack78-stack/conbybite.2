// Discreet floating bubbles and clouds. Deterministic values keep SSR and client in sync.
const BUBBLES = [
  { left: 6, size: 18, dur: 26, delay: 0 },
  { left: 18, size: 10, dur: 32, delay: 6 },
  { left: 31, size: 26, dur: 38, delay: 12 },
  { left: 47, size: 12, dur: 29, delay: 3 },
  { left: 62, size: 22, dur: 35, delay: 9 },
  { left: 74, size: 9, dur: 27, delay: 15 },
  { left: 86, size: 16, dur: 33, delay: 1 },
  { left: 94, size: 11, dur: 40, delay: 18 },
]
const CLOUDS = [
  { top: 12, w: 420, h: 120, dur: 110, delay: -20 },
  { top: 48, w: 520, h: 150, dur: 150, delay: -90 },
  { top: 78, w: 360, h: 100, dur: 130, delay: -50 },
]

export function Ambient() {
  return (
    <div className="cb-ambient" aria-hidden>
      {CLOUDS.map((c, i) => (
        <div
          key={`c${i}`}
          className="cb-cloud"
          style={{ top: `${c.top}%`, width: c.w, height: c.h, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
        />
      ))}
      {BUBBLES.map((b, i) => (
        <div
          key={`b${i}`}
          className="cb-bubble"
          style={{ left: `${b.left}%`, width: b.size, height: b.size, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}
        />
      ))}
    </div>
  )
}
