from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json, re, httpx, traceback, random, uuid
from datetime import datetime
from typing import Any
from dotenv import load_dotenv
from concept_graph import engine
from prompt_builder import build_chat_prompt, build_analysis_prompt, build_quiz_prompt
from ai_config import (
    GROQ_MODEL,
    OLLAMA_MODEL,
    OLLAMA_URL,
    USE_OLLAMA,
    CEREBRAS_API_KEY,
    CEREBRAS_MODEL,
    call_ai,
    call_groq,
    call_gemini, # ADDED
    extract_json,
)
from database import (
    create_session,
    ensure_db_session,
    get_chapters,
    get_chapter_attempts,
    get_chat_messages, # ADDED
    get_session,
    get_session_gaps,
    save_chat_message,
    save_quiz_answers,
    save_quiz_attempt,
    upsert_gap,
    update_mastery,
    get_teacher_overview_data,
    get_all_student_sessions,
    get_student_detail_data,
    get_quiz_analytics_data,
    get_gap_heatmap_data,
)

load_dotenv()

app = FastAPI(title="CuriOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions = {}

def build_local_session(session_id: str, student_name: str, student_class: int, subject: str, language: str):
    now = datetime.utcnow().isoformat()
    return {
        "gaps": {},
        "history": [],
        "mastery": 100,
        "student_name": student_name,
        "student_class": student_class,
        "subject": subject,
        "language": language,
        "created_at": now,
        "updated_at": now,
        "quiz_attempts": [],
        "quiz_answers": [],
    }


def persist_local_quiz_attempt(session_id: str, attempt: dict, answers: list[dict]):
    session = sessions.setdefault(session_id, build_local_session(session_id, "Student", 7, "General", "English"))
    session.setdefault("quiz_attempts", []).append(attempt)
    session.setdefault("quiz_answers", []).extend(answers)
    session["updated_at"] = datetime.utcnow().isoformat()
    return session

class ChatRequest(BaseModel):
    session_id: str
    student_name: str
    student_class: int
    language: str = "English"
    message: str

class QuizGenerateRequest(BaseModel):
    session_id: str
    student_name: str
    student_class: int
    language: str = "English"

class QuizChapterRequest(BaseModel):
    session_id: str
    student_name: str
    student_class: int
    subject: str
    chapter_no: int
    chapter_title: str
    topics: list[str]
    language: str = "English"
    known_gaps: dict[str, Any] = {}
    num_questions: int = 10

class QuizAnswer(BaseModel):
    concept_id: str
    is_correct: bool

class SessionCreateRequest(BaseModel):
    student_name: str
    student_class: int
    subject: str
    language: str = "English"

class QuizSubmitAnswer(BaseModel):
    question_text: str
    type: str
    student_answer: str
    correct_answer: str
    is_correct: bool
    concept_tested: str

class QuizSubmitRequest(BaseModel):
    session_id: str
    chapter_id: str | None = None
    chapter_title: str | None = None
    subject: str | None = None
    score: int | None = None
    total_questions: int | None = None
    concept_analysis: dict[str, Any] = {}
    new_gaps: list[dict[str, Any] | str] = []
    answers: list[dict[str, Any]]



def extract_analysis(text: str) -> dict:
    try:
        match = re.search(r'<ANALYSIS>(.*?)</ANALYSIS>', text, re.DOTALL)
        if match:
            return json.loads(match.group(1).strip())
    except:
        pass
    return {}

def extract_json_object(text: str) -> dict:
    try:
        return json.loads(text.strip())
    except Exception:
        pass

    try:
        fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.DOTALL)
        if fenced:
            return json.loads(fenced.group(1).strip())
    except Exception:
        pass

    try:
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last != -1 and last > first:
            return json.loads(text[first:last + 1])
    except Exception:
        pass

    return {}

def build_fallback_chapter_quiz(num_questions: int, chapter_title: str, topics: list[str], language: str) -> list[dict[str, Any]]:
    safe_topics = topics if topics else ["core concept"]
    total = max(1, int(num_questions or 10))
    mcq_count = max(1, round(total * 0.6))
    tf_count = max(1, total - mcq_count)
    while mcq_count + tf_count > total:
        tf_count = max(1, tf_count - 1)
    while mcq_count + tf_count < total:
        mcq_count += 1

    questions: list[dict[str, Any]] = []
    qid = 1
    rng = random.SystemRandom()
    shuffled_topics = safe_topics[:]
    rng.shuffle(shuffled_topics)
    if not shuffled_topics:
        shuffled_topics = ["core concept"]

    is_hindi = language.strip().lower().startswith("hindi")

    mcq_stems_en = [
        "In {chapter}, which statement best explains '{topic}'?",
        "Pick the most accurate idea about '{topic}' from chapter {chapter}.",
        "For {chapter}, identify the correct understanding of '{topic}'.",
    ]
    mcq_stems_hi = [
        "{chapter} mein '{topic}' ka sahi arth kaunsa hai?",
        "{chapter} ke hisaab se '{topic}' ko sabse sahi kaun samjhata hai?",
        "'{topic}' ke liye sahi vichar chuniye ({chapter}).",
    ]

    tf_stems_en = [
        "True or False: In {chapter}, '{topic}' should be applied step-by-step.",
        "True or False: '{topic}' from {chapter} can be solved without understanding basics.",
        "True or False: In {chapter}, checking units/logic helps in '{topic}'.",
    ]
    tf_stems_hi = [
        "True ya False: {chapter} mein '{topic}' ko step-by-step apply karna chahiye.",
        "True ya False: {chapter} ka '{topic}' bina basics samjhe solve ho sakta hai.",
        "True ya False: {chapter} mein '{topic}' karte waqt logic check karna zaroori hai.",
    ]

    for i in range(mcq_count):
        topic = shuffled_topics[i % len(shuffled_topics)]
        stem_pool = mcq_stems_hi if is_hindi else mcq_stems_en
        question_text = rng.choice(stem_pool).format(chapter=chapter_title, topic=topic)

        if is_hindi:
            correct = f"{topic} ka sahi concept"
            options = [
                correct,
                f"{topic} ki aam galatfahmi",
                "Dusre chapter ka rule",
                f"{topic} par andaza",
            ]
            explanation = f"Yeh question {chapter_title} ke '{topic}' ka core understanding check karta hai."
        else:
            correct = f"Correct understanding of {topic}"
            options = [
                correct,
                f"Common misconception about {topic}",
                "Unrelated rule from another chapter",
                f"Random guess about {topic}",
            ]
            explanation = f"This checks core understanding of {topic} from chapter {chapter_title}."

        rng.shuffle(options)
        questions.append({
            "id": qid,
            "type": "mcq",
            "question": question_text,
            "options": options,
            "correct_answer": correct,
            "explanation": explanation,
            "concept_tested": topic,
            "difficulty": (i % 3) + 1,
        })
        qid += 1

    for i in range(tf_count):
        topic = shuffled_topics[(i + mcq_count) % len(shuffled_topics)]
        stem_pool = tf_stems_hi if is_hindi else tf_stems_en
        question_text = rng.choice(stem_pool).format(chapter=chapter_title, topic=topic)
        if is_hindi:
            explanation = f"{topic} ko samajhkar step-wise apply karne se galtiyan kam hoti hain."
        else:
            explanation = f"Applying {topic} step-by-step reduces mistakes in classwork and exams."

        questions.append({
            "id": qid,
            "type": "true_false",
            "question": question_text,
            "options": ["True", "False"],
            "correct_answer": "True",
            "explanation": explanation,
            "concept_tested": topic,
            "difficulty": ((i + mcq_count) % 3) + 1,
        })
        qid += 1

    return questions

