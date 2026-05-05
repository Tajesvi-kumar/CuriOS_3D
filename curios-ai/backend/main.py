from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json, re, httpx, traceback, random
from typing import Any
from dotenv import load_dotenv
from concept_graph import engine
from prompt_builder import build_chat_prompt, build_analysis_prompt, build_quiz_prompt
from ai_config import OLLAMA_MODEL, OLLAMA_URL, USE_OLLAMA, call_ai, extract_json, call_ollama, call_gemini
from database import (
    create_session,
    get_chapters,
    get_chapter_attempts,
    get_session,
    get_session_gaps,
    save_quiz_answers,
    save_quiz_attempt,
    upsert_gap,
    update_mastery,
)

load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")

app = FastAPI(title="CuriOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

sessions = {}

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
    mode = "ollama" if USE_OLLAMA else "gemini"
    status = "connected"
    detail = ""
    if USE_OLLAMA:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                tags_response = await client.get(f"{OLLAMA_URL}/api/tags")
                tags_response.raise_for_status()
                # Verify that current model can actually generate text.
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
                    status = "error"
                    detail = f"Ollama generate failed: HTTP {probe_response.status_code}"
                else:
                    probe_data = probe_response.json()
                    probe_text = (probe_data.get("response") or "").strip()
                    if not probe_text:
                        status = "error"
                        detail = "Ollama generate returned empty text"
        except Exception as e:
            status = "error"
            detail = str(e)
    return {
        "mode": mode,
        "ollama_url": OLLAMA_URL,
        "model": OLLAMA_MODEL,
        "status": status,
        "detail": detail
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
        session_id = create_session(
            student_name=req.student_name,
            student_class=req.student_class,
            subject=req.subject,
            language=req.language
        )
        if not session_id:
            raise HTTPException(status_code=500, detail="Session could not be created")
        return {"session_id": session_id}
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
        sessions[req.session_id] = {
            "gaps": {}, "history": [], "mastery": 100
        }
    
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
        # Run Chat (Ollama) and Analysis (Gemini) concurrently but handle errors gracefully
        chat_task = asyncio.create_task(call_ai(full_chat_prompt))
        analysis_task = asyncio.create_task(call_gemini(full_analysis_prompt))
        
        # Wait for both to finish
        done, pending = await asyncio.wait([chat_task, analysis_task], return_when=asyncio.ALL_COMPLETED)
        
        student_message = (
            chat_task.result()
            if not chat_task.exception()
            else build_safe_chat_fallback(req.message, req.language)
        )
        
        if analysis_task.exception():
            print(f"[WARN] Analysis task failed: {analysis_task.exception()}")
            analysis_text = json.dumps(build_local_analysis(req.message))
        else:
            analysis_text = analysis_task.result()
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
    
    analysis = extract_json(analysis_text)
    
    detected_concept = analysis.get("detected_concept")
    gap_status = analysis.get("gap_status", "none")
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
        try:
            db_session = get_session(req.session_id)
            if db_session:
                db_gaps = get_session_gaps(req.session_id)
        except Exception:
            # Non-UUID or unknown session IDs should continue in local-memory mode.
            db_session = None

        if db_session:
            sessions[req.session_id] = {
                "gaps": {gap["concept_id"]: gap["status"] for gap in db_gaps if gap.get("concept_id")},
                "history": [],
                "mastery": db_session.get("mastery_score", 100) or 100
            }
        else:
            # Fallback for old frontend flow that generates random local session IDs
            sessions[req.session_id] = {
                "gaps": {},
                "history": [],
                "mastery": 100
            }
    
    session = sessions[req.session_id]
    # Identify gaps to test
    target_gaps = [k for k, v in session["gaps"].items() if v in ["suspected", "confirmed", "root"]]
    
    # If no gaps, just pick a few general topics from the graph for the student's class
    if not target_gaps:
        all_nodes = [k for k, v in engine.node_data.items()]
        target_gaps = all_nodes[:3] # fallback

    prompt = build_quiz_prompt(req.student_name, req.student_class, target_gaps, req.language)
    
    try:
        raw_text = await call_ai(prompt)
    except Exception as e:
        print(f"[ERROR] /quiz/generate AI failed: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
    
    quiz_data = extract_quiz(raw_text)
    if not quiz_data or "questions" not in quiz_data:
        # Fallback parsing or error
        raise HTTPException(status_code=500, detail="Failed to parse quiz from Gemini")
        
    return quiz_data

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
    use_gemini_for_quiz = os.getenv("QUIZ_USE_GEMINI", "true").lower() == "true"

    prompt = f"""Generate {req.num_questions} quiz questions for:
Class: {req.student_class}
Subject: {req.subject}
Chapter: {chapter_title}
Topics: {", ".join(chapter_topics)}
Language: {req.language}

Rules:
- Questions ONLY from this chapter
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

    if not use_gemini_for_quiz:
        print("[INFO] /quiz/chapter using local fallback quiz (QUIZ_USE_GEMINI=false)")
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
        raw_text = await call_ai(prompt)
        print("[DEBUG] /quiz/chapter AI response received")
    except Exception as e:
        print(f"[ERROR] /quiz/chapter AI failed: {e}")
        print(traceback.format_exc())
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err:
            print("[WARN] /quiz/chapter Gemini quota hit. Returning local fallback quiz.")
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
        if q_type == "true_false" and (not isinstance(options, list) or len(options) < 2):
            options = ["True", "False"]
        if q_type == "mcq" and (not isinstance(options, list) or len(options) < 2):
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

        normalized_questions.append({
            "id": q.get("id", i),
            "type": q_type,
            "question": question_text,
            "options": options if isinstance(options, list) else [],
            "correct_answer": correct_answer,
            "explanation": str(q.get("explanation", "")).strip(),
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

        return {
            "results": results_summary,
            "new_mastery": session["mastery"],
            "updated_gaps": session["gaps"]
        }

    try:
        if not req.chapter_id or req.total_questions is None or req.score is None:
            raise HTTPException(status_code=422, detail="Missing required quiz submission fields")

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
            raise HTTPException(status_code=500, detail="Quiz attempt could not be saved")

        save_quiz_answers(attempt_id, req.answers)

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
        update_mastery(req.session_id, mastery)

        return {
            "success": True,
            "attempt_id": attempt_id,
            "message": "Quiz submitted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit quiz: {str(e)}")