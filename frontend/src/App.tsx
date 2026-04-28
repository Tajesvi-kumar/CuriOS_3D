import { useState } from 'react'
import { useStore } from './store'
import GapSidebar from './components/GapSidebar'
import ChatArea from './components/ChatArea'
import KnowledgeGraph from './components/KnowledgeGraph'

function SetupScreen({ onStart }: { onStart: () => void }) {
  const { setStudent, setLanguage } = useStore()
  const [name, setName] = useState('')
  const [cls, setCls] = useState('7')
  const [subject, setSubject] = useState('Mathematics')
  const [language, setLang] = useState('English')

  const LANGUAGES = [
    // Indian
    'English', 'Hindi', 'Bengali', 'Telugu', 'Marathi',
    'Tamil', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi',
    'Odia', 'Urdu',
    // Foreign
    'Spanish', 'French', 'German', 'Arabic', 'Portuguese',
    'Russian', 'Japanese', 'Korean', 'Chinese (Simplified)', 'Italian',
    'Turkish', 'Dutch', 'Polish', 'Swedish', 'Indonesian'
  ]

  const SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Science', 'Hindi']

  const EXAMPLE_QUESTIONS: Record<string, string[]> = {
    Mathematics: ['How do I solve 2x + 5 = 11?', 'What is a fraction?', 'How do I find the area of a triangle?'],
    Science: ['What is photosynthesis?', 'How does the water cycle work?', 'What are Newton\'s laws?'],
    English: ['What is a noun?', 'How do I write a paragraph?', 'What is the difference between simile and metaphor?'],
    'Social Science': ['What caused World War 1?', 'What is democracy?', 'How are maps made?'],
    Hindi: ['संज्ञा क्या होती है?', 'क्रिया और विशेषण में क्या अंतर है?', 'मुहावरे क्या होते हैं?'],
  }

  const handleStart = (prefill?: string) => {
    setStudent(name || 'Student', +cls, subject)
    setLanguage(language)
    if (prefill) {
      useStore.getState().addMessage({ role: 'student', content: prefill })
    }
    onStart()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative' }}>
      {/* Language picker - top right */}
      <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
        <select value={language} onChange={e => setLang(e.target.value)}
          style={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px', padding: '6px 10px', color: '#9ca3af', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
          {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '380px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔍</div>
          <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>CuriOS</h1>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '4px' }}>AI Learning Gap Detector</p>
          <p style={{ color: '#6b7280', fontSize: '12px' }}>NCERT Class 5–10</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleStart()}
            placeholder="Your name"
            style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
          />
          <select value={cls} onChange={e => setCls(e.target.value)}
            style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px', outline: 'none', width: '100%' }}>
            {[5,6,7,8,9,10].map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select value={subject} onChange={e => setSubject(e.target.value)}
            style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '12px 16px', color: 'white', fontSize: '14px', outline: 'none', width: '100%' }}>
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div style={{ marginTop: '4px' }}>
            <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: '8px' }}>Try an example question:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {EXAMPLE_QUESTIONS[subject].map(q => (
                <button key={q} onClick={() => handleStart(q)}
                  style={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '10px', padding: '8px 12px', color: '#9ca3af', fontSize: '12px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#22c55e')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#374151')}
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => handleStart()}
            style={{ background: '#22c55e', color: 'black', fontWeight: 'bold', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '15px', marginTop: '4px' }}>
            Start Learning →
          </button>
        </div>
        <p style={{ color: '#4b5563', fontSize: '11px', textAlign: 'center', marginTop: '16px' }}>
          Powered by Gemini AI • Free for students
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [started, setStarted] = useState(false)
  if (!started) return <SetupScreen onStart={() => setStarted(true)} />
  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', overflow: 'hidden' }}>
      <GapSidebar />
      <div style={{ flex: 1, minWidth: 0 }}><ChatArea /></div>
      <KnowledgeGraph />
    </div>
  )
}
