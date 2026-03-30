# 🚀 CuriOS — AI Learning Gap Detector

CuriOS is an AI-powered learning system that helps students truly understand concepts by identifying **root gaps in knowledge** and guiding them to solve problems **step-by-step instead of giving direct answers**.

---

## 🧠 The Idea

Most learning platforms give:
- Direct answers ❌
- Repeated explanations ❌

CuriOS does something different:

👉 It finds *why* a student is stuck  
👉 Then helps them *fix it themselves*

---

## 💡 What Makes CuriOS Unique

- 🔍 Detects the **root cause** of confusion (not just the wrong answer)
- 🧩 Uses a **concept dependency graph** to trace missing knowledge
- 🧠 Encourages **active learning** by guiding students step-by-step
- 🚫 Does NOT give instant answers — promotes real understanding

---

## ⚙️ How It Works

1. **Student Attempts a Question**  
   Types or explains their answer

2. **AI Analysis**  
   Understands:
   - What concepts were used  
   - What was missing  
   - What was avoided  

3. **Concept Graph Traversal**  
   Tracks dependencies to find the deepest missing concept

4. **Root Gap Detection**  
   Identifies the exact concept causing the problem

5. **Guided Learning (Step-by-Step)**  
   Instead of giving answers:
   - AI asks questions  
   - Gives hints  
   - Breaks problem into steps  

6. **Micro Explanation**  
   Explains only the required concept in simple terms

7. **Verification**  
   Confirms understanding with a follow-up question

---

## 🔥 Features

- 🎯 Root Cause Learning
- 🧠 Step-by-Step Problem Solving Guidance
- 📊 Knowledge Gap Detection
- 🌐 Multilingual Support
- 📈 Progress Tracking & Reports
- 🧑‍🏫 Teacher Dashboard (optional)

---

## 🖥️ Tech Stack

### Frontend
- React + Vite + TypeScript
- Tailwind CSS
- D3.js (Knowledge Graph Visualization)
- Zustand (State Management)

### Backend
- Python + FastAPI
- NetworkX (Graph Processing)

### AI Layer
- Gemini 1.5 Flash

### Database
- Supabase PostgreSQL

---

## 🏗️ Architecture Overview

- **Client Layer** → Student Interface  
- **Backend API** → Handles logic & requests  
- **AI Engine** → Concept understanding & reasoning  
- **Graph Engine** → Dependency tracking & gap detection  
- **Database** → Stores sessions & student progress  

---

## 🎯 Goal

To shift learning from:
❌ Memorizing answers  
➡️  
✅ Understanding concepts deeply  

---

## 📌 Example

**Question:** Why does hot air rise?

Instead of giving the answer, CuriOS:
- Checks understanding of "density"
- Detects missing concept
- Explains it simply
- Guides student to derive the answer

---

## 🚀 Future Scope

- Voice-based interaction  
- More subjects & deeper concept graphs  
- Personalized learning paths  
- Advanced analytics for teachers  

---

## 📄 License

MIT License

---

## ❤️ Philosophy

> "Don’t give answers. Build understanding."