def extract_quiz(text: str) -> dict:
    try:
        match = re.search(r'<QUIZ>(.*?)</QUIZ>', text, re.DOTALL)
        if match:
            return json.loads(match.group(1).strip())
    except:
        pass
    return {}

def extract_student_message(text: str) -> str:
    clean = re.sub(r'<ANALYSIS>.*?</ANALYSIS>', '', text, flags=re.DOTALL)
    return clean.strip()

def clean_json_response(text: str) -> dict:
    try:
        cleaned = text.replace("```json", "").replace("```", "").strip()
        return json.loads(cleaned)
    except Exception:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError("No valid JSON found")


def build_safe_chat_fallback(student_message: str, language: str) -> str:
    text = (student_message or "").strip()
    if language.strip().lower().startswith("hindi"):
        if text:
            return f"Mujhe thodi technical problem aa rahi hai, par hum continue karte hain. '{text}' solve karne ka pehla step aap kya loge?"
        return "Mujhe thodi technical problem aa rahi hai, par hum continue karte hain. Aap iss topic me pehla step kya samajhte ho?"
    if text:
        return f"I am facing a temporary issue, but let's continue. For '{text}', what do you think is the first step?"
    return "I am facing a temporary issue, but let's continue. What do you think is the first step to solve this?"


def build_local_analysis(student_message: str) -> dict[str, Any]:
    text = (student_message or "").lower()
    keyword_map = {
        "algebra_basics": ["algebra", "equation", "variable", "2x", "x+"],
        "linear_equations": ["linear equation", "2x", "solve x", "ax+b"],
        "fractions": ["fraction", "1/2", "3/4", "denominator", "numerator"],
        "density": ["density", "mass per volume", "float", "sink"],
        "convection": ["convection", "hot air rises", "warm air"],
        "decimals": ["decimal", "point"],
        "percentage": ["percent", "percentage", "%"],
    }

    for concept, keys in keyword_map.items():
        if any(k in text for k in keys):
            return {
                "detected_concept": concept,
                "gap_status": "suspected",
                "confidence": 0.45,
            }
    return {
        "detected_concept": None,
        "gap_status": "none",
        "confidence": 0.2,
    }

@app.get("/")
def root():
    return {"status": "CuriOS backend is running! 🔍"}

@app.get("/ai/status")
async def ai_status():
    if CEREBRAS_API_KEY:
        mode = "cerebras"
    else:
        mode = "ollama" if USE_OLLAMA else "groq"

    ollama_status = "skipped"
    ollama_detail = ""
    groq_status = "unconfigured"
    groq_detail = "Set GROQ_API_KEY in backend/.env"
    cerebras_status = "unconfigured"
    cerebras_detail = "Set CEREBRAS_API_KEY in backend/.env"

    if USE_OLLAMA:
        ollama_status = "connected"
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                tags_response = await client.get(f"{OLLAMA_URL}/api/tags")
                tags_response.raise_for_status()
                probe_response = await client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": "Hi",
                        "stream": False,
                        "options": {"num_predict": 8},
                    },
                )
                if probe_response.status_code != 200:
                    ollama_status = "error"
                    ollama_detail = f"Ollama generate failed: HTTP {probe_response.status_code}"
                else:
                    probe_data = probe_response.json()
                    probe_text = (probe_data.get("response") or "").strip()
                    if not probe_text:
                        ollama_status = "error"
                        ollama_detail = "Ollama generate returned empty text"
        except Exception as e:
            ollama_status = "error"
            ollama_detail = str(e)

    groq_key = (os.getenv("GROQ_API_KEY") or "").strip()
    if groq_key:
        groq_status = "connected"
        groq_detail = ""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {groq_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": GROQ_MODEL,
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 5,
                    },
                )
                if r.status_code != 200:
                    groq_status = "error"
                    groq_detail = r.text[:400]
        except Exception as e:
            groq_status = "error"
            groq_detail = str(e)

    if CEREBRAS_API_KEY:
        cerebras_status = "connected"
        cerebras_detail = ""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    "https://api.cerebras.ai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {CEREBRAS_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": CEREBRAS_MODEL,
                        "messages": [{"role": "user", "content": "ping"}],
                        "max_tokens": 5,
                    },
                )
                if r.status_code != 200:
                    cerebras_status = "error"
                    cerebras_detail = r.text[:400]
        except Exception as e:
            cerebras_status = "error"
            cerebras_detail = str(e)

    if mode == "cerebras":
        status, detail = cerebras_status, cerebras_detail
    elif mode == "ollama":
        status, detail = ollama_status, ollama_detail
    else:
        status, detail = groq_status, groq_detail

    return {
        "mode": mode,
        "ollama_url": OLLAMA_URL,
        "model": CEREBRAS_MODEL if mode == "cerebras" else (OLLAMA_MODEL if USE_OLLAMA else GROQ_MODEL),
        "groq_model": GROQ_MODEL,
        "cerebras_model": CEREBRAS_MODEL,
        "status": status,
        "detail": detail,
        "ollama_status": ollama_status,
        "ollama_detail": ollama_detail,
        "groq_status": groq_status,
        "groq_detail": groq_detail,
        "cerebras_status": cerebras_status,
        "cerebras_detail": cerebras_detail,
    }

