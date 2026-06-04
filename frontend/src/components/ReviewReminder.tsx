import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { useStore } from '../store'
import { X, CheckCircle, XCircle, Brain, RefreshCw } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8011'

interface DueConcept {
  concept_id: string
  label: string
  subject: string
  class: number
}

interface Question {
  id: number
  type: string
  concept_tested: string
  question: string
  options: string[]
  correct_answer: string
  explanation: string
}

export default function ReviewReminder() {
  const { sessionId, studentName, studentClass, language } = useStore()
  const [dueConcepts, setDueConcepts] = useState<DueConcept[]>([])
  const [isReviewActive, setIsReviewActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [results, setResults] = useState<{ concept_id: string; isCorrect: boolean }[]>([])

  // Fetch due reviews on mount/session load
  useEffect(() => {
    if (!sessionId) return
    const fetchDue = async () => {
      try {
        const { data } = await axios.get<DueConcept[]>(`${API}/review/due?session_id=${sessionId}`)
        setDueConcepts(data || [])
      } catch (err) {
        console.error('Failed to fetch due review concepts:', err)
      }
    }
    fetchDue()
  }, [sessionId])

  const startReview = async () => {
    if (dueConcepts.length === 0) return
    setLoading(true)
    setIsReviewActive(true)
    setResults([])
    setCurrentIdx(0)
    setSelectedOption(null)
    setShowFeedback(false)

    try {
      const conceptsList = dueConcepts.map(c => c.concept_id)
      const res = await axios.post(`${API}/quiz/generate`, {
        session_id: sessionId,
        student_name: studentName,
        student_class: studentClass,
        language: language,
        concepts: conceptsList
      })
      if (res.data && res.data.questions) {
        setQuestions(res.data.questions)
      } else {
        setIsReviewActive(false)
        alert('Failed to generate review quiz.')
      }
    } catch (err) {
      console.error(err)
      alert('Could not start review.')
      setIsReviewActive(false)
    } finally {
      setLoading(false)
    }
  }

  const handleOptionSelect = async (idx: number) => {
    if (showFeedback) return
    setSelectedOption(idx)
    setShowFeedback(true)

    const current = questions[currentIdx]
    const selectedText = current.options[idx] ?? ''
    const isCorrect = selectedText.trim().toLowerCase() === current.correct_answer.trim().toLowerCase()
    
    // Quality score: 5 if perfect, 1 if wrong
    const qualityScore = isCorrect ? 5 : 1

    // Record review record immediately to backend
    try {
      await axios.post(`${API}/review/record`, {
        session_id: sessionId,
        concept_id: current.concept_tested,
        quality_score: qualityScore
      })
    } catch (err) {
      console.error('Failed to submit SM-2 review score:', err)
    }

    setResults(prev => [...prev, { concept_id: current.concept_tested, isCorrect }])

    // Wait and advance
    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1)
        setSelectedOption(null)
        setShowFeedback(false)
      } else {
        // Finished all questions
        // Refetch due reviews to clear banner
        axios.get<DueConcept[]>(`${API}/review/due?session_id=${sessionId}`)
          .then(({ data }) => setDueConcepts(data || []))
          .catch(() => {})
      }
    }, 3000)
  }

  if (dueConcepts.length === 0 && !isReviewActive) return null

  return (
    <>
      {/* Banner Reminder Notification */}
      <AnimatePresence>
        {dueConcepts.length > 0 && !isReviewActive && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
            style={{
              position: 'absolute',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              backdropFilter: 'blur(12px)',
              pointerEvents: 'auto'
            }}
          >
            <span style={{ fontSize: '16px' }}>📚</span>
            <div style={{ color: 'white', fontSize: '13px', fontWeight: '500' }}>
              {dueConcepts.length} concept{dueConcepts.length > 1 ? 's' : ''} due for review today!
            </div>
            <button
              onClick={startReview}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
              }}
            >
              Start Review
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spaced Repetition Quiz Modal */}
      <AnimatePresence>
        {isReviewActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(3, 7, 18, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              cursor: 'auto'
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '600px',
                background: 'rgba(17, 24, 39, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                borderRadius: '24px',
                padding: '24px',
                position: 'relative'
              }}
            >
              <button
                onClick={() => setIsReviewActive(false)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'rgba(31, 41, 55, 0.5)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>

              {loading && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                    style={{ color: '#10b981', display: 'inline-block', marginBottom: '16px' }}
                  >
                    <RefreshCw size={36} />
                  </motion.div>
                  <h3 style={{ color: 'white', fontWeight: 'bold' }}>Creating Spaced Review Quiz...</h3>
                  <p style={{ color: '#9ca3af', fontSize: '13px' }}>Generating targeted questions for concepts due today.</p>
                </div>
              )}

              {!loading && questions.length > 0 && results.length < questions.length && (
                <div>
                  {/* Progress Bar */}
                  <div style={{ background: '#1f2937', height: '6px', borderRadius: '3px', marginBottom: '20px' }}>
                    <div
                      style={{
                        background: '#10b981',
                        height: '100%',
                        borderRadius: '3px',
                        width: `${(currentIdx / questions.length) * 100}%`,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '11px' }}>
                    <span style={{ color: '#34d399', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      Review Question {currentIdx + 1} of {questions.length}
                    </span>
                    <span style={{ color: '#9ca3af', background: '#374151', padding: '2px 8px', borderRadius: '4px' }}>
                      SM-2 Spaced Revision
                    </span>
                  </div>

                  <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '500', marginBottom: '24px', lineHeight: '1.5' }}>
                    {questions[currentIdx].question}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {questions[currentIdx].options.map((opt, oIdx) => {
                      const isSelected = selectedOption === oIdx
                      const isCorrect = opt.trim().toLowerCase() === questions[currentIdx].correct_answer.trim().toLowerCase()

                      let btnStyle = {
                        background: 'rgba(31, 41, 55, 0.6)',
                        border: '1px solid rgba(75, 85, 99, 0.4)',
                        color: '#d1d5db'
                      }

                      if (showFeedback) {
                        if (isCorrect) {
                          btnStyle = {
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid #10b981',
                            color: '#a7f3d0'
                          }
                        } else if (isSelected) {
                          btnStyle = {
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid #ef4444',
                            color: '#fca5a5'
                          }
                        } else {
                          btnStyle = {
                            background: 'rgba(31, 41, 55, 0.2)',
                            border: '1px solid rgba(31, 41, 55, 0.4)',
                            color: '#4b5563'
                          }
                        }
                      }

                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleOptionSelect(oIdx)}
                          disabled={showFeedback}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '14px 16px',
                            borderRadius: '12px',
                            cursor: showFeedback ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s ease',
                            ...btnStyle
                          }}
                        >
                          <span>{opt}</span>
                          {showFeedback && isCorrect && <CheckCircle size={18} />}
                          {showFeedback && isSelected && !isCorrect && <XCircle size={18} />}
                        </button>
                      )
                    })}
                  </div>

                  {showFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        marginTop: '20px',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '13px',
                        lineHeight: '1.4',
                        background: 'rgba(31, 41, 55, 0.3)',
                        color: '#d1d5db'
                      }}
                    >
                      <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                        {selectedOption !== null &&
                        questions[currentIdx].options[selectedOption]?.trim().toLowerCase() ===
                          questions[currentIdx].correct_answer.trim().toLowerCase()
                          ? '🎉 Correct answer!'
                          : '😢 Incorrect answer.'}
                      </p>
                      <p>{questions[currentIdx].explanation}</p>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Quiz Results Summary */}
              {!loading && results.length > 0 && results.length === questions.length && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🏆</span>
                  <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '22px', marginBottom: '8px' }}>Spaced Review Complete!</h2>
                  <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '24px' }}>
                    Your SM-2 schedule has been recalculated and saved.
                  </p>

                  <div style={{ background: 'rgba(31, 41, 55, 0.4)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
                    <h4 style={{ color: '#9ca3af', fontSize: '11px', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 'bold' }}>Concept Schedule Summary</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {results.map((r, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                          <span style={{ color: 'white', textTransform: 'capitalize' }}>{r.concept_id.replace(/_/g, ' ')}</span>
                          <span style={{ color: r.isCorrect ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                            {r.isCorrect ? 'Mastered (Next due in days)' : 'Needs Practice (Due tomorrow)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => setIsReviewActive(false)}
                    style={{
                      width: '100%',
                      background: '#10b981',
                      color: 'white',
                      fontWeight: 'bold',
                      padding: '12px',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Finish Review
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
