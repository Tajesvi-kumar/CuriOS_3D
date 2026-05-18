import { useState, useEffect } from 'react'
import axios from 'axios'
import { motion } from 'framer-motion'
import { 
  Award, Clock, Search, ChevronRight, HelpCircle, 
  AlertTriangle, BookOpen, CheckCircle, XCircle 
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell
} from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8011'

interface Attempt {
  id: string
  session_id: string
  chapter_title: string
  subject: string
  score: number
  total_questions: number
  percentage: number
  created_at: string
  student_name: string
  student_class: number
}

interface HardestConcept {
  concept: string
  total_questions: number
  failed_count: number
  failure_rate: number
}

interface QuizAnalyticsData {
  attempts: Attempt[]
  hardest_concepts: HardestConcept[]
  avg_by_chapter: Record<string, number>
}

export default function QuizAnalytics() {
  const [data, setData] = useState<QuizAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const fetchQuizAnalytics = async () => {
      try {
        setLoading(true)
        const res = await axios.get<QuizAnalyticsData>(`${API}/teacher/quiz-analytics`)
        setData(res.data)
      } catch (err) {
        console.error("Failed to fetch quiz analytics:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchQuizAnalytics()
  }, [])

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ height: '200px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ height: '300px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
      </div>
    )
  }

  const { attempts, hardest_concepts, avg_by_chapter } = data

  // Format Recharts data for chapter averages
  const chapterChartData = Object.entries(avg_by_chapter).map(([chapter, avg]) => ({
    name: chapter.replace('Chapter ', 'Ch '),
    average: avg
  }))

  const filteredAttempts = attempts.filter(a => 
    a.student_name.toLowerCase().includes(search.toLowerCase()) ||
    a.chapter_title.toLowerCase().includes(search.toLowerCase())
  )

  const pageSize = 10
  const totalPages = Math.ceil(filteredAttempts.length / pageSize)
  const paginatedAttempts = filteredAttempts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* CHAPTER AVERAGES CHART & HARDEST CONCEPTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        
        {/* Chapter averages */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} className="text-[#06b6d4]" /> Chapter Mastery Index
          </h3>
          {chapterChartData.length > 0 ? (
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <BarChart data={chapterChartData}>
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }}
                    formatter={(val: any) => [`${val}% Class Avg`, 'Mastery']}
                  />
                  <Bar dataKey="average" fill="#06b6d4" radius={[4, 4, 0, 0]}>
                    {chapterChartData.map((entry, index) => {
                      const color = entry.average > 75 ? '#10b981' : entry.average >= 50 ? '#f59e0b' : '#ef4444'
                      return <Cell key={`cell-${index}`} fill={color} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
              No chapters tested yet.
            </div>
          )}
        </div>

        {/* Hardest Concepts lists */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} className="text-red-500" /> Hardest Concept Gaps
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '6px' }}>
            {hardest_concepts.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', marginTop: '20px' }}>
                All clear! No struggle indices have exceeded safe diagnostic limits.
              </p>
            ) : (
              hardest_concepts.map((hc, idx) => (
                <div key={idx} style={{ 
                  padding: '12px 16px', 
                  background: 'rgba(255,255,255,0.01)', 
                  borderRadius: '10px', 
                  border: '1px solid rgba(255,255,255,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 'bold' }}>{hc.concept}</h4>
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>
                      Failed by {hc.failed_count} of {hc.total_questions} tested questions
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ 
                      fontSize: '12px', 
                      fontWeight: 'bold', 
                      color: hc.failure_rate > 50 ? '#ef4444' : '#f59e0b'
                    }}>
                      {hc.failure_rate}% Fail Rate
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* QUIZ LOGS TABLE */}
      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 'bold' }}>Class Assessment Log</h3>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or assessment..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 34px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: 'white',
                outline: 'none',
                fontSize: '12px'
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                <th style={{ padding: '12px' }}>Student Name</th>
                <th style={{ padding: '12px' }}>Class</th>
                <th style={{ padding: '12px' }}>Assessment Topic</th>
                <th style={{ padding: '12px' }}>Correct Questions</th>
                <th style={{ padding: '12px' }}>Percentage Score</th>
                <th style={{ padding: '12px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                    No assessments logged.
                  </td>
                </tr>
              ) : (
                paginatedAttempts.map((att) => (
                  <tr key={att.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '14px', fontWeight: 'bold' }}>{att.student_name}</td>
                    <td style={{ padding: '14px' }}>Class {att.student_class}</td>
                    <td style={{ padding: '14px' }}>{att.chapter_title}</td>
                    <td style={{ padding: '14px' }}>
                      <span style={{ color: att.percentage > 70 ? '#10b981' : att.percentage >= 40 ? '#f59e0b' : '#ef4444' }}>
                        {att.score} / {att.total_questions}
                      </span>
                    </td>
                    <td style={{ padding: '14px', fontWeight: 'bold' }}>{att.percentage}%</td>
                    <td style={{ padding: '14px', color: '#9ca3af' }}>
                      {new Date(att.created_at).toLocaleDateString()} {new Date(att.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>
              Page {currentPage} of {totalPages} ({filteredAttempts.length} Records)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: currentPage === 1 ? 0.5 : 1 }}
              >
                Previous
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: currentPage === totalPages ? 0.5 : 1 }}
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  )
}
