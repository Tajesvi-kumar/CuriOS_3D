import { useState } from 'react'
import { motion } from 'framer-motion'

// Simple hardcoded credentials — change as needed
const TEACHER_USERNAME = 'teacher'
const TEACHER_PASSWORD = 'curios2024'

export default function TeacherLogin({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    setError('')
    setLoading(true)
    setTimeout(() => {
      if (username === TEACHER_USERNAME && password === TEACHER_PASSWORD) {
        sessionStorage.setItem('teacher_auth', 'true')
        onSuccess()
      } else {
        setError('Invalid username or password')
      }
      setLoading(false)
    }, 600)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0B0C0F',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          background: 'rgba(17,24,39,0.6)', border: '1px solid rgba(6,182,212,0.2)',
          borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '380px',
          backdropFilter: 'blur(20px)', boxShadow: '0 0 40px rgba(6,182,212,0.08)'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>👩‍🏫</div>
          <h1 style={{ color: 'white', fontSize: '22px', fontWeight: 'bold' }}>Teacher Portal</h1>
          <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '6px' }}>
            CuriOS Learning Analytics
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
              Username
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Enter username"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                padding: '11px 14px', color: 'white', fontSize: '14px',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Enter password"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                padding: '11px 14px', color: 'white', fontSize: '14px',
                outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <p style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>
              ⚠️ {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !username || !password}
            style={{
              marginTop: '6px',
              background: loading ? 'rgba(6,182,212,0.3)' : 'linear-gradient(135deg, #06b6d4, #0891b2)',
              color: 'white', fontWeight: 'bold', padding: '13px',
              borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '15px', opacity: (!username || !password) ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            {loading ? 'Verifying...' : 'Login →'}
          </button>
        </div>

        <p style={{ color: '#374151', fontSize: '11px', textAlign: 'center', marginTop: '24px' }}>
          Only authorized teachers can access this portal
        </p>
      </motion.div>
    </div>
  )
}
