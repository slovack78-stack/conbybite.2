export type AvatarKind = 'sphere' | 'robot'
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking'

export function Avatar({ kind, state, size = 120 }: { kind: AvatarKind; state: AvatarState; size?: number }) {
  return (
    <div className={`cb-state-${state} grid place-items-center`} style={{ width: size, height: size }} aria-hidden>
      {kind === 'sphere' ? (
        <div className="cb-orb" style={{ width: size * 0.72, height: size * 0.72 }} />
      ) : (
        <svg className="cb-robot" width={size} height={size} viewBox="0 0 120 120">
          <defs>
            <linearGradient id="rb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#1f2d52" />
              <stop offset="1" stopColor="#0d1426" />
            </linearGradient>
          </defs>
          <line x1="60" y1="14" x2="60" y2="28" stroke="#8ea0bf" strokeWidth="2" />
          <circle className="antenna" cx="60" cy="12" r="5" fill="#8b9bff" />
          <rect x="22" y="28" width="76" height="60" rx="22" fill="url(#rb)" stroke="#5ef2d6" strokeOpacity=".5" />
          <rect x="31" y="40" width="58" height="30" rx="14" fill="#060a14" />
          <circle className="eye" cx="48" cy="55" r="6" fill="#5ef2d6" />
          <circle className="eye" cx="72" cy="55" r="6" fill="#5ef2d6" />
          <rect className="mouth" x="50" y="76" width="20" height="6" rx="3" fill="#5ef2d6" />
          <rect x="14" y="48" width="8" height="20" rx="4" fill="#1f2d52" />
          <rect x="98" y="48" width="8" height="20" rx="4" fill="#1f2d52" />
          <rect x="40" y="92" width="40" height="16" rx="8" fill="#1a2744" stroke="#8b9bff" strokeOpacity=".4" />
        </svg>
      )}
    </div>
  )
}
