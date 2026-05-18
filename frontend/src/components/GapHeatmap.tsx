import { useState, useEffect } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, Layers, HelpCircle, AlertTriangle } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8011'

interface Concept {
  id: string
  label: string
}

interface Student {
  id: string
  student_name: string
  student_class: number
}

interface GapHeatmapData {
  students: Student[]
  concepts: Concept[]
  heatmap: Record<string, Record<string, string | null>>
}

export default function GapHeatmap() {
  const [data, setData] = useState<GapHeatmapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [subjectFilter, setSubjectFilter] = useState<'All' | 'Mathematics' | 'Science' | 'English'>('All')
  
  // Cell Detail Modal
  const [selectedCell, setSelectedCell] = useState<{
    studentName: string
    conceptLabel: string
    status: string | null
  } | null>(null)

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        setLoading(true)
        const res = await axios.get<GapHeatmapData>(`${API}/teacher/gap-heatmap`)
        setData(res.data)
      } catch (err) {
        console.error("Failed to fetch gap heatmap:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchHeatmap()
  }, [])

  if (loading || !data) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ height: '300px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
      </div>
    )
  }

  const { students, concepts, heatmap } = data

  // Filter concepts based on chosen subject
  const getSubjectConcepts = () => {
    if (subjectFilter === 'All') return concepts
    if (subjectFilter === 'Mathematics') {
      return concepts.filter(c => ['fractions', 'decimals', 'algebra_basics', 'linear_equations'].includes(c.id))
    }
    if (subjectFilter === 'Science') {
      return concepts.filter(c => ['density', 'convection', 'photosynthesis', 'conduction', 'radiation'].includes(c.id))
    }
    return concepts.filter(c => ['nouns', 'democracy'].includes(c.id))
  }

  const activeConcepts = getSubjectConcepts()

  const getCellColor = (status: string | null) => {
    if (!status) return 'rgba(255,255,255,0.02)'
    switch (status) {
      case 'root': return '#ef4444' // dark red
      case 'confirmed': return '#f59e0b' // orange
      case 'suspected': return '#fbbf24' // yellow
      case 'fixed': return '#10b981' // green
      default: return 'rgba(255,255,255,0.05)'
    }
  }

  const getStatusLabel = (status: string | null) => {
    if (!status) return 'No gap / Not tested'
    return status.toUpperCase()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Subject Filter tab bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Concept-Gap Severity Heatmap</h3>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
            Grid coordinate maps students against detected learning gaps. Click any cell for detail actions.
          </p>
        </div>

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          {['All', 'Mathematics', 'Science', 'English'].map((sub) => (
            <button
              key={sub}
              onClick={() => setSubjectFilter(sub as any)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: subjectFilter === sub ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                color: subjectFilter === sub ? '#22d3ee' : '#9ca3af',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {/* HEATMAP GRID */}
      <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
        
        {/* Color Legend */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', marginBottom: '24px', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
          <span style={{ color: '#9ca3af', fontWeight: 'bold' }}>LEGEND:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }} /> Root Gap 🔴</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f59e0b' }} /> Confirmed Gap 🟠</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#fbbf24' }} /> Suspected Gap 🟡</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} /> Fixed Gap 🟢</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }} /> Mastered / No Gap</span>
        </div>

        {/* Matrix Container */}
        <div style={{ minWidth: '800px' }}>
          
          {/* Header Row (Concepts) */}
          <div style={{ display: 'flex', marginBottom: '8px' }}>
            <div style={{ width: '180px', fontWeight: 'bold', fontSize: '12px', color: '#9ca3af' }}>Student Name</div>
            <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
              {activeConcepts.map((con) => (
                <div 
                  key={con.id} 
                  style={{ 
                    flex: 1, 
                    textAlign: 'center', 
                    fontSize: '11px', 
                    fontWeight: 'bold', 
                    color: '#9ca3af', 
                    padding: '6px', 
                    background: 'rgba(255,255,255,0.01)', 
                    borderRadius: '6px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={con.label}
                >
                  {con.label}
                </div>
              ))}
            </div>
          </div>

          {/* Matrix Rows (Students) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {students.map((st) => (
              <div key={st.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ width: '180px', fontWeight: 'bold', fontSize: '13px' }}>
                  {st.student_name}
                  <span style={{ fontSize: '10px', color: '#6b7280', display: 'block', marginTop: '2px' }}>
                    Class {st.student_class} session
                  </span>
                </div>
                
                <div style={{ flex: 1, display: 'flex', gap: '6px' }}>
                  {activeConcepts.map((con) => {
                    const status = heatmap[st.id]?.[con.id] || null
                    return (
                      <motion.div 
                        whileHover={{ scale: 1.05 }}
                        onClick={() => setSelectedCell({
                          studentName: st.student_name,
                          conceptLabel: con.label,
                          status: status
                        })}
                        key={con.id} 
                        style={{ 
                          flex: 1, 
                          height: '32px', 
                          background: getCellColor(status), 
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.05)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.3s'
                        }}
                      >
                        {status === 'root' && <span style={{ fontSize: '10px' }}>🔴</span>}
                        {status === 'confirmed' && <span style={{ fontSize: '10px' }}>🟠</span>}
                        {status === 'suspected' && <span style={{ fontSize: '10px' }}>🟡</span>}
                        {status === 'fixed' && <span style={{ fontSize: '10px' }}>🟢</span>}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* Cell details popup */}
      <AnimatePresence>
        {selectedCell && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="glass-panel animate-glow"
              style={{ padding: '24px', background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', width: '100%', maxWidth: '400px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold' }}>Concept Gap Diagnostics</h3>
                <button onClick={() => setSelectedCell(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '18px', cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>Student:</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedCell.studentName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#9ca3af' }}>Concept:</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedCell.conceptLabel}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#9ca3af' }}>Severity status:</span>
                  <span style={{ 
                    fontWeight: 'bold', 
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    background: selectedCell.status === 'root' ? 'rgba(239,68,68,0.15)' : selectedCell.status === 'confirmed' ? 'rgba(245,158,11,0.15)' : selectedCell.status === 'suspected' ? 'rgba(251,191,36,0.15)' : 'rgba(16,185,129,0.15)',
                    color: selectedCell.status === 'root' ? '#ef4444' : selectedCell.status === 'confirmed' ? '#f59e0b' : selectedCell.status === 'suspected' ? '#fbbf24' : '#10b981',
                  }}>
                    {getStatusLabel(selectedCell.status)}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setSelectedCell(null)}
                style={{ width: '100%', marginTop: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
              >
                Close Diagnostic
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