@app.get("/graph")
def get_graph():
    return engine.get_all_nodes_with_edges()

@app.get("/chapters/{class_no}/{subject}")
def chapters_by_class_subject(class_no: int, subject: str):
    try:
        chapters = get_chapters(class_no, subject)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch chapters: {str(e)}")

    if not chapters:
        raise HTTPException(status_code=404, detail="No chapters found")

    return {
        "class_no": class_no,
        "subject": subject,
        "total": len(chapters),
        "chapters": chapters
    }

@app.post("/session/create")
def create_student_session(req: SessionCreateRequest):
    try:
        session_id = None
        try:
            session_id = create_session(
                student_name=req.student_name,
                student_class=req.student_class,
                subject=req.subject,
                language=req.language
            )
        except Exception as db_err:
            print(f"[WARN] Database session creation failed: {db_err}")
            # Generate a local fallback session ID if DB fails
            import uuid
            session_id = f"local_{uuid.uuid4().hex[:8]}"

        if not session_id:
            raise HTTPException(status_code=500, detail="Session could not be created")
        
        # Pre-warm in-memory store with metadata so local-only sessions are visible in teacher reports.
        sessions[session_id] = build_local_session(
            session_id,
            req.student_name,
            req.student_class,
            req.subject,
            req.language,
        )
        return {
            "session_id": session_id,
            "student_name": req.student_name,
            "student_class": req.student_class,
            "subject": req.subject,
            "language": req.language,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@app.get("/session/{session_id}/gaps")
def fetch_session_gaps(session_id: str):
    try:
        gaps = get_session_gaps(session_id)
        return {"gaps": gaps}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch session gaps: {str(e)}")

@app.get("/session/{session_id}/attempts")
def fetch_chapter_attempts(session_id: str):
    try:
        attempts = get_chapter_attempts(session_id)
        return {"attempts": attempts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch chapter attempts: {str(e)}")

@app.post("/chat")
async def chat(req: ChatRequest):
    if req.session_id not in sessions:
        db_session = None
        db_gaps = []
        db_history = []
        try:
            db_session = get_session(req.session_id)
            db_gaps = get_session_gaps(req.session_id)
            db_history = get_chat_messages(req.session_id)
        except Exception as e:
            print(f"[WARN] Failed to fetch session data from DB: {e}")
        
        if db_session:
            sessions[req.session_id] = {
                "gaps": {gap["concept_id"]: gap["status"] for gap in db_gaps if gap.get("concept_id")},
                "history": [{"role": m["role"], "content": m["content"]} for m in db_history],
                "mastery": db_session.get("mastery_score", 100) or 100,
                "student_name": db_session.get("student_name", req.student_name),
                "student_class": db_session.get("student_class", req.student_class),
                "subject": db_session.get("subject", "General"),
                "language": db_session.get("language", req.language),
                "created_at": db_session.get("created_at"),
                "updated_at": db_session.get("updated_at"),
                "quiz_attempts": [],
                "quiz_answers": [],
            }
        else:
            sessions[req.session_id] = build_local_session(
                req.session_id,
                req.student_name,
                req.student_class,
                "General",
                req.language,
            )
            # Ensure the session row exists in Supabase (non-blocking: never crash /chat)
            try:
                ensure_db_session(
                    session_id=req.session_id,
                    student_name=req.student_name,
                    student_class=req.student_class,
                    subject="General",
                    language=req.language,
                )
            except Exception:
                pass

    session = sessions[req.session_id]
    known_gaps = [k for k, v in session["gaps"].items() if v in ["confirmed", "root"]]
    
    chat_prompt = build_chat_prompt(req.student_name, req.student_class, known_gaps, req.language)
    analysis_prompt = build_analysis_prompt(req.student_name, req.student_class, known_gaps, req.language)
    
    history_text = ""
    for msg in session["history"][-6:]:
        role = "STUDENT" if msg["role"] == "student" else "CURIOS"
        history_text += f"{role}: {msg['content']}\n"
    
    full_chat_prompt = f"{chat_prompt}\n\nCONVERSATION SO FAR:\n{history_text}\nSTUDENT: {req.message}\nCURIOS:"
    full_analysis_prompt = f"{analysis_prompt}\n\nCONVERSATION SO FAR:\n{history_text}\nSTUDENT: {req.message}\n"
    
    import asyncio
    try:
        # Only 1 AI call for chat — analysis uses fast local keyword matching
        chat_out = await call_ai(full_chat_prompt)
        student_message = chat_out
        analysis_text = json.dumps(build_local_analysis(req.message))
    except Exception as e:
        print(f"[ERROR] /chat unexpected failure: {e}")
        traceback.print_exc()
        student_message = build_safe_chat_fallback(req.message, req.language)
        analysis_text = json.dumps(build_local_analysis(req.message))
    
    analysis = extract_json(analysis_text)

    # LLMs can occasionally return malformed/non-JSON analysis.
    # In that case, fall back to deterministic keyword analysis so graph/gaps still update.
    detected_concept = analysis.get("detected_concept")
    gap_status = analysis.get("gap_status", "none")
    if not detected_concept or gap_status == "none":
        local_analysis = build_local_analysis(req.message)
        if local_analysis.get("detected_concept"):
            detected_concept = local_analysis.get("detected_concept")
            gap_status = local_analysis.get("gap_status", "suspected")
    root_gaps = []
    propagation_risks = []
    
    if detected_concept and gap_status in ["confirmed", "suspected"]:
        session["gaps"][detected_concept] = gap_status
        root_gap_ids = engine.find_root_gaps(detected_concept)
        for rg in root_gap_ids:
            session["gaps"][rg] = "root"
        root_gaps = [engine.get_node_info(rg) for rg in root_gap_ids]
        propagation_risks = engine.get_propagation_risks(detected_concept)
        gap_count = sum(1 for v in session["gaps"].values() if v in ["confirmed", "root"])
        session["mastery"] = max(0, 100 - (gap_count * 12))
    
    session["history"].append({"role": "student", "content": req.message})
    session["history"].append({"role": "curios", "content": student_message})

    # ── Persist to Supabase (fire-and-forget; never crash /chat on DB errors) ──
    try:
        save_chat_message(req.session_id, "student", req.message)
        save_chat_message(req.session_id, "curios", student_message)
    except Exception as e:
        print(f"[WARN] chat_messages persist failed: {e}")

    if detected_concept and gap_status in ["confirmed", "suspected"]:
        try:
            node_info = engine.get_node_info(detected_concept)
            upsert_gap(
                session_id=req.session_id,
                concept_id=detected_concept,
                concept_label=node_info.get("label", detected_concept),
                status=gap_status,
            )
            # Find root gaps
            root_gap_ids = engine.find_root_gaps(detected_concept)
            for rg in root_gap_ids:
                rg_info = engine.get_node_info(rg)
                upsert_gap(
                    session_id=req.session_id,
                    concept_id=rg,
                    concept_label=rg_info.get("label", rg),
                    status="root",
                )
        except Exception as e:
            print(f"[WARN] gaps persist failed: {e}")

        try:
            update_mastery(req.session_id, session["mastery"])
        except Exception as e:
            print(f"[WARN] mastery persist failed: {e}")

    return {
        "message": student_message,
        "gaps": session["gaps"],
        "root_gaps": root_gaps,
        "propagation_risks": propagation_risks,
        "mastery": session["mastery"]
    }

@app.get("/report/{session_id}")
def get_report(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    session = sessions[session_id]
    found_gaps = {k: v for k, v in session["gaps"].items() if v in ["confirmed", "root"]}
    root_gaps = [k for k, v in found_gaps.items() if v == "root"]
    priority = f"Fix '{root_gaps[0].replace('_', ' ')}' first" if root_gaps else "No critical gaps found!"
    return {
        "mastery": session["mastery"],
        "total_gaps": len(found_gaps),
        "gaps": [{**engine.get_node_info(k), "status": v} for k, v in found_gaps.items()],
        "priority_action": priority
    }

@app.post("/quiz/generate")
async def generate_quiz(req: QuizGenerateRequest):
    if req.session_id not in sessions:
        db_session = None
        db_gaps = []
        db_history = []
        try:
            db_session = get_session(req.session_id)
            if db_session:
                db_gaps = get_session_gaps(req.session_id)
                db_history = get_chat_messages(req.session_id)
        except Exception:
            # Non-UUID or unknown session IDs should continue in local-memory mode.
            db_session = None

        if db_session:
            sessions[req.session_id] = {
                "gaps": {gap["concept_id"]: gap["status"] for gap in db_gaps if gap.get("concept_id")},
                "history": [{"role": m["role"], "content": m["content"]} for m in db_history],
                "mastery": db_session.get("mastery_score", 100) or 100,
                "student_name": db_session.get("student_name", req.student_name),
                "student_class": db_session.get("student_class", req.student_class),
                "subject": db_session.get("subject", "General"),
                "language": db_session.get("language", req.language),
                "created_at": db_session.get("created_at"),
                "updated_at": db_session.get("updated_at"),
                "quiz_attempts": [],
                "quiz_answers": [],
            }
        else:
            # Fallback for old frontend flow that generates random local session IDs
            sessions[req.session_id] = build_local_session(
                req.session_id,
                req.student_name,
                req.student_class,
                "General",
                req.language,
            )
    
    session = sessions[req.session_id]
    # Identify gaps to test
    target_gaps = [k for k, v in session["gaps"].items() if v in ["suspected", "confirmed", "root"]]
    
    # If no gaps, just pick a few general topics from the graph for the student's class
    if not target_gaps:
        all_nodes = list(engine.node_data.keys())
        import random
        random.shuffle(all_nodes)
        target_gaps = all_nodes[:3] # fallback random nodes

    # Build chat history string to pass to prompt builder
    history_text = ""
    for msg in session.get("history", [])[-10:]: # Get last 10 messages for context
        role = "STUDENT" if msg["role"] == "student" else "CURIOS"
        history_text += f"{role}: {msg['content']}\n"

    # Add a random element to the prompt to force variety
    random_seed = __import__('random').randint(1, 10000)
    prompt = build_quiz_prompt(req.student_name, req.student_class, target_gaps, req.language, chat_history=history_text)
    prompt += f"\n\nRandom session marker: {random_seed}-{__import__('time').time()}"

    try:
        # Use Gemini for quiz generation as requested
        raw_text = await call_gemini(prompt)
        print(f"DEBUG: Raw Gemini Quiz Response: {raw_text[:500]}...")
    except Exception as e:
        print(f"[ERROR] /quiz/generate Gemini failed: {e}")
        __import__('traceback').print_exc()
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
    
    quiz_data = extract_quiz(raw_text)
    if not quiz_data or "questions" not in quiz_data:
        # Fallback parsing or error
        raise HTTPException(status_code=500, detail="Failed to parse quiz from Gemini")
    
    # Normalize questions for frontend
    normalized_questions = []
    for i, q in enumerate(quiz_data["questions"], start=1):
        q_text = str(q.get("question", "No question text")).strip()
        q_type = str(q.get("type", q.get("question_type", "mcq"))).lower()
        
        # Enhanced type detection from question text and content
        if "true" in q_type or "false" in q_type or "true or false" in q_text.lower():
            q_type = "true_false"
            options = ["True", "False"]
        else:
            q_type = "mcq"
            options = q.get("options", [])
            
        # Robust options check
        if not isinstance(options, list) or len(options) < 2:
            if q_type == "true_false":
                options = ["True", "False"]
            else:
                # If MCQ options are missing, try to find them in the question text or use generic ones
                options = ["Option A", "Option B", "Option C", "Option D"]
        
        # Ensure all options are strings and cleaned
        options = [str(opt).strip() for opt in options]

        # Handle different correct answer key names
        correct_val = q.get("correct_answer", q.get("correct_index", q.get("answer", "")))
        correct_answer = str(correct_val).strip()
        
        # If correct_answer is an index, try to get the text from options
        if correct_answer.isdigit() and int(correct_answer) < len(options):
            correct_answer = options[int(correct_answer)]
        
        # If correct_answer for True/False is a boolean or case-mismatched
        if q_type == "true_false":
            if "true" in correct_answer.lower() or correct_val is True:
                correct_answer = "True"
            else:
                correct_answer = "False"
        
        # Final safety check for MCQ correct_answer
        if q_type == "mcq" and correct_answer not in options:
            if options:
                correct_answer = options[0]
            else:
                options = ["Option A", "Option B", "Option C", "Option D"]
                correct_answer = "Option A"
        
        normalized_questions.append({
            "id": i,
            "type": q_type,
            "question": q_text,
            "options": options,
            "correct_answer": correct_answer,
            "explanation": str(q.get("explanation", "Review the concept discussed.")),
            "concept_tested": str(q.get("concept_tested", q.get("concept_id", "general")))
        })

    # Ensure structure matches frontend expectations
    return {
        "chapter_title": "Diagnostic Quiz",
        "total_questions": len(normalized_questions),
        "questions": normalized_questions
    }

@app.post("/quiz/chapter")
async def generate_chapter_quiz(req: QuizChapterRequest):
    print(
        f"[DEBUG] /quiz/chapter request: session_id={req.session_id}, class={req.student_class}, "
        f"subject={req.subject}, chapter_no={req.chapter_no}, chapter_title={req.chapter_title}, "
        f"topics={req.topics}, language={req.language}, num_questions={req.num_questions}"
    )

    chapters = []
    try:
        chapters = get_chapters(req.student_class, req.subject) or []
        print(
            f"[DEBUG] /quiz/chapter Supabase chapters fetch: class={req.student_class}, "
            f"subject={req.subject}, count={len(chapters)}"
        )
    except Exception as e:
        print(f"[WARN] /quiz/chapter Supabase fetch failed, continuing with request payload: {e}")
        print(traceback.format_exc())

    chapter_match = next((c for c in chapters if c.get("chapter_no") == req.chapter_no), None)
    chapter_title = chapter_match.get("title", req.chapter_title) if chapter_match else req.chapter_title
    chapter_topics = chapter_match.get("topics", req.topics) if chapter_match else req.topics
    use_cloud_quiz = os.getenv(
        "QUIZ_USE_CLOUD", os.getenv("QUIZ_USE_GEMINI", "true")
    ).lower() == "true"

    # Get chat history for context
    history_text = ""
    if req.session_id in sessions:
        session = sessions[req.session_id]
        for msg in session.get("history", [])[-10:]: # Get last 10 messages
            role = "STUDENT" if msg["role"] == "student" else "CURIOS"
            history_text += f"{role}: {msg['content']}\n"
    
    history_context = f"\nRECENT CHAT HISTORY:\n{history_text}\n" if history_text else ""

    prompt = f"""Generate {req.num_questions} quiz questions for:
Class: {req.student_class}
Subject: {req.subject}
Chapter: {chapter_title}
Topics: {", ".join(chapter_topics)}
Language: {req.language}{history_context}

Rules:
- Questions ONLY from this chapter
- CRITICAL: Prioritize questions related to the student's questions and topics discussed in the RECENT CHAT HISTORY above.
- Mix: 40% MCQ (4 options),
       30% True/False,
       30% Fill in blank
- All text in {req.language}
- Difficulty 1-3
- Indian analogies use karo where possible

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "id": 1,
      "type": "mcq",
      "question": "...",
      "options": ["...","...","...","..."],
      "correct_answer": "...",
      "explanation": "...",
      "concept_tested": "...",
      "difficulty": 1
    }}
  ]
}}
Return ONLY valid JSON.
No explanation. No markdown.
Just the JSON object."""

    if not use_cloud_quiz:
        print("[INFO] /quiz/chapter using local fallback quiz (QUIZ_USE_CLOUD=false)")
        fallback_questions = build_fallback_chapter_quiz(
            num_questions=req.num_questions,
            chapter_title=chapter_title,
            topics=chapter_topics,
            language=req.language,
        )
        return {
            "chapter_title": chapter_title,
            "total_questions": len(fallback_questions),
            "questions": fallback_questions,
        }

    try:
        # Use Gemini for chapter quiz generation
        raw_text = await call_gemini(prompt)
        print("[DEBUG] /quiz/chapter Gemini response received")
    except Exception as e:
        print(f"[ERROR] /quiz/chapter Gemini failed: {e}")
        __import__('traceback').print_exc()
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            print("[WARN] /quiz/chapter Gemini quota limit. Returning local fallback quiz.")
            fallback_questions = build_fallback_chapter_quiz(
                num_questions=req.num_questions,
                chapter_title=chapter_title,
                topics=chapter_topics,
                language=req.language,
            )
            return {
                "chapter_title": chapter_title,
                "total_questions": len(fallback_questions),
                "questions": fallback_questions,
            }
        raise HTTPException(status_code=500, detail=f"AI quiz generation failed: {str(e)}")

    try:
        parsed = clean_json_response(raw_text)
    except Exception:
        parsed = extract_json_object(raw_text)
    questions = parsed.get("questions", []) if isinstance(parsed, dict) else []
    if not questions:
        safe_preview = raw_text[:600].encode("ascii", "ignore").decode()
        print(f"[WARN] /quiz/chapter JSON parse failed. Falling back. Raw preview: {safe_preview}")
        fallback_questions = build_fallback_chapter_quiz(
            num_questions=req.num_questions,
            chapter_title=chapter_title,
            topics=chapter_topics,
            language=req.language,
        )
        return {
            "chapter_title": chapter_title,
            "total_questions": len(fallback_questions),
            "questions": fallback_questions,
        }

    normalized_questions = []
    for i, q in enumerate(questions, start=1):
        raw_type = str(q.get("type", "mcq")).lower().strip()
        compact_type = re.sub(r'[^a-z_]', '', raw_type)
        if compact_type in {"truefalse", "true_false"}:
            q_type = "true_false"
        elif compact_type in {"fillblank", "fillinblank", "fill_in_blank", "fill_blank"}:
            q_type = "mcq"
        else:
            q_type = "mcq" if compact_type in {"", "mcq", "multiplechoice", "multiple_choice"} else compact_type

        if q_type == "fill_blank":
            # User requirement: avoid fill-in-the-blank questions.
            q_type = "mcq"
        options = q.get("options", [])
        # Ensure options is always a list
        if not isinstance(options, list):
            options = [str(options)] if options else []
        
        # Ensure all options are non-empty strings
        options = [str(opt).strip() for opt in options if opt]
        
        # Only use placeholders if we genuinely have fewer than 2 options
        if len(options) < 2:
            if q_type == "true_false":
                options = ["True", "False"]
            elif q_type == "mcq":
                options = ["Option A", "Option B", "Option C", "Option D"]

        question_text = str(q.get("question", "")).strip()
        concept_tested = str(q.get("concept_tested", "")).strip() or chapter_topics[(i - 1) % len(chapter_topics)]
        if not question_text:
            question_text = f"In {chapter_title}, choose the correct statement about '{concept_tested}'."

        correct_answer = str(q.get("correct_answer", "")).strip()
        if q_type == "mcq" and correct_answer and correct_answer not in options:
            options = [correct_answer, *options[:3]]
        if q_type == "mcq" and not correct_answer:
            correct_answer = options[0]
        if q_type == "true_false" and correct_answer.lower() not in {"true", "false"}:
            correct_answer = "True"

        explanation = str(q.get("explanation", "")).strip()
        if not explanation:
            explanation = f"Review why '{correct_answer}' is correct for {concept_tested}."

        normalized_questions.append({
            "id": q.get("id", i),
            "type": q_type,
            "question": question_text,
            "options": options if isinstance(options, list) else [],
            "correct_answer": correct_answer,
            "explanation": explanation,
            "concept_tested": concept_tested,
            "difficulty": int(q.get("difficulty", 1) or 1),
        })

    return {
        "chapter_title": chapter_title,
        "total_questions": len(normalized_questions),
        "questions": normalized_questions,
    }

@app.post("/quiz/submit")
def submit_quiz(req: QuizSubmitRequest):
    if req.session_id not in sessions:
        sessions[req.session_id] = {"gaps": {}, "history": [], "mastery": 100}

    session = sessions[req.session_id]

    # Legacy frontend compatibility path: accepts [{concept_id, is_correct}]
    is_legacy_answers = (
        len(req.answers) > 0
        and "concept_id" in req.answers[0]
        and "is_correct" in req.answers[0]
        and req.chapter_id is None
    )

    if is_legacy_answers:
        session = sessions[req.session_id]
        results_summary = []

        for ans in req.answers:
            concept_id = str(ans.get("concept_id", "")).strip()
            is_correct = bool(ans.get("is_correct", False))
            if not concept_id:
                continue

            current_status = session["gaps"].get(concept_id, "none")
            new_status = current_status

            if is_correct:
                if current_status in ["suspected", "confirmed"]:
                    new_status = "fixed"
                    session["gaps"][concept_id] = "fixed"
            else:
                if current_status == "suspected":
                    new_status = "confirmed"
                    session["gaps"][concept_id] = "confirmed"
                elif current_status == "none":
                    new_status = "suspected"
                    session["gaps"][concept_id] = "suspected"

            results_summary.append({
                "concept_id": concept_id,
                "old_status": current_status,
                "new_status": new_status,
                "is_correct": is_correct
            })

        gap_count = sum(1 for v in session["gaps"].values() if v in ["confirmed", "root"])
        session["mastery"] = max(0, 100 - (gap_count * 12))

        # ── Persist to Supabase (fire-and-forget; never crash on legacy DB errors) ──
        try:
            total = len(req.answers)
            score = sum(1 for a in req.answers if a.get("is_correct", False))
            new_gaps = [a["concept_id"] for a in req.answers if not a["is_correct"]]
            concept_analysis = {a["concept_id"]: ("mastered" if a["is_correct"] else "gap") for a in req.answers}
            
            # Fetch DB session details
            db_session = get_session(req.session_id)
            subject = db_session.get("subject", "General") if db_session else "General"
            
            # Save quiz attempt
            print(f"[DEBUG] Saving quiz attempt for session {req.session_id}")
            attempt_id = save_quiz_attempt(
                session_id=req.session_id,
                chapter_id="ch_diagnostic",
                chapter_title="Diagnostic Concept Quiz",
                subject=subject,
                score=score,
                total=total,
                concept_analysis=concept_analysis,
                new_gaps=new_gaps
            )
            print(f"[DEBUG] Quiz attempt saved with ID: {attempt_id}")
            
            if attempt_id:
                answers_list = []
                for idx, ans in enumerate(req.answers):
                    concept_id = ans.get("concept_id")
                    is_correct = ans.get("is_correct", False)
                    # Use real question data if sent by frontend, else fallback to generic
                    answers_list.append({
                        "attempt_id": attempt_id,
                        "question_text": ans.get("question_text") or f"Concept check: {concept_id.replace('_', ' ').capitalize()}",
                        "type": ans.get("question_type") or "mcq",
                        "student_answer": ans.get("student_answer") or ("Correct" if is_correct else "Incorrect"),
                        "correct_answer": ans.get("correct_answer") or "Correct",
                        "is_correct": is_correct,
                        "concept_tested": concept_id
                    })
                print(f"[DEBUG] Saving {len(answers_list)} quiz answers")
                saved_answers = save_quiz_answers(attempt_id, answers_list)
                print(f"[DEBUG] Saved answers: {len(saved_answers) if saved_answers else 0}")
                
                local_attempt = {
                    "attempt_id": attempt_id,
                    "chapter_id": "ch_diagnostic",
                    "chapter_title": "Diagnostic Concept Quiz",
                    "subject": subject,
                    "score": score,
                    "total": total,
                    "concept_analysis": concept_analysis,
                    "new_gaps": new_gaps,
                    "created_at": datetime.utcnow().isoformat(),
                }
                persist_local_quiz_attempt(req.session_id, local_attempt, answers_list)

                # Also upsert any new gaps in database
                for gap in new_gaps:
                    upsert_gap(
                        session_id=req.session_id,
                        concept_id=gap,
                        concept_label=gap.replace('_', ' ').capitalize(),
                        status="confirmed"
                    )
                # Also sync mastery score to DB session
                update_mastery(req.session_id, session["mastery"])
        except Exception as e:
            print(f"[WARN] Failed to persist legacy quiz attempt to database: {e}")
            local_attempt = {
                "attempt_id": f"local_{uuid.uuid4().hex[:8]}",
                "chapter_id": "ch_diagnostic",
                "chapter_title": "Diagnostic Concept Quiz",
                "subject": subject,
                "score": score,
                "total": total,
                "concept_analysis": concept_analysis,
                "new_gaps": new_gaps,
                "created_at": datetime.utcnow().isoformat(),
            }
            persist_local_quiz_attempt(req.session_id, local_attempt, answers_list if 'answers_list' in locals() else [])

        return {
            "results": results_summary,
            "new_mastery": session["mastery"],
            "updated_gaps": session["gaps"]
        }

    try:
        if not req.chapter_id or req.total_questions is None or req.score is None:
            raise HTTPException(status_code=422, detail="Missing required quiz submission fields")

        attempt_id = None
        answers_list = []
        local_attempt = {
            "attempt_id": f"local_{uuid.uuid4().hex[:8]}",
            "chapter_id": req.chapter_id,
            "chapter_title": req.chapter_title or "",
            "subject": req.subject or "",
            "score": req.score,
            "total": req.total_questions,
            "concept_analysis": req.concept_analysis,
            "new_gaps": req.new_gaps,
            "created_at": datetime.utcnow().isoformat(),
        }

        try:
            attempt_id = save_quiz_attempt(
                session_id=req.session_id,
                chapter_id=req.chapter_id,
                chapter_title=req.chapter_title or "",
                subject=req.subject or "",
                score=req.score,
                total=req.total_questions,
                concept_analysis=req.concept_analysis,
                new_gaps=req.new_gaps
            )
            if not attempt_id:
                raise Exception("Quiz attempt could not be saved")

            for idx, ans in enumerate(req.answers):
                answers_list.append({
                    "attempt_id": attempt_id,
                    "question_text": ans.get("question_text", ""),
                    "question_type": ans.get("type", ""),
                    "student_answer": ans.get("student_answer", ""),
                    "correct_answer": ans.get("correct_answer", ""),
                    "is_correct": bool(ans.get("is_correct", False)),
                    "concept_tested": ans.get("concept_tested", "")
                })
            save_quiz_answers(attempt_id, answers_list)
            local_attempt["attempt_id"] = attempt_id
            persist_local_quiz_attempt(req.session_id, local_attempt, answers_list)

            for gap in req.new_gaps:
                if isinstance(gap, dict):
                    concept_id = str(gap.get("concept_id", "")).strip()
                    concept_label = str(gap.get("concept_label") or concept_id).strip()
                else:
                    concept_id = str(gap).strip()
                    concept_label = concept_id

                if concept_id:
                    upsert_gap(
                        session_id=req.session_id,
                        concept_id=concept_id,
                        concept_label=concept_label,
                        status="confirmed"
                    )

            all_gaps = get_session_gaps(req.session_id)
            mastery = max(0, 100 - (sum(1 for gap in all_gaps if gap.get("status") in ["confirmed", "root"]) * 12))
            session["mastery"] = mastery
            update_mastery(req.session_id, mastery)
        except Exception as e:
            print(f"[WARN] Standard quiz DB persist failed: {e}")
            for gap in req.new_gaps:
                if isinstance(gap, dict):
                    concept_id = str(gap.get("concept_id", "")).strip()
                else:
                    concept_id = str(gap).strip()
                if concept_id:
                    session["gaps"][concept_id] = "confirmed"
            store_gaps = [gap for gap in session["gaps"].keys() if session["gaps"].get(gap) in ["confirmed", "root"]]
            session["mastery"] = max(0, 100 - (len(store_gaps) * 12))
            persist_local_quiz_attempt(req.session_id, local_attempt, [
                {
                    "attempt_id": local_attempt["attempt_id"],
                    "question_text": ans.get("question_text", ""),
                    "type": ans.get("type", ""),
                    "student_answer": ans.get("student_answer", ""),
                    "correct_answer": ans.get("correct_answer", ""),
                    "is_correct": bool(ans.get("is_correct", False)),
                    "concept_tested": ans.get("concept_tested", "")
                }
                for ans in req.answers
            ])
            attempt_id = local_attempt["attempt_id"]

        return {
            "success": True,
            "attempt_id": attempt_id,
            "message": "Quiz submitted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit quiz: {str(e)}")

# ─────────────────────────────────────────────────────────────────────────────
# TEACHER DASHBOARD API ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/teacher/overview")
def teacher_overview():
    try:
        data = get_teacher_overview_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/teacher/students")
def teacher_students():
    try:
        data = get_all_student_sessions()
        existing_ids = {item["id"] for item in data}
        for sid, local_session in sessions.items():
            if sid not in existing_ids:
                data.append({
                    "id": sid,
                    "student_name": local_session.get("student_name", "Student"),
                    "student_class": local_session.get("student_class", 7),
                    "subject": local_session.get("subject", "Mathematics"),
                    "language": local_session.get("language", "English"),
                    "mastery_score": local_session.get("mastery", 100),
                    "created_at": local_session.get("created_at"),
                    "updated_at": local_session.get("updated_at"),
                    "gap_count": sum(1 for status in local_session.get("gaps", {}).values() if status in ["confirmed", "root"]),
                    "quiz_count": len(local_session.get("quiz_attempts", [])),
                })
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/teacher/student/{session_id}")
def teacher_student_detail(session_id: str):
    try:
        data = get_student_detail_data(session_id)
        if not data and session_id in sessions:
            local_session = sessions[session_id]
            data = {
                "profile": {
                    "id": session_id,
                    "student_name": local_session.get("student_name", "Student"),
                    "student_class": local_session.get("student_class", 7),
                    "subject": local_session.get("subject", "Mathematics"),
                    "language": local_session.get("language", "English"),
                    "mastery_score": local_session.get("mastery", 100),
                    "created_at": local_session.get("created_at"),
                    "updated_at": local_session.get("updated_at"),
                },
                "gaps": [
                    {
                        "concept_id": concept_id,
                        "status": status,
                        "detected_at": local_session.get("updated_at"),
                    }
                    for concept_id, status in local_session.get("gaps", {}).items()
                ],
                "quiz_attempts": local_session.get("quiz_attempts", []),
                "quiz_answers": local_session.get("quiz_answers", []),
                "mastery_timeline": [
                    {"date": local_session.get("created_at", "" )[:10], "mastery": local_session.get("mastery", 100)},
                    {"date": local_session.get("updated_at", "" )[:10], "mastery": local_session.get("mastery", 100)},
                ],
                "chat_messages": [
                    {"role": m["role"], "content": m["content"], "created_at": local_session.get("updated_at")}
                    for m in local_session.get("history", [])
                ],
            }
        elif not data:
            raise HTTPException(status_code=404, detail="Student session not found")
        
        # Merge in-memory chat history if present and database chat_messages is empty
        if session_id in sessions:
            local_session = sessions[session_id]
            mem_history = local_session.get("history", [])
            if mem_history and not data.get("chat_messages"):
                import datetime
                data["chat_messages"] = [
                    {
                        "role": m["role"],
                        "content": m["content"],
                        "created_at": datetime.datetime.utcnow().isoformat()
                    }
                    for m in mem_history
                ]

            if local_session.get("quiz_attempts") and not data.get("quiz_attempts"):
                data["quiz_attempts"] = local_session["quiz_attempts"]
            if local_session.get("quiz_answers") and not data.get("quiz_answers"):
                data["quiz_answers"] = local_session["quiz_answers"]
        
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/teacher/quiz-analytics")
def teacher_quiz_analytics():
    try:
        data = get_quiz_analytics_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/teacher/gap-heatmap")
def teacher_gap_heatmap():
    try:
        data = get_gap_heatmap_data()
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/teacher/recommendations/{session_id}")
async def teacher_recommendations(session_id: str):
    try:
        data = get_student_detail_data(session_id)
        if not data:
            raise HTTPException(status_code=404, detail="Student session not found")
        
        profile = data["profile"]
        gaps = data["gaps"]
        quiz_attempts = data["quiz_attempts"]
        
        active_gaps = [g for g in gaps if g.get("status") in ["confirmed", "root"]]
        gaps_text = "\n".join([f"- {g.get('concept_id')} ({g.get('status')})" for g in active_gaps]) if active_gaps else "No active gaps"
        quizzes_text = "\n".join([f"- Attempt for {q.get('chapter_title')} score: {q.get('score')}/{q.get('total_questions')} ({q.get('percentage')}%)" for q in quiz_attempts]) if quiz_attempts else "No quizzes taken"
        
        prompt = f"""You are CuriOS AI, a state-of-the-art diagnostic system for NCERT Class 5-10.
Provide a professional, detailed pedagogical action plan and remedial recommendations for the student:
Student Name: {profile['student_name']}
Student Class: {profile['student_class']}
Subject: {profile['subject']}
Overall Mastery Score: {profile['mastery_score']}%

Their detected learning gaps:
{gaps_text}

Their quiz history:
{quizzes_text}

Generate the recommendation in exactly the following JSON structure:
{{
  "priority_actions": [
    "Specific remediation action 1 (e.g., 'Revise Density from Class 5 Chapter 12 before Buoyancy')",
    "Specific remediation action 2",
    "Specific remediation action 3"
  ],
  "parent_message": "Dear Parent, {profile['student_name']} in Class {profile['student_class']} has shown difficulty in... Please help revise these at home. - CuriOS AI Learning System"
}}

Respond ONLY with this valid JSON object, no other commentary or markdown formatting.
"""
        try:
            raw_text = await call_gemini(prompt)
            rec_data = clean_json_response(raw_text)
            if rec_data and "priority_actions" in rec_data and "parent_message" in rec_data:
                return rec_data
        except Exception as ai_err:
            print(f"[WARN] AI recommendations generation failed, using standard generator: {ai_err}")
        
        # Rule-based fallback
        actions = []
        if active_gaps:
            for g in active_gaps[:3]:
                concept_name = g.get('concept_id', 'concept').replace('_', ' ').capitalize()
                actions.append(f"Revise {concept_name} immediately to patch conceptual leakage.")
            if len(active_gaps) > 1:
                actions.append(f"Once core concepts are resolved, verify propagation dependencies.")
        else:
            actions = ["Maintain current study habits.", "Practice advanced chapter quizzes to challenge understanding."]
            
        gaps_list = ", ".join([g.get('concept_id', '').replace('_', ' ').capitalize() for g in active_gaps]) if active_gaps else "none"
        parent_msg = f"Dear Parent, {profile['student_name']} in Class {profile['student_class']} has shown difficulty in: {gaps_list}. Please help revise these at home. - CuriOS AI Learning System"
        
        return {
            "priority_actions": actions,
            "parent_message": parent_msg
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))