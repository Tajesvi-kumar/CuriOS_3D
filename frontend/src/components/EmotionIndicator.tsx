import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store'

export default function EmotionIndicator() {
  const { emotionState } = useStore()
  const [hovered, setHovered] = useState(false)

  const states = {
    engaged: {
      emoji: '😊',
      color: '#22c55e', // Green
      glow: '0 0 12px rgba(34, 197, 94, 0.6)',
      pulseScale: [1, 1.15, 1],
      pulseOpacity: [0.5, 0.9, 0.5],
      label: 'engaged',
      duration: 2
    },
    confused: {
      emoji: '🤔',
      color: '#f59e0b', // Amber
      glow: '0 0 12px rgba(245, 158, 11, 0.6)',
      pulseScale: [1, 1.1, 1],
      pulseOpacity: [0.4, 0.8, 0.4],
      label: 'confused',
      duration: 3
    },
    frustrated: {
      emoji: '😤',
      color: '#ef4444', // Red
      glow: '0 0 16px rgba(239, 68, 68, 0.8)',
      pulseScale: [1, 1.2, 1],
      pulseOpacity: [0.5, 1, 0.5],
      label: 'frustrated',
      duration: 1.5
    },
    bored: {
      emoji: '😴',
      color: '#9ca3af', // Gray
      glow: '0 0 8px rgba(156, 163, 175, 0.3)',
      pulseScale: [1, 1.05, 1],
      pulseOpacity: [0.2, 0.5, 0.2],
      label: 'bored',
      duration: 4
    }
  }

  const current = states[emotionState] || states.engaged

  return (
    <div 
      style={{ position: 'relative', display: 'inline-block', cursor: 'help' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={emotionState}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.5 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(17, 24, 39, 0.8)',
            border: `1px solid ${current.color}40`,
            boxShadow: current.glow,
            fontSize: '18px',
            position: 'relative'
          }}
        >
          {/* Pulsing Outer Glow Ring */}
          <motion.div
            animate={{
              scale: current.pulseScale,
              opacity: current.pulseOpacity
            }}
            transition={{
              repeat: Infinity,
              duration: current.duration,
              ease: 'easeInOut'
            }}
            style={{
              position: 'absolute',
              top: -2,
              left: -2,
              right: -2,
              bottom: -2,
              borderRadius: '50%',
              border: `2px solid ${current.color}`,
              pointerEvents: 'none'
            }}
          />
          {current.emoji}
        </motion.div>
      </AnimatePresence>

      {/* Tooltip on Hover */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              right: 0,
              top: '40px',
              width: '220px',
              padding: '8px 12px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#f3f4f6',
              fontSize: '11px',
              lineHeight: '1.4',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              zIndex: 50,
              pointerEvents: 'none'
            }}
          >
            CuriOS detected you might be <span style={{ color: current.color, fontWeight: 'bold' }}>{current.label}</span>. Adjusting explanation style...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
