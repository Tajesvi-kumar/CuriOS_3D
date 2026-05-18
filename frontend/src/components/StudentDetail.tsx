import { useState, useEffect } from 'react'
import axios from 'axios'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, Brain, Calendar, Clock, Award, CheckCircle, 
  XCircle, MessageSquare, AlertTriangle, Send, Clipboard, 
  Share2, RefreshCw, BookOpen, Layers, BarChart
} from 'lucide-react'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar, LineChart, Line, XAxis, YAxis, Tooltip
} from 'recharts'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8011'

interface Gap {
  concept_id: string
  concept_label: string
  status: string
  detected_at: string
}

interface Attempt {
  id: string
  chapter_title: string
  subject: string
  score: number
  total_questions: number
  percentage: number
  created_at: string
}

interface Answer {
  attempt_id: string
  question_text: string
  question_type: string
  student_answer: string
  correct_answer: string
  is_correct: boolean
  concept_tested: string
}

interface ChatMessage {
  role: string
  content: string
  created_at: string
}

interface StudentDetailData {
  profile: {
    id: string
    student_name: string
    student_class: number
    subject: string
    language: string
    mastery_score: number
    created_at: string
    updated_at: string
  }
  gaps: Gap[]
  quiz_attempts: Attempt[]
  quiz_answers: Answer[]
  mastery_timeline: { date: string; mastery: number }[]
  chat_messages: ChatMessage[]
}

interface Recommendations {
  priority_actions: string[]
  parent_message: string
}

