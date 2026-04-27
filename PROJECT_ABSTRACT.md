# CuriOS — AI Learning Gap Detector
## Detailed Project Abstract

---

## 📋 Project Overview

**CuriOS** ek AI-powered diagnostic tool hai jo Indian school students (NCERT Class 5–10) ke liye design kiya gaya hai. Ye sirf tutoring nahi karta — ye **root cause analysis** karta hai learning gaps ka through conversational probing. Gemini 2.5 Flash AI engine use karke, ye student ke confusion ko trace karta hai aur underlying prerequisite concepts ko identify karta hai jo missing hain.

---

## 🎯 Core Problem Statement

Traditional tutoring apps sirf answers dete hain, lekin ye nahi batate ki student ko confusion kyun ho raha hai. Agar ek Class 7 student "convection" nahi samajh raha, to problem ye nahi hai ki convection complex hai — problem ye hai ki usne Class 5 mein "density" concept properly nahi seekha. CuriOS isi root cause ko find karta hai.

---

## 🚀 Key Features

### 1. **Conversational Diagnostic Engine**
- AI ek-ek probing question puchta hai (lecture nahi deta)
- Student ke responses analyze karke hidden gaps detect karta hai
- Indian context ke analogies use karta hai (chai, cricket, monsoon, dal, auto-rickshaw)
- 27+ languages support karta hai (Hindi, English, Bengali, Tamil, etc.)

### 2. **Root Cause Analysis via Concept Graph**
- NetworkX-based directed graph jo NCERT concepts ke dependencies track karta hai
- Agar student "convection" mein confused hai, to system automatically trace karta hai ki root gap "density" hai
- Propagation risk analysis: Agar "density" broken hai, to future topics like "pressure", "buoyancy", "atmosphere" bhi fail honge

### 3. **Real-Time Gap Visualization**
- **3D Scene**: Three.js-based floating concept nodes jo gaps ko color-code karte hain
  - 🔴 Red = Root Gap (critical prerequisite missing)
  - 🟠 Orange = Confirmed Gap
  - 🟡 Yellow = Suspected Gap
  - 🟢 Green = Fixed/Understood
- **Radar Chart**: Subject-wise mastery visualization (Recharts library)
- **Live Sidebar**: Detected gaps ki list with status indicators

### 4. **Immersive 3D UI/UX**
- Full-screen 3D landing scene with:
  - Floating wireframe shapes (box, torus, sphere, icosahedron)
  - 800+ glowing particles with cyan-to-blue gradient
  - Animated grid floor
  - Pulsing glow ring
  - Cursor-reactive camera movement
- Custom glowing cursor with 12-dot animated trail
- Framer Motion page transitions (Setup → Scanning → Main)
- Glass-morphism design with backdrop blur effects

### 5. **Multilingual Support**
- 27 languages including:
  - Indian: Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Urdu
  - Foreign: Spanish, French, German, Arabic, Portuguese, Russian, Japanese, Korean, Chinese, Italian, Turkish, Dutch, Polish, Swedish, Indonesian
- AI responses automatically language mein aate hain jo user select karta hai

### 6. **Text-to-Speech Integration**
- Web Speech API use karke AI responses ko read aloud kar sakte hain
- Accessibility feature for visually impaired students

### 7. **Session Management**
- Per-session state tracking (gaps, history, mastery score)
- Conversation history maintain hota hai (last 6 messages)
- Mastery score dynamically update hota hai based on detected gaps

---

## 🛠️ Technical Architecture

### Frontend Stack
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool & dev server |
| **Three.js** | 3D graphics engine |
| **@react-three/fiber** | React wrapper for Three.js |
| **@react-three/drei** | 3D helpers (Stars, Float, OrbitControls) |
| **Framer Motion** | Page transitions & animations |
| **Zustand** | Global state management |
| **Axios** | HTTP client for API calls |
| **Recharts** | Radar chart visualization |
| **Lucide React** | Icon library |
| **Tailwind CSS** | Utility-first CSS |

### Backend Stack
| Technology | Purpose |
|------------|---------|
| **Python 3.x** | Backend language |
| **FastAPI** | REST API framework |
| **Uvicorn** | ASGI server |
| **httpx** | Async HTTP client for Gemini API |
| **Pydantic** | Request validation |
| **python-dotenv** | Environment variable management |
| **NetworkX** | Graph-based concept dependency mapping |
| **Gemini 2.5 Flash** | AI diagnostic engine (via HTTP API) |

