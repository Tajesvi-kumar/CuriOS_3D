import { create } from 'zustand'

export type GapStatus = 'suspected' | 'confirmed' | 'root' | 'fixed'

interface Message {
  role: 'student' | 'curios'
  content: string
}

interface AppState {
  sessionId: string
  studentName: string
  studentClass: number
  studentSubject: string
  language: string
  messages: Message[]
  isLoading: boolean
  gaps: Record<string, GapStatus>
  mastery: number
  propagationRisks: string[]
  emotionState: 'engaged' | 'confused' | 'frustrated' | 'bored'
  setStudent: (name: string, cls: number, subject: string) => void
  setSessionId: (id: string) => void
  setLanguage: (lang: string) => void
  addMessage: (msg: Message) => void
  setLoading: (loading: boolean) => void
  updateFromResponse: (data: any) => void
  isQuizActive: boolean
  setQuizActive: (active: boolean) => void
  updateGapsAndMastery: (gaps: Record<string, GapStatus>, mastery: number) => void
  setEmotionState: (state: 'engaged' | 'confused' | 'frustrated' | 'bored') => void
}

export const useStore = create<AppState>((set) => ({
  sessionId: 'session_' + Math.random().toString(36).substr(2, 9),
  studentName: 'Student',
  studentClass: 7,
  studentSubject: 'Mathematics',
  language: 'English',
  messages: [],
  isLoading: false,
  gaps: {},
  mastery: 100,
  propagationRisks: [],
  emotionState: 'engaged',
  setStudent: (studentName, studentClass, studentSubject) => set({ studentName, studentClass, studentSubject }),
  setSessionId: (sessionId) => set({ sessionId }),
  setLanguage: (language) => set({ language }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setLoading: (isLoading) => set({ isLoading }),
  updateFromResponse: (data) => set((state) => {
    const newGaps = data.gaps || {}
    console.log("Store gaps:", newGaps)
    return {
      gaps: newGaps,
      mastery: data.mastery ?? 100,
      propagationRisks: data.propagation_risks || [],
      emotionState: data.emotion_state || 'engaged',
    }
  }),
  isQuizActive: false,
  setQuizActive: (isQuizActive) => set({ isQuizActive }),
  updateGapsAndMastery: (gaps, mastery) => set({ gaps, mastery }),
  setEmotionState: (emotionState) => set({ emotionState }),
}))