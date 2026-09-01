import { useEffect, useState } from 'react'

interface EnvelopeSealAnimationProps {
  monogram?: string
  className?: string
}

// Auto-playing envelope seal: flap starts open with the letter peeking out,
// closes, drips wax, and stamps a monogram. Plays once on mount and holds at
// "stamped" — used inside SealingOverlay while a vault item is being
// encrypted and saved, so there's no button/reset here (see SealButton for
// the interactive preview version).
export function EnvelopeSealAnimation({ monogram = 'A', className = '' }: EnvelopeSealAnimationProps) {
  const [stage, setStage] = useState<'open' | 'closing' | 'closed' | 'waxing' | 'stamped'>('open')

  useEffect(() => {
    const timeouts = [
      setTimeout(() => setStage('closing'), 50),
      setTimeout(() => setStage('closed'), 550),
      setTimeout(() => setStage('waxing'), 700),
      setTimeout(() => setStage('stamped'), 1080),
    ]
    return () => timeouts.forEach(clearTimeout)
  }, [])

  return (
    <div className={`relative h-[180px] w-[280px] ${className}`} style={{ perspective: '800px' }}>
      {/* Envelope body */}
      <svg viewBox="0 0 280 180" className="absolute inset-0 h-full w-full">
        <rect
          x="4"
          y="4"
          width="272"
          height="172"
          rx="10"
          fill="var(--color-paper2)"
          stroke="var(--color-fog)"
          strokeWidth="1.5"
        />
        <path d="M4 14 L140 100 L276 14" fill="none" stroke="var(--color-fog)" strokeWidth="1.5" />
      </svg>

      {/* Letter peeking out — visible while the flap is open, retracts as it closes */}
      <div
        className="absolute left-1/2 top-[6px] h-[70px] w-[190px] rounded-sm transition-all duration-500"
        style={{
          transform: stage === 'open' ? 'translate(-50%, 0)' : 'translate(-50%, 46px)',
          opacity: stage === 'open' || stage === 'closing' ? 1 : 0,
          background: 'var(--color-paper)',
          border: '1px solid var(--color-fog)',
          zIndex: 1,
        }}
      />

      {/* Flap — open by default, animates flat (closed) as the letter seals */}
      <svg
        viewBox="0 0 280 180"
        className="absolute inset-0 h-full w-full transition-transform duration-500 ease-in-out"
        style={{
          transformOrigin: '140px 8px',
          transform: stage === 'open' ? 'rotateX(-150deg)' : 'rotateX(0deg)',
          zIndex: 2,
        }}
      >
        <path
          d="M4 14 L140 100 L276 14 L276 12 Q276 8 272 8 L8 8 Q4 8 4 12 Z"
          fill="var(--color-mist)"
          stroke="var(--color-fog)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Wax blob */}
      <div
        className="absolute left-1/2 top-[60px] rounded-full transition-all duration-[380ms]"
        style={{
          width: stage === 'waxing' || stage === 'stamped' ? 56 : 0,
          height: stage === 'waxing' || stage === 'stamped' ? 56 : 0,
          transform: 'translate(-50%, -50%)',
          opacity: stage === 'waxing' || stage === 'stamped' ? 1 : 0,
          background: 'radial-gradient(circle at 35% 30%, var(--color-seal), oklch(0.5 0.045 55))',
          transitionTimingFunction: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)',
        }}
      />

      {/* Monogram stamp */}
      <div
        className="absolute left-1/2 top-[60px] font-serif text-2xl font-bold transition-all duration-300"
        style={{
          transform:
            stage === 'stamped' ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(1.6)',
          opacity: stage === 'stamped' ? 1 : 0,
          color: 'var(--color-paper)',
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {monogram}
      </div>
    </div>
  )
}