---

## 📊 System Workflow

```
1. Student Setup
   ↓
   [Name, Class, Subject, Language selection]
   ↓
2. Scanning Animation (2.5s)
   ↓
3. Main Interface Loads
   ↓
   [3D Scene + Chat Area + Gap Sidebar]
   ↓
4. Student asks question
   ↓
5. Frontend → Backend POST /chat
   ↓
6. Backend builds system prompt with:
   - Student profile
   - Known gaps
   - Language preference
   - Conversation history
   ↓
7. Backend → Gemini API
   ↓
8. Gemini returns response with hidden <ANALYSIS> block:
   {
     "detected_concept": "density",
     "gap_status": "suspected",
     "response_to_student": "..."
   }
   ↓
9. Backend extracts analysis
   ↓
10. ConceptGraphEngine traces root gaps using NetworkX
    ↓
    [If "convection" broken → finds root gap "density"]
    ↓
11. Backend calculates:
    - Root gaps
    - Propagation risks
    - Updated mastery score
    ↓
12. Backend → Frontend JSON response
    ↓
13. Frontend updates:
    - Chat message (typewriter effect)
    - 3D scene (color-coded nodes)
    - Sidebar (gaps list + radar chart)
    - Mastery score
```

---

## 🧠 AI Prompt Engineering

### System Prompt Structure
```
You are CuriOS, an AI diagnostic engine for Indian school students.

IMPORTANT: You are NOT a tutoring chatbot. You are a DIAGNOSTIC ENGINE.
Your job is to find the ROOT CAUSE of confusion, not just explain things.

STUDENT PROFILE:
- Name: {student_name}
- Class: {student_class}
- Known gaps: {gaps_text}
- Language: {language}

RULES:
1. ALWAYS respond in {language}
2. Ask ONE probing question at a time
3. Dig DEEPER into prerequisites if confused
4. Use Indian analogies (chai, cricket, monsoon, dal, auto)
5. Keep explanations under 4 sentences

EVERY response must end with:
<ANALYSIS>
{
  "detected_concept": "concept_id or null",
  "gap_status": "confirmed OR suspected OR none"
}
</ANALYSIS>
```

---

## 📈 Concept Graph Structure

### Example Dependencies
```
matter → particles → density → pressure → atmosphere
                  ↓           ↓
                  ↓           buoyancy
                  ↓
                  convection → atmosphere

fractions → decimals → ratio → percentage
         ↓
         algebra_basics → linear_equations

cell → photosynthesis
nutrition → photosynthesis
```

### Graph Operations
1. **find_root_gaps(concept_id)**: Traces back to find deepest prerequisite gaps
2. **get_propagation_risks(concept_id)**: Returns all future topics that will fail if this concept is broken
3. **get_node_info(concept_id)**: Returns concept metadata (label, class, subject)

---

## 🎨 UI/UX Highlights

### Landing Screen
- Full-screen 3D scene with 30 floating wireframe shapes
- 800 glowing particles in cyan-blue gradient
- Animated grid floor
- Pulsing glow ring
- Cursor-reactive camera (follows mouse movement)
- Glass-morphism setup panel with:
  - Name input
  - Class dropdown (5-10)
  - Subject selector
  - Language picker (27 options)
  - Example questions per subject

### Main Interface
- **Left Sidebar (300px)**:
  - Student profile card
  - Global mastery progress bar
  - Radar chart (5 subject categories)
  - Detected gaps list (color-coded)
  - Propagation risks section
  
- **Center**: 3D concept visualization with floating orbs

- **Right Chat Area (420px)**:
  - Chat header with CuriOS branding
  - Message bubbles (student vs AI)
  - Typewriter effect for AI responses
  - Text-to-speech button
  - Loading animation ("Analyzing NCERT patterns...")
  - Input field with send button

### Custom Cursor
- Glowing circular cursor
- 12-dot animated trail that follows mouse
- Smooth lerp animation
- Disabled default cursor

---

## 🔌 API Endpoints

