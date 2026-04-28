# CuriOS — AI Learning Gap Detector

An AI-powered diagnostic tool for Indian school students (NCERT Class 5–10) that finds the **root cause** of learning gaps through conversational probing — not just tutoring.

---

## Project Structure

```
curios-ai/
├── backend/        # Python FastAPI server
└── frontend/       # React + Vite app
```

---

## Frontend

**Stack:** React 19, TypeScript, Vite

| Library | Use |
|---|---|
| `@react-three/fiber` | 3D canvas renderer (React wrapper for Three.js) |
| `@react-three/drei` | Helpers — `Stars`, `Float`, `OrbitControls` |
| `three` | 3D engine — geometries, materials, particle systems |
| `framer-motion` | Page transitions, animated entry/exit of panels |
| `zustand` | Global state — session, messages, gaps, mastery score |
| `axios` | HTTP calls to the FastAPI backend |
| `recharts` | Radar chart for subject mastery visualization |
| `lucide-react` | Icons (e.g. speaker icon for text-to-speech) |
| `tailwindcss` | Utility CSS (configured via Vite plugin) |

**Key Components:**

- `LandingScene.tsx` — Full-screen 3D background with floating wireframe shapes, particle field, stars, glow ring, and cursor-reactive camera
- `CursorGlow.tsx` — Custom glowing cursor with 12-dot animated trail effect
- `App.tsx` — App state machine: Setup → Scanning → Main
- `ChatArea.tsx` — Chat UI with typewriter effect for AI responses and Web Speech API for text-to-speech
- `GapSidebar.tsx` — Live gap tracker with radar chart and color-coded gap status (root / confirmed / suspected)
- `Scene.tsx` — 3D concept node visualization in the main chat view

---

## Backend

**Stack:** Python, FastAPI

| Library | Use |
|---|---|
| `fastapi` | REST API framework |
| `uvicorn` | ASGI server to run FastAPI |
| `httpx` | Async HTTP client to call Gemini API |
| `pydantic` | Request body validation |
| `python-dotenv` | Load `.env` variables |
| `networkx` | Directed graph for concept dependency mapping |
| `google-generativeai` (via HTTP) | Gemini 2.5 Flash — the AI diagnostic engine |

**Key Modules:**

- `main.py` — FastAPI app with `/chat`, `/graph`, `/report` endpoints; manages per-session state
- `concept_graph.py` — `ConceptGraphEngine` using NetworkX to trace root gaps and propagation risks from a concept dependency graph
- `prompt_builder.py` — Builds the system prompt for Gemini with student profile, known gaps, and language preference
- `concept_graph.json` — Node/edge data for NCERT concepts (matter, density, fractions, algebra, photosynthesis, etc.)

---

## How It Works

1. Student enters name, class, subject, and language on the setup screen
2. CuriOS asks one probing question at a time via Gemini 2.5 Flash
3. Every AI response includes a hidden `<ANALYSIS>` block that detects which concept the student is confused about
4. The backend uses `networkx` to trace the root cause and find which future topics are at risk
5. The frontend visualizes gaps in real-time on the sidebar radar chart and 3D scene

---

## Running Locally

**Backend:**
```bash
cd curios-ai/backend
pip install fastapi uvicorn httpx python-dotenv networkx
# Add GEMINI_API_KEY to .env
uvicorn main:app --reload
```

**Frontend:**
```bash
cd curios-ai/frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`, backend at `http://localhost:8000`.
