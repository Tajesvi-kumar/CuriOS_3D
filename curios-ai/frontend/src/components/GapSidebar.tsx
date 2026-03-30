import { useStore } from '../store'

const statusStyles: Record<string, string> = {
  root:      'border-red-600 color-red',
  confirmed: 'border-orange-500 color-orange',
  suspected: 'border-yellow-500 color-yellow',
  fixed:     'border-green-500 color-green',
}

export default function GapSidebar() {
  const { studentName, studentClass, gaps, mastery, propagationRisks } = useStore()
  const gapEntries = Object.entries(gaps)

  return (
    <div style={{
      width: '220px', height: '100%', background: '#111827',
      borderRight: '1px solid #1f2937', padding: '16px',
      overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px',
      flexShrink: 0
    }}>
      {/* Profile */}
      <div style={{ borderBottom: '1px solid #1f2937', paddingBottom: '16px' }}>
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

      {/* Mastery */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ color: '#9ca3af', fontSize: '12px' }}>MASTERY</span>
          <span style={{ color: 'white', fontWeight: 'bold' }}>{mastery}%</span>
        </div>
        <div style={{ background: '#1f2937', borderRadius: '9999px', height: '6px' }}>
          <div style={{
            height: '6px', borderRadius: '9999px',
            width: `${mastery}%`,
            background: mastery > 70 ? '#22c55e' : mastery > 40 ? '#f97316' : '#ef4444',
            transition: 'width 0.5s'
          }} />
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
              background: status === 'root' ? '#1c0a0a' : status === 'confirmed' ? '#1c0e00' : '#1c1a00',
              marginBottom: '6px'
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