### 1. `GET /`
- Health check
- Returns: `{"status": "CuriOS backend is running! 🔍"}`

### 2. `GET /graph`
- Returns complete concept graph for visualization
- Response: `{"nodes": [...], "edges": [...]}`

### 3. `POST /chat`
- Main diagnostic endpoint
- Request body:
  ```json
  {
    "session_id": "uuid",
    "student_name": "Rahul",
    "student_class": 7,
    "language": "Hindi",
    "message": "How do I solve 2x + 5 = 11?"
  }
  ```
- Response:
  ```json
  {
    "message": "AI response text",
    "gaps": {"linear_equations": "suspected", "fractions": "root"},
    "root_gaps": [{"id": "fractions", "label": "Fractions", "class": 4}],
    "propagation_risks": ["Decimals", "Ratio", "Percentage"],
    "mastery": 88
  }
  ```

### 4. `GET /report/{session_id}`
- Session summary report
- Returns: mastery score, total gaps, gap details, priority action

---

## 💡 Innovation Points

1. **Root Cause Analysis**: Unlike traditional tutoring apps, CuriOS doesn't just explain — it diagnoses
2. **Graph-Based Dependency Tracking**: Uses NetworkX to model NCERT curriculum as a directed graph
3. **Multilingual AI**: Gemini automatically responds in user's preferred language
4. **Immersive 3D Visualization**: Makes abstract concepts tangible through visual representation
5. **Probing Questions**: AI asks targeted questions instead of lecturing
6. **Indian Context**: Uses culturally relevant analogies for better understanding
7. **Propagation Risk Analysis**: Predicts which future topics will fail if current gap isn't fixed

---

## 🎓 Target Audience

- **Primary**: Indian school students (Class 5-10)
- **Subjects**: Mathematics, Science, English, Social Science, Hindi
- **Curriculum**: NCERT-aligned
- **Use Cases**:
  - Self-study diagnostic tool
  - Homework help with root cause analysis
  - Exam preparation gap identification
  - Teacher tool for student assessment

---

## 🔮 Future Enhancements

1. **Video Analysis**: Upload lecture videos to detect gaps in real-time
2. **Personalized Learning Paths**: Auto-generate study plans based on detected gaps
3. **Peer Comparison**: Anonymous benchmarking against class averages
4. **Teacher Dashboard**: Track multiple students' progress
5. **Gamification**: Badges, streaks, leaderboards
6. **Offline Mode**: PWA with local AI model
7. **Voice Input**: Speech-to-text for questions
8. **AR Mode**: Visualize 3D concepts in physical space

---

## 📦 Deployment

### Local Development
```bash
# Backend
cd curios-ai/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd curios-ai/frontend
npm install
npm run dev
```

### Production
- **Frontend**: Vercel / Netlify (static build)
- **Backend**: Railway / Render / AWS Lambda
- **Database**: PostgreSQL for session persistence (future)
- **CDN**: Cloudflare for 3D assets

---

## 🏆 Competitive Advantages

| Feature | CuriOS | Traditional Tutoring Apps |
|---------|--------|---------------------------|
| Root cause analysis | ✅ | ❌ |
| Concept dependency graph | ✅ | ❌ |
| 3D visualization | ✅ | ❌ |
| 27 languages | ✅ | ❌ (usually 2-3) |
| Indian context analogies | ✅ | ❌ |
| Probing questions | ✅ | ❌ (just answers) |
| Propagation risk analysis | ✅ | ❌ |
| Free tier | ✅ | ❌ (most are paid) |

---

## 📝 Conclusion

CuriOS ek revolutionary approach hai learning diagnostics ke liye. Ye sirf answers nahi deta — ye **why** pe focus karta hai. Agar ek student Class 7 mein struggle kar raha hai, to CuriOS automatically detect kar lega ki problem Class 5 ke "density" concept mein hai. Immersive 3D UI, multilingual support, aur AI-powered root cause analysis ke saath, ye Indian students ke liye ek game-changer tool hai.

**Tagline**: "Don't just learn — diagnose and fix the root cause."

---

**Tech Stack Summary**: React + Three.js + Framer Motion + Zustand (Frontend) | FastAPI + NetworkX + Gemini AI (Backend)

**Status**: ✅ Fully functional prototype with working API integration
