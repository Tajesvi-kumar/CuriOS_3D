import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { useStore } from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function ChatArea() {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const { sessionId, studentName, studentClass, language, messages, isLoading,
          addMessage, setLoading, updateFromResponse } = useStore()

  const hasSentInitial = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Auto-send if an example question was prefilled before entering chat
  useEffect(() => {
    if (!hasSentInitial.current && messages.length === 1 && messages[0].role === 'student') {
      hasSentInitial.current = true
      const text = messages[0].content
      setLoading(true)
      axios.post(`${API}/chat`, {
        session_id: sessionId,
        student_name: studentName,
        student_class: studentClass,
        language: language,
        message: text,
      }).then(({ data }) => {
        addMessage({ role: 'curios', content: data.message })
        updateFromResponse(data)
      }).catch(() => {
        addMessage({ role: 'curios', content: 'Sorry, something went wrong. Try again!' })
      }).finally(() => setLoading(false))
    }
  }, [])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    addMessage({ role: 'student', content: text })
    setLoading(true)
    try {
      console.log('Sending to:', `${API}/chat`)
      console.log('Payload:', { session_id: sessionId, student_name: studentName, student_class: studentClass, message: text })
      const { data } = await axios.post(`${API}/chat`, {
        session_id: sessionId,
        student_name: studentName,
        student_class: studentClass,
        language: language,
        message: text,
      })
      console.log('Response:', data)
      addMessage({ role: 'curios', content: data.message })
      updateFromResponse(data)
    } catch (error) {
      console.error('Error:', error)
      addMessage({ role: 'curios', content: 'Sorry, something went wrong. Try again!' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '24px' }}>🔍</span>
        <div>
          <h1 style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>CuriOS Gap Detector</h1>
          <p style={{ color: '#9ca3af', fontSize: '11px' }}>AI Learning Diagnostics • NCERT Class 5–10</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '20px', marginBottom: '8px' }}>
              Namaste, {studentName}!
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Tell me a topic you're confused about</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '16px' }}>
              {['Why does hot air rise?', 'What is density?', 'Explain convection'].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{
                  fontSize: '12px', background: '#1f2937', color: '#d1d5db',
                  border: '1px solid #374151', borderRadius: '9999px',
                  padding: '6px 12px', cursor: 'pointer'
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'student' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'curios' && (
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: '#052e16', border: '1px solid #22c55e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', marginRight: '8px', marginTop: '4px', flexShrink: 0
              }}>🔍</div>
            )}
            <div style={{
              maxWidth: '360px', padding: '10px 14px', borderRadius: '18px',
              fontSize: '14px', lineHeight: '1.5',
              background: msg.role === 'student' ? '#16a34a' : '#1f2937',
              color: 'white',
              border: msg.role === 'curios' ? '1px solid #374151' : 'none',
              borderBottomRightRadius: msg.role === 'student' ? '4px' : '18px',
              borderBottomLeftRadius: msg.role === 'curios' ? '4px' : '18px',
            }}>
              {msg.role === 'curios' && (
                <p style={{ fontSize: '11px', color: '#4ade80', marginBottom: '4px', fontWeight: '600' }}>CuriOS 🔍</p>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: '#052e16', border: '1px solid #22c55e',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
            }}>🔍</div>
            <div style={{ background: '#1f2937', border: '1px solid #374151', padding: '10px 14px', borderRadius: '18px', borderBottomLeftRadius: '4px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 150, 300].map(delay => (
                  <div key={delay} style={{
                    width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80',
                    animation: 'bounce 1s infinite', animationDelay: `${delay}ms`
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1f2937', display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type your question or answer..."
          style={{
            flex: 1, background: '#1f2937', border: '1px solid #374151',
            borderRadius: '12px', padding: '10px 16px', color: 'white',
            fontSize: '14px', outline: 'none'
          }}
        />
        <button onClick={sendMessage} disabled={isLoading || !input.trim()} style={{
          background: '#22c55e', color: 'black', fontWeight: 'bold',
          padding: '10px 20px', borderRadius: '12px', border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1,
          fontSize: '16px'
        }}>→</button>
      </div>
    </div>
  )
}