export default function StudentDetail({ studentId, onBack }: { studentId: string; onBack: () => void }) {
  const [data, setData] = useState<StudentDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'gaps' | 'quizzes' | 'chat' | 'recommendations'>('overview')
  const [expandedQuizId, setExpandedQuizId] = useState<string | null>(null)
  
  // Recommendations state
  const [recs, setRecs] = useState<Recommendations | null>(null)
  const [loadingRecs, setLoadingRecs] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchStudentData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await axios.get<StudentDetailData>(`${API}/teacher/student/${studentId}`)
      setData(res.data)
      setRecs(null) // reset recommendations until requested
    } catch (e) {
      console.error("[StudentDetail] Error:", e)
      setError("Failed to load student diagnostic profile. Please ensure your active database connection is healthy.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudentData()
  }, [studentId])

  const generateRecommendations = async () => {
    try {
      setLoadingRecs(true)
      const res = await axios.post<Recommendations>(`${API}/teacher/recommendations/${studentId}`)
      setRecs(res.data)
    } catch (e) {
      console.error("Failed to generate recommendations:", e)
    } finally {
      setLoadingRecs(false)
    }
  }

  // Pre-generate recs if recommendations tab is active
  useEffect(() => {
    if (activeSubTab === 'recommendations' && !recs && !loadingRecs) {
      generateRecommendations()
    }
  }, [activeSubTab])

  if (error) {
    return (
      <div style={{ background: '#0B0C0F', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', color: 'white', padding: '32px' }}>
        <p style={{ color: '#ef4444', fontSize: '15px', fontWeight: 'bold' }}>⚠️ {error}</p>
        <button 
          onClick={onBack}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Back to Classroom Roster
        </button>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', color: 'white' }}>
        <div style={{ height: '80px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
        <div style={{ height: '300px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
      </div>
    )
  }

  const { profile, gaps, quiz_attempts, quiz_answers, mastery_timeline, chat_messages } = data

  // Radial progress calculations
  const mastery = profile.mastery_score
  const radius = 35
  const circ = 2 * Math.PI * radius
  const strokeOffset = circ - (mastery / 100) * circ

  // Radar data construction
  const conceptStrengths: Record<string, { correct: number; total: number }> = {}
  quiz_answers.forEach((ans) => {
    const concept = ans.concept_tested || 'General'
    const entry = conceptStrengths[concept] || { correct: 0, total: 0 }
    entry.total += 1
    if (ans.is_correct) {
      entry.correct += 1
    }
    conceptStrengths[concept] = entry
  })
  
  const radarData = Object.entries(conceptStrengths).map(([concept, val]) => ({
    subject: concept.replace('_', ' ').slice(0, 15),
    A: Math.round((val.correct / val.total) * 100),
    fullMark: 100
  }))

  const copyWhatsApp = () => {
    if (!recs) return
    navigator.clipboard.writeText(recs.parent_message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const openWhatsAppWeb = () => {
    if (!recs) return
    const text = encodeURIComponent(recs.parent_message)
    window.open(`https://web.whatsapp.com/send?text=${text}`, '_blank')
  }

  // Active gap highlighting helper for chat logs
  const highlightGaps = (content: string) => {
    let highlighted = content
    gaps.forEach((g) => {
      const regex = new RegExp(`\\b(${g.concept_id.replace('_', ' ')}|${g.concept_id})\\b`, 'gi')
      highlighted = highlighted.replace(regex, `<span class="px-2 py-0.5 rounded text-xs bg-red-900/60 text-red-300 font-semibold border border-red-500/20">$1</span>`)
    })
    return <div dangerouslySetInnerHTML={{ __html: highlighted }} />
  }

  return (
    <div style={{ background: '#0B0C0F', minHeight: '100vh', display: 'flex', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={onBack}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#d1d5db',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px'
              }}
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div style={{ 
              width: '52px', height: '52px', borderRadius: '50%', 
              background: 'rgba(6, 182, 212, 0.1)', color: '#22d3ee', 
              fontSize: '20px', fontWeight: 'bold', display: 'flex', 
              alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(6, 182, 212, 0.3)'
            }}>
              {profile.student_name.slice(0, 2).toUpperCase()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>{profile.student_name}</h2>
                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', color: '#9ca3af', padding: '2px 8px', borderRadius: '9999px' }}>
                  Class {profile.student_class}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#06b6d4', marginTop: '4px' }}>
                Subject: {profile.subject} • Language: {profile.language}
              </p>
            </div>
          </div>

          {/* Radial mastery gauge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '10px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <svg width="84" height="84" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="42" cy="42" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
              <motion.circle 
                cx="42" cy="42" r={radius} fill="none" 
                stroke={mastery > 70 ? '#10b981' : mastery >= 40 ? '#f59e0b' : '#ef4444'} 
                strokeWidth="6"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: strokeOffset }}
                transition={{ duration: 1 }}
                strokeLinecap="round"
              />
            </svg>
            <div>
              <p style={{ fontSize: '11px', color: '#9ca3af' }}>Overall Mastery</p>
              <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '2px', color: mastery > 70 ? '#10b981' : mastery >= 40 ? '#f59e0b' : '#ef4444' }}>
                {mastery}%
              </h3>
            </div>
          </div>
        </div>

        {/* PROFILE SUB-TABS */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: '8px', paddingBottom: '4px' }}>
          {[
            { id: 'overview', label: '📊 Overview' },
            { id: 'gaps', label: '⚠️ Gaps & Propagation' },
            { id: 'quizzes', label: '📝 Quiz History' },
            { id: 'chat', label: '💬 Chat logs' },
            { id: 'recommendations', label: '💡 AI Remediation' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                color: activeSubTab === tab.id ? '#22d3ee' : '#9ca3af',
                borderBottom: activeSubTab === tab.id ? '2px solid #22d3ee' : 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        <div style={{ minHeight: '400px' }}>
          
          {/* TAB 1: OVERVIEW */}
          {activeSubTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* STAT CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#9ca3af' }}>Active Gaps Flagged</p>
                  <h4 style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: gaps.filter(g => g.status !== 'fixed').length > 0 ? '#ef4444' : '#10b981' }}>
                    {gaps.filter(g => g.status !== 'fixed').length} Concepts
                  </h4>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#9ca3af' }}>Assessments Done</p>
                  <h4 style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px' }}>
                    {quiz_attempts.length} Quizzes
                  </h4>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#9ca3af' }}>Average Quiz Score</p>
                  <h4 style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#3b82f6' }}>
                    {quiz_attempts.length > 0 
                      ? Math.round(quiz_attempts.reduce((acc, q) => acc + q.percentage, 0) / quiz_attempts.length) 
                      : 100}%
                  </h4>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#9ca3af' }}>Gaps Patch Rate</p>
                  <h4 style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '6px', color: '#10b981' }}>
                    {gaps.length > 0 
                      ? Math.round((gaps.filter(g => g.status === 'fixed').length / gaps.length) * 100) 
                      : 100}%
                  </h4>
                </div>

              </div>

              {/* CHARTS ROW */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                
                {/* Radar chart of strengths */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <BookOpen size={16} /> Conceptual Competence Distribution
                  </h4>
                  {radarData.length > 2 ? (
                    <div style={{ width: '100%', height: 250, display: 'flex', justifyContent: 'center' }}>
                      <ResponsiveContainer>
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="rgba(255,255,255,0.1)" />
                          <PolarAngleAxis dataKey="subject" stroke="#9ca3af" fontSize={11} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#4b5563" fontSize={10} />
                          <Radar name={profile.student_name} dataKey="A" stroke="#22d3ee" fill="#06b6d4" fillOpacity={0.25} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '13px' }}>
                      Take at least 2 quizzes on different concepts to construct radar distribution map.
                    </div>
                  )}
                </div>

                {/* Line chart of mastery progression */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={16} /> Diagnostic Mastery Timeline
                  </h4>
                  <div style={{ width: '100%', height: 250 }}>
                    <ResponsiveContainer>
                      <LineChart data={mastery_timeline}>
                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                        <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={11} />
                        <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white' }} />
                        <Line type="monotone" dataKey="mastery" stroke="#10b981" strokeWidth={3} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: GAP ANALYSIS & PROPAGATION PATH */}
          {activeSubTab === 'gaps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Detailed gaps table */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '16px' }}>Detailed Learning Gaps Log</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#9ca3af' }}>
                        <th style={{ padding: '12px' }}>Concept Name</th>
                        <th style={{ padding: '12px' }}>NCERT Context</th>
                        <th style={{ padding: '12px' }}>Current Severity Status</th>
                        <th style={{ padding: '12px' }}>Logged Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gaps.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#9ca3af' }}>
                            Fantastic! No conceptual learning gaps currently logged for this student. ✅
                          </td>
                        </tr>
                      ) : (
                        gaps.map((g, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '14px', fontWeight: 'bold' }}>{g.concept_label}</td>
                            <td style={{ padding: '14px', color: '#9ca3af' }}>
                              Class {profile.student_class} {profile.subject} Core concept
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span style={{
                                padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 'bold',
                                background: g.status === 'root' ? 'rgba(239,68,68,0.15)' : g.status === 'confirmed' ? 'rgba(245,158,11,0.15)' : g.status === 'suspected' ? 'rgba(251,191,36,0.15)' : 'rgba(16,185,129,0.15)',
                                color: g.status === 'root' ? '#ef4444' : g.status === 'confirmed' ? '#f59e0b' : g.status === 'suspected' ? '#fbbf24' : '#10b981',
                              }}>
                                {g.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '14px', color: '#9ca3af' }}>
                              {new Date(g.detected_at).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CONCEPT DEPENDENCY SVG GRAPH */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Layers size={18} className="text-[#ef4444]" />
                  <h4 style={{ fontSize: '15px', fontWeight: 'bold' }}>Remediation Pathway & Propagation Risk Graph</h4>
                </div>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '24px' }}>
                  Gaps propagate from foundational rules to downstream exercises. Resolving the root node restores understanding.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0', background: 'rgba(0,0,0,0.15)', borderRadius: '12px' }}>
                  <svg width="600" height="150" viewBox="0 0 600 150" style={{ maxWidth: '100%' }}>
                    {/* Node 1 -> Node 2 Arrow */}
                    <path d="M 175 75 L 275 75" stroke="#ef4444" strokeWidth="2" strokeDasharray="5,5" />
                    <polygon points="275,75 268,70 268,80" fill="#ef4444" />

                    {/* Node 2 -> Node 3 Arrow */}
                    <path d="M 375 75 L 475 75" stroke="#fbbf24" strokeWidth="2" strokeDasharray="5,5" />
                    <polygon points="475,75 468,70 468,80" fill="#fbbf24" />

                    {/* Nodes */}
                    {/* Root Node */}
                    <g transform="translate(100, 75)">
                      <circle r="40" fill="#1e1b4b" stroke="#ef4444" strokeWidth="3" />
                      <circle r="6" fill="#ef4444" cy="-20" />
                      <text fill="white" fontSize="11" fontWeight="bold" textAnchor="middle" y="5">Fractions</text>
                      <text fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle" y="20">ROOT GAP 🔴</text>
                    </g>

                    {/* Confirmed Node */}
                    <g transform="translate(325, 75)">
                      <circle r="40" fill="#1e1b4b" stroke="#f59e0b" strokeWidth="3" />
                      <text fill="white" fontSize="11" fontWeight="bold" textAnchor="middle" y="5">Decimals</text>
                      <text fill="#f59e0b" fontSize="8" fontWeight="bold" textAnchor="middle" y="20">CONFIRMED 🟠</text>
                    </g>

                    {/* Suspected Node */}
                    <g transform="translate(525, 75)">
                      <circle r="40" fill="#1e1b4b" stroke="#fbbf24" strokeWidth="2" />
                      <text fill="white" fontSize="11" fontWeight="bold" textAnchor="middle" y="5">Algebra</text>
                      <text fill="#fbbf24" fontSize="8" fontWeight="bold" textAnchor="middle" y="20">SUSPECTED 🟡</text>
                    </g>
                  </svg>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: QUIZ HISTORY */}
          {activeSubTab === 'quizzes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {quiz_attempts.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.05)' }}>
                  This student has not completed any automated concept quizzes yet.
                </div>
              ) : (
                quiz_attempts.map((attempt) => {
                  const isExpanded = expandedQuizId === attempt.id
                  const attemptAnswers = quiz_answers.filter(ans => ans.attempt_id === attempt.id)
                  
                  return (
                    <div 
                      key={attempt.id} 
                      style={{ 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        borderRadius: '16px', 
                        overflow: 'hidden',
                        transition: 'all 0.3s'
                      }}
                    >
                      <div 
                        onClick={() => setExpandedQuizId(isExpanded ? null : attempt.id)}
                        style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ 
                            padding: '10px', borderRadius: '10px', 
                            background: attempt.percentage > 70 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', 
                            color: attempt.percentage > 70 ? '#10b981' : '#ef4444' 
                          }}>
                            <Award size={20} />
                          </div>
                          <div>
                            <h4 style={{ fontSize: '15px', fontWeight: 'bold' }}>{attempt.chapter_title}</h4>
                            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                              Score: {attempt.score} / {attempt.total_questions} ({attempt.percentage}%) • Date: {new Date(attempt.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span style={{ color: '#9ca3af' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {/* Expandable answer panel */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            style={{ overflow: 'hidden', background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                          >
                            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              <h5 style={{ fontSize: '13px', fontWeight: 'bold', color: '#06b6d4', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                Question-by-Question Analysis:
                              </h5>
                              {attemptAnswers.map((ans, idx) => (
                                <div key={idx} style={{ 
                                  padding: '12px', 
                                  background: 'rgba(255,255,255,0.01)', 
                                  border: '1px solid rgba(255,255,255,0.03)', 
                                  borderRadius: '8px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <div style={{ flex: 1, paddingRight: '12px' }}>
                                    <p style={{ fontSize: '13px', fontWeight: '500' }}>Q{idx + 1}: {ans.question_text}</p>
                                    <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '6px' }}>
                                      Concept Tested: <span style={{ color: '#3b82f6' }}>{ans.concept_tested.replace('_', ' ').toUpperCase()}</span>
                                    </p>
                                    <p style={{ fontSize: '12px', color: ans.is_correct ? '#10b981' : '#ef4444', marginTop: '4px' }}>
                                      Student Answer: "{ans.student_answer}" {ans.is_correct ? '✓' : `| Correct answer: "${ans.correct_answer}"`}
                                    </p>
                                  </div>
                                  <div style={{ color: ans.is_correct ? '#10b981' : '#ef4444' }}>
                                    {ans.is_correct ? <CheckCircle size={20} /> : <XCircle size={20} />}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* TAB 4: CHAT MESSAGES LOGS */}
          {activeSubTab === 'chat' && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '8px' }}>
                <MessageSquare size={18} className="text-[#06b6d4]" />
                <h4 style={{ fontSize: '15px', fontWeight: 'bold' }}>Tutor conversation logs</h4>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '450px', overflowY: 'auto', paddingRight: '8px' }}>
                {chat_messages.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                    No chat transcript logged yet for this session.
                  </div>
                ) : (
                  chat_messages.map((msg, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        alignSelf: msg.role === 'student' ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        background: msg.role === 'student' ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        border: msg.role === 'student' ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid rgba(255,255,255,0.05)',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        borderBottomRightRadius: msg.role === 'student' ? '2px' : '12px',
                        borderBottomLeftRadius: msg.role === 'student' ? '12px' : '2px',
                      }}
                    >
                      <p style={{ fontSize: '11px', color: msg.role === 'student' ? '#22d3ee' : '#10b981', fontWeight: 'bold', marginBottom: '4px' }}>
                        {msg.role === 'student' ? profile.student_name : 'CuriOS AI Tutor'}
                      </p>
                      <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#e5e7eb' }}>
                        {highlightGaps(msg.content)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: AI RECOMMENDATIONS ENGINE */}
          {activeSubTab === 'recommendations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {loadingRecs ? (
                <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                  <RefreshCw size={36} className="animate-spin text-[#06b6d4]" />
                  <p style={{ fontSize: '14px', color: '#9ca3af' }}>CuriOS AI is analyzing concept propagation and compiling remediation message...</p>
                </div>
              ) : recs ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
                  
                  {/* Remediation Action Checklist */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Brain size={18} className="text-[#06b6d4]" /> AI Pedagogical Action Plan
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {recs.priority_actions.map((act, idx) => (
                        <div key={idx} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.01)', borderRadius: '10px', borderLeft: '3px solid #10b981', fontSize: '13px' }}>
                          <strong>Step {idx + 1}:</strong> {act}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* WhatsApp Parental copy text */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Send size={18} className="text-[#10b981]" /> WhatsApp Parent Template
                    </h4>
                    <textarea 
                      value={recs.parent_message}
                      readOnly
                      style={{ 
                        flex: 1, 
                        background: 'rgba(0,0,0,0.2)', 
                        border: '1px solid rgba(255,255,255,0.08)', 
                        borderRadius: '12px', 
                        padding: '16px', 
                        color: '#d1d5db', 
                        fontSize: '13px', 
                        lineHeight: '1.6', 
                        resize: 'none',
                        outline: 'none',
                        marginBottom: '16px',
                        minHeight: '150px'
                      }}
                    />

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button 
                        onClick={copyWhatsApp}
                        style={{
                          flex: 1,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: 'white',
                          padding: '12px',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          transition: 'all 0.3s'
                        }}
                      >
                        <Clipboard size={16} />
                        {copied ? 'Copied! ✓' : 'Copy Message'}
                      </button>

                      <button 
                        onClick={openWhatsAppWeb}
                        style={{
                          flex: 1,
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: 'black',
                          padding: '12px',
                          borderRadius: '12px',
                          fontWeight: 'bold',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          fontSize: '13px',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                          transition: 'all 0.3s'
                        }}
                      >
                        <Share2 size={16} />
                        Open WhatsApp
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p style={{ marginBottom: '16px' }}>Request Gemini to construct an optimized recovery plan for {profile.student_name}.</p>
                  <button 
                    onClick={generateRecommendations}
                    style={{ background: '#06b6d4', color: 'black', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Generate Remediation Action Plan
                  </button>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  )
}
