import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { useStore } from '../store'
import { X, CheckCircle, XCircle, BrainCircuit, RefreshCw } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8001'

interface Question {
  id: number
  type: string
  concept_tested: string
  question: string
  options: string[]
  correct_answer: string
  explanation: string
}

interface QuizData {
  chapter_title: string
  total_questions: number
  questions: Question[]
}

interface QuizResult {
  concept_id: string
  old_status: string
  new_status: string
  is_correct: boolean
}

export default function QuizMode() {
  const { sessionId, studentName, studentClass, studentSubject, language, gaps, setQuizActive, updateGapsAndMastery } = useStore()
  
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<Question[]>([])
  const [chapterTitle, setChapterTitle] = useState<string>('Practice Quiz')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [answers, setAnswers] = useState<{ concept_id: string; is_correct: boolean }[]>([])
  const [results, setResults] = useState<{ results: QuizResult[], new_mastery: number, updated_gaps: any } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true)
        const knownGaps = gaps || {}
        const topics = Object.keys(knownGaps).length > 0 ? Object.keys(knownGaps) : ['algebra basics', 'linear equations', 'fractions']
        const res = await axios.post<QuizData>(`${API}/quiz/chapter`, {
          session_id: sessionId,
          student_name: studentName,
          student_class: studentClass,
          subject: studentSubject || 'Mathematics',
          chapter_no: 3,
          chapter_title: 'Data Handling',
          topics,
          language,
          known_gaps: knownGaps,
          num_questions: 10
        })
        if (res.data && res.data.questions) {
          setQuestions(res.data.questions)
          setChapterTitle(res.data.chapter_title || 'Practice Quiz')
        } else {
          setErrorMsg("Failed to generate questions. Please try again.")
        }
      } catch (err) {
        console.error(err)
        const detail =
          axios.isAxiosError(err) && err.response?.data?.detail
            ? String(err.response.data.detail)
            : "API Error: Could not generate quiz."
        setErrorMsg(detail)
      } finally {
        setLoading(false)
      }
    }
    
    fetchQuiz()
  }, [sessionId, studentName, studentClass, studentSubject, language, gaps])

  const handleOptionSelect = (idx: number) => {
    if (showFeedback || submitting) return
    
    setSelectedOption(idx)
    setShowFeedback(true)
    
    const current = questions[currentIdx]
    const selectedText = current.options[idx] ?? ''
    const isCorrect = selectedText.trim().toLowerCase() === current.correct_answer.trim().toLowerCase()
    const newAnswers = [...answers, { concept_id: current.concept_tested || `q_${current.id}`, is_correct: isCorrect }]
    setAnswers(newAnswers)
    
    setTimeout(() => {
      if (currentIdx < questions.length - 1) {
        setCurrentIdx(prev => prev + 1)
        setSelectedOption(null)
        setShowFeedback(false)
      } else {
        submitQuiz(newAnswers)
      }
    }, 3500) // 3.5 seconds to read explanation
  }

  const submitQuiz = async (finalAnswers: { concept_id: string; is_correct: boolean }[]) => {
    try {
      setSubmitting(true)
      const res = await axios.post(`${API}/quiz/submit`, {
        session_id: sessionId,
        answers: finalAnswers
      })
      setResults(res.data)
      updateGapsAndMastery(res.data.updated_gaps, res.data.new_mastery)
    } catch (err) {
      console.error(err)
      setErrorMsg("Failed to submit quiz results.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setQuizActive(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md"
    >
      <div className="absolute top-4 right-4">
        <button 
          onClick={handleClose}
          className="p-2 text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="w-full max-w-2xl bg-gray-900/80 border border-gray-700/50 rounded-2xl shadow-2xl p-6 md:p-8 relative overflow-hidden">
        
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="mb-6 text-emerald-500"
            >
              <RefreshCw size={48} />
            </motion.div>
            <h2 className="text-2xl font-bold text-white mb-2">Generating Your Quiz...</h2>
            <p className="text-gray-400">Targeting your specific learning gaps to help you improve.</p>
          </div>
        )}

        {errorMsg && !loading && (
          <div className="text-center py-20">
            <XCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Oops!</h2>
            <p className="text-red-400">{errorMsg}</p>
            <button 
              onClick={handleClose}
              className="mt-6 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg"
            >
              Close
            </button>
          </div>
        )}

        {!loading && !errorMsg && !results && questions.length > 0 && (
          <div className="relative z-10">
            {/* Progress Bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 mb-8">
              <motion.div 
                className="bg-emerald-500 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${((currentIdx) / questions.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm text-emerald-400 font-semibold tracking-wider uppercase">
                Question {currentIdx + 1} of {questions.length}
              </span>
              <span className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full">
                {chapterTitle}
              </span>
            </div>

            <h3 className="text-xl md:text-2xl font-medium text-white mb-8 leading-relaxed">
              {questions[currentIdx].question}
            </h3>

            <div className="space-y-3">
              {questions[currentIdx].options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = opt.trim().toLowerCase() === questions[currentIdx].correct_answer.trim().toLowerCase();
                
                let btnStyle = "bg-gray-800/60 border-gray-700 hover:bg-gray-700 hover:border-gray-500 text-gray-200";
                let animationProps = {};

                if (showFeedback) {
                  if (isCorrect) {
                    btnStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-100";
                    if (isSelected) animationProps = { scale: [1, 1.02, 1], transition: { duration: 0.3 } };
                  } else if (isSelected) {
                    btnStyle = "bg-red-500/20 border-red-500 text-red-100";
                    animationProps = { x: [-5, 5, -5, 5, 0], transition: { duration: 0.4 } };
                  } else {
                    btnStyle = "bg-gray-800/30 border-gray-800 text-gray-600 opacity-50";
                  }
                }

                return (
                  <motion.button
                    key={idx}
                    {...animationProps}
                    onClick={() => handleOptionSelect(idx)}
                    disabled={showFeedback || submitting}
                    className={`w-full text-left p-4 rounded-xl border ${btnStyle} transition-all duration-200 flex items-center justify-between`}
                  >
                    <span>{opt}</span>
                    {showFeedback && isCorrect && <CheckCircle size={20} className="text-emerald-500" />}
                    {showFeedback && isSelected && !isCorrect && <XCircle size={20} className="text-red-500" />}
                  </motion.button>
                )
              })}
            </div>

            <AnimatePresence>
              {showFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-6 p-4 rounded-lg border ${
                    (selectedOption !== null &&
                      questions[currentIdx].options[selectedOption]?.trim().toLowerCase() ===
                        questions[currentIdx].correct_answer.trim().toLowerCase())
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-red-500/10 border-red-500/30 text-red-200'
                  }`}
                >
                  <p className="font-bold mb-1">
                    {(selectedOption !== null &&
                      questions[currentIdx].options[selectedOption]?.trim().toLowerCase() ===
                        questions[currentIdx].correct_answer.trim().toLowerCase())
                      ? 'Correct!'
                      : 'Not quite.'}
                  </p>
                  <p className="text-sm opacity-90">{questions[currentIdx].explanation}</p>
                </motion.div>
              )}
            </AnimatePresence>
            
            {submitting && (
              <div className="mt-6 flex items-center justify-center text-emerald-400 text-sm">
                <RefreshCw size={16} className="animate-spin mr-2" />
                Analyzing your answers...
              </div>
            )}
          </div>
        )}

        {results && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <BrainCircuit size={64} className="text-emerald-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-white mb-2">Quiz Complete!</h2>
            <p className="text-gray-400 mb-8">Here's how your mastery profile updated</p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 text-center">
                <p className="text-sm text-gray-400 mb-1">Accuracy</p>
                <p className="text-2xl font-bold text-white">
                  {Math.round((results.results.filter(r => r.is_correct).length / results.results.length) * 100)}%
                </p>
              </div>
              <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 text-center">
                <p className="text-sm text-gray-400 mb-1">New Mastery Score</p>
                <p className="text-2xl font-bold text-emerald-400">{results.new_mastery}</p>
              </div>
            </div>

            <div className="space-y-3 mb-8 text-left">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Concept Updates</h4>
              {results.results.map((r, i) => (
                <div key={i} className="bg-gray-800/30 p-3 rounded-lg border border-gray-700 flex justify-between items-center">
                  <span className="text-gray-200 capitalize">{r.concept_id.replace(/_/g, ' ')}</span>
                  <div className="flex items-center space-x-2 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      r.old_status === 'fixed' ? 'bg-emerald-500/20 text-emerald-400' :
                      r.old_status === 'confirmed' ? 'bg-orange-500/20 text-orange-400' :
                      r.old_status === 'suspected' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {r.old_status}
                    </span>
                    <span className="text-gray-500">→</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      r.new_status === 'fixed' ? 'bg-emerald-500/20 text-emerald-400' :
                      r.new_status === 'confirmed' ? 'bg-orange-500/20 text-orange-400' :
                      r.new_status === 'suspected' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {r.new_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={handleClose}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-900/20"
            >
              Continue Learning
            </button>
          </motion.div>
        )}

      </div>
    </motion.div>
  )
}
