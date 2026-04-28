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
  setStudent: (name: string, cls: number, subject: string) => void
  setLanguage: (lang: string) => void
  addMessage: (msg: Message) => void
  setLoading: (loading: boolean) => void
  updateFromResponse: (data: any) => void
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
  setStudent: (studentName, studentClass, studentSubject) => set({ studentName, studentClass, studentSubject }),
  setLanguage: (language) => set({ language }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setLoading: (isLoading) => set({ isLoading }),
  updateFromResponse: (data) => set({
    gaps: data.gaps || {},
    mastery: data.mastery ?? 100,
    propagationRisks: data.propagation_risks || [],
  }),
}))