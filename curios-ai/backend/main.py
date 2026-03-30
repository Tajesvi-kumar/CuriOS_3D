from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json, re, httpx
from dotenv import load_dotenv
from concept_graph import engine
from prompt_builder import build_system_prompt

load_dotenv()
GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}"

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

async def call_gemini(prompt: str) -> str:
    """Call Gemini API directly via HTTP — no SDK needed"""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(GEMINI_URL, json={
            "contents": [{"parts": [{"text": prompt}]}]
        })
        print("STATUS:", response.status_code)
        print("RESPONSE:", response.text[:300])
        if response.status_code != 200:
            raise Exception(f"Gemini returned {response.status_code}: {response.text[:200]}")
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]

def extract_analysis(text: str) -> dict:
    try:
        match = re.search(r'<ANALYSIS>(.*?)</ANALYSIS>', text, re.DOTALL)
        if match:
            return json.loads(match.group(1).strip())
    except:
        pass
    return {}

def extract_student_message(text: str) -> str:
    clean = re.sub(r'<ANALYSIS>.*?</ANALYSIS>', '', text, flags=re.DOTALL)
    return clean.strip()

@app.get("/")
def root():
    return {"status": "CuriOS backend is running! 🔍"}

@app.get("/graph")
def get_graph():
    return engine.get_all_nodes_with_edges()

@app.post("/chat")
async def chat(req: ChatRequest):
    if req.session_id not in sessions:
        sessions[req.session_id] = {
            "gaps": {}, "history": [], "mastery": 100
        }
    
    session = sessions[req.session_id]
    known_gaps = [k for k, v in session["gaps"].items() if v in ["confirmed", "root"]]
    system_prompt = build_system_prompt(req.student_name, req.student_class, known_gaps, req.language)
    
    history_text = ""
    for msg in session["history"][-6:]:
        role = "STUDENT" if msg["role"] == "student" else "CURIOS"
        history_text += f"{role}: {msg['content']}\n"
    
    full_prompt = f"{system_prompt}\n\nCONVERSATION SO FAR:\n{history_text}\nSTUDENT: {req.message}\nCURIOS:"
    
    try:
        raw_text = await call_gemini(full_prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")
    
    analysis = extract_analysis(raw_text)
    student_message = extract_student_message(raw_text)
    
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