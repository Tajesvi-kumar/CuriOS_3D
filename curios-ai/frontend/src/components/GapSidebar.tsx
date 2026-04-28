import { useStore } from '../store'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'

const statusStyles: Record<string, string> = {
  root:      'border-red-600 color-red',
  confirmed: 'border-orange-500 color-orange',
  suspected: 'border-yellow-500 color-yellow',
  fixed:     'border-green-500 color-green',
}

const SUBJECT_CATEGORIES: Record<string, string[]> = {
  Mathematics: ['Algebra', 'Geometry', 'Arithmetic', 'Statistics', 'Probability'],
  Science: ['Physics', 'Chemistry', 'Biology', 'Environment', 'Practical'],
  English: ['Grammar', 'Vocabulary', 'Reading', 'Writing', 'Speaking'],
  'Social Science': ['History', 'Geography', 'Civics', 'Economics', 'Sociology'],
  Hindi: ['Vyakaran', 'Shabdawali', 'Pathan', 'Lekhan', 'Kavita']
}

export default function GapSidebar() {
  const { studentName, studentClass, studentSubject, gaps, mastery, propagationRisks } = useStore()
  const gapEntries = Object.entries(gaps)

  // Generate dynamic chart data to visualize gaps
  const categories = SUBJECT_CATEGORIES[studentSubject] || SUBJECT_CATEGORIES['Mathematics']
  const gapPenalty = gapEntries.length * 8
  
  const chartData = categories.map((cat, i) => {
    // Randomize slightly for visual interest, but lower it if there are many gaps
    const randomVariation = (i * 13) % 20 
    const score = Math.max(20, Math.min(100, mastery + randomVariation - (i === 1 ? gapPenalty : gapPenalty / 2)))
    return { subject: cat, A: score, fullMark: 100 }
  })

  return (
    <div className="glass-panel" style={{
      width: '100%', height: '100%',
      borderRadius: '24px', padding: '20px',
      overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px',
      flexShrink: 0
    }}>
      {/* Profile */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: '#052e16', border: '1px solid #22c55e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#22c55e', fontWeight: 'bold', fontSize: '18px', marginBottom: '8px'
        }}>
          {studentName.charAt(0).toUpperCase()}
        </div>
        <p style={{ color: 'white', fontWeight: '600' }}>{studentName}</p>
        <p style={{ color: '#9ca3af', fontSize: '12px' }}>Class {studentClass} • NCERT</p>
      </div>

      {/* Mastery & Chart */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ color: '#9ca3af', fontSize: '12px' }}>GLOBAL MASTERY</span>
          <span style={{ color: 'white', fontWeight: 'bold' }}>{mastery}%</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '9999px', height: '6px', marginBottom: '16px' }}>
          <div style={{
            height: '6px', borderRadius: '9999px',
            width: `${mastery}%`,
            background: mastery > 70 ? '#22c55e' : mastery > 40 ? '#f97316' : '#ef4444',
            transition: 'width 0.5s'
          }} />
        </div>
        
        {/* Radar Chart */}
        <div style={{ height: '160px', width: '100%', marginTop: '8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 9 }} />
              <Radar name="Student" dataKey="A" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gaps */}
      <div>
        <p style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase' }}>
          Detected Gaps ({gapEntries.length})
        </p>
        {gapEntries.length === 0
          ? <p style={{ color: '#4b5563', fontSize: '12px' }}>No gaps found yet</p>
          : gapEntries.map(([id, status]) => (
            <div key={id} style={{
              fontSize: '11px', padding: '6px 10px', borderRadius: '8px',
              border: `1px solid ${status === 'root' ? '#dc2626' : status === 'confirmed' ? '#f97316' : status === 'suspected' ? '#eab308' : '#22c55e'}`,
              background: status === 'root' ? 'rgba(28, 10, 10, 0.6)' : status === 'confirmed' ? 'rgba(28, 14, 0, 0.6)' : 'rgba(28, 26, 0, 0.6)',
              marginBottom: '6px',
              backdropFilter: 'blur(5px)'
            }}>
              <div style={{ fontWeight: '600', color: status === 'root' ? '#f87171' : status === 'confirmed' ? '#fb923c' : '#fbbf24' }}>
                {status === 'root' ? '🔴 Root Gap' : status === 'confirmed' ? '🟠 Confirmed' : '🟡 Suspected'}
              </div>
              <div style={{ color: '#e5e7eb', marginTop: '2px', textTransform: 'capitalize' }}>
                {id.replace(/_/g, ' ')}
              </div>
            </div>
          ))
        }
      </div>

      {/* Propagation */}
      {propagationRisks.length > 0 && (
        <div>
          <p style={{ color: '#f87171', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase' }}>
            ⚠️ At Risk
          </p>
          {propagationRisks.slice(0, 5).map(risk => (
            <div key={risk} style={{
              fontSize: '11px', padding: '6px 10px', borderRadius: '8px',
              border: '1px solid #7f1d1d', background: '#1c0a0a',
              color: '#fca5a5', marginBottom: '4px'
            }}>
              {risk}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}