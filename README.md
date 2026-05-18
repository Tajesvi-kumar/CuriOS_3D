# CuriOS — AI Learning Gap Detector

> An AI-powered diagnostic tool for Indian school students (NCERT Class 5–10) that finds the **root cause** of learning gaps through conversational probing — not just tutoring.

---

## Project Structure

```
curios-ai/
├── backend/          # Python FastAPI server
│   ├── main.py
│   ├── database.py
│   ├── concept_graph.py
│   ├── prompt_builder.py
│   ├── ai_config.py
│   ├── supabase_config.py
│   ├── concept_graph.json
│   └── requirements.txt
└── frontend/         # React + Vite app
    ├── src/
    │   ├── components/
    │   ├── store.ts
    │   └── main.tsx
    └── package.json
```

---

## Tech Stack

### Frontend
| Library | Use |
|---|---|
| React 19 + TypeScript | UI framework |
| `@react-three/fiber` + `drei` | 3D canvas (Three.js) |
| `framer-motion` | Page transitions & animations |
| `zustand` | Global state management |
| `axios` | HTTP calls to FastAPI backend |
| `recharts` | Radar & bar charts |
| `tailwindcss` | Utility CSS |
| `lucide-react` | Icons |

### Backend
| Library | Use |
|---|---|
| `fastapi` + `uvicorn` | REST API server |
| `httpx` | Async HTTP client for AI APIs |
| `networkx` | Concept dependency graph |
| `supabase-py` | Database (with local JSON fallback) |
| `python-dotenv` | Environment variable loading |
| `google-generativeai` | Gemini 2.5 Flash (quiz generation) |
| Groq / NVIDIA / Ollama | Chat & analysis AI |

---

## Key Features

- **Conversational gap detection** — Gemini probes students one question at a time
- **Root cause analysis** — NetworkX traces which foundational concept is broken
- **Teacher Dashboard** — Live analytics, student roster, gap heatmap, quiz history
- **Quiz Mode** — Auto-generated quizzes targeting detected gaps
- **3D Landing Scene** — Three.js particle field with cursor-reactive camera
- **Offline-first** — Full local JSON fallback when Supabase is unreachable

---

## How It Works

1. Student enters name, class, subject, and language
2. CuriOS asks one probing question at a time via Gemini
3. Every AI response includes a hidden `<ANALYSIS>` block detecting the confused concept
4. Backend uses NetworkX to trace the root cause and propagation risks
5. Frontend visualizes gaps in real-time on the sidebar radar chart and 3D scene
6. Teacher Dashboard aggregates all sessions for classroom-level insights

---

## Running Locally

### Quick Start (Windows)
```bat
start-app.bat
```

### Manual Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
# Copy .env.example to .env and fill in your keys
uvicorn main:app --reload --port 8011
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`, backend at `http://127.0.0.1:8011`.

---

## Environment Variables

Create `backend/.env`:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
NVIDIA_API_KEY=your_nvidia_api_key
NVIDIA_MODEL=mistralai/mistral-medium-3.5-128b
USE_OLLAMA=false
```

> The app works fully offline without Supabase — all data falls back to a local JSON store automatically.

---

## Project Reference

Unisys Innovation Program — [idea.unisys.com/D9119](https://idea.unisys.com/D9119)
