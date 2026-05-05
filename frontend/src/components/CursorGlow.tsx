import { useEffect, useRef } from 'react'

export default function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null)
  const trailsRef = useRef<HTMLDivElement[]>([])
  const mousePos = useRef({ x: 0, y: 0 })
  const trailPositions = useRef<{ x: number; y: number }[]>([])
  const TRAIL_COUNT = 12

  useEffect(() => {
    trailPositions.current = Array.from({ length: TRAIL_COUNT }, () => ({ x: 0, y: 0 }))

    const onMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
      if (glowRef.current) {
        glowRef.current.style.left = `${e.clientX}px`
        glowRef.current.style.top = `${e.clientY}px`
      }
    }

    window.addEventListener('mousemove', onMove)

    let animId: number
    const animate = () => {
      // Update trail positions with lerp
      trailPositions.current[0] = {
        x: trailPositions.current[0].x + (mousePos.current.x - trailPositions.current[0].x) * 0.3,
        y: trailPositions.current[0].y + (mousePos.current.y - trailPositions.current[0].y) * 0.3,
      }
      for (let i = 1; i < TRAIL_COUNT; i++) {
        trailPositions.current[i] = {
          x: trailPositions.current[i].x + (trailPositions.current[i - 1].x - trailPositions.current[i].x) * 0.25,
          y: trailPositions.current[i].y + (trailPositions.current[i - 1].y - trailPositions.current[i].y) * 0.25,
        }
        const el = trailsRef.current[i]
        if (el) {
          const scale = 1 - i / TRAIL_COUNT
          el.style.left = `${trailPositions.current[i].x}px`
          el.style.top = `${trailPositions.current[i].y}px`
          el.style.opacity = `${scale * 0.6}`
          el.style.transform = `translate(-50%, -50%) scale(${scale})`
        }
      }
      animId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(animId)
    }
  }, [])

  return (
    <>
      {/* Main glow spotlight */}
      <div
        ref={glowRef}
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 9999,
          left: 0,
          top: 0,
          width: '400px',
          height: '400px',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, rgba(14,165,233,0.06) 40%, transparent 70%)',
          borderRadius: '50%',
          transition: 'left 0.05s, top 0.05s',
        }}
      />
      {/* Cursor dot */}
      <div
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 10000,
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#38bdf8',
          boxShadow: '0 0 10px 3px rgba(56,189,248,0.8)',
          transform: 'translate(-50%, -50%)',
          left: 0,
          top: 0,
          transition: 'left 0.02s, top 0.02s',
          id: 'cursor-dot',
        } as React.CSSProperties}
        ref={el => {
          if (el) {
            const update = (e: MouseEvent) => {
              el.style.left = `${e.clientX}px`
              el.style.top = `${e.clientY}px`
            }
            window.addEventListener('mousemove', update)
          }
        }}
      />
      {/* Trail dots */}
      {Array.from({ length: TRAIL_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={el => { if (el) trailsRef.current[i] = el }}
          style={{
            position: 'fixed',
            pointerEvents: 'none',
            zIndex: 9998,
            width: `${8 - i * 0.4}px`,
            height: `${8 - i * 0.4}px`,
            borderRadius: '50%',
            background: `rgba(56,189,248,${0.7 - i * 0.05})`,
            boxShadow: `0 0 ${6 - i * 0.3}px rgba(56,189,248,0.5)`,
            transform: 'translate(-50%, -50%)',
            left: 0,
            top: 0,
          }}
        />
      ))}
    </>
  )
}
