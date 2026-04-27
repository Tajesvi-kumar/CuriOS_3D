import json
import os
import re

import httpx
from dotenv import load_dotenv

load_dotenv()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:8b")
USE_OLLAMA = os.getenv("USE_OLLAMA", "false").lower() == "true"


def _extract_ollama_text(payload: dict) -> str:
    text = payload.get("response", "")
    if isinstance(text, str) and text.strip():
        return text.strip()
    message = payload.get("message", {})
    if isinstance(message, dict):
        content = message.get("content", "")
        if isinstance(content, str) and content.strip():
            return content.strip()
    return ""


def _extract_last_student_message(prompt: str) -> str:
    matches = re.findall(r"STUDENT:\s*(.*)", prompt)
    if not matches:
        return ""
    return matches[-1].strip()


def _build_local_tutor_reply(student_message: str) -> str:
    text = (student_message or "").strip()
    lowered = text.lower()
    if not text:
        return "Let's continue. What topic feels most confusing to you right now?"
    if "2x" in lowered or "equation" in lowered or "solve" in lowered:
        return "Great question. To isolate x, what operation should we apply first to remove the constant term?"
    if "density" in lowered:
        return "Think of density as mass packed in a given space. Which is denser: cotton or iron for the same volume?"
    if "fraction" in lowered:
        return "Fractions compare parts of a whole. If pizza is split into 8 equal slices, what does 3/8 represent?"
    if "heat" in lowered or "convection" in lowered:
        return "Nice thinking. When air gets hot it expands; what happens to its density then?"
    return f"Good start. For '{text}', what is the first step or definition you already know?"


async def call_ollama(prompt: str) -> str:
    last_error = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(
                    f"{OLLAMA_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.5,
                            "num_predict": 220,
                        },
                    },
                )
                response.raise_for_status()
                result = response.json()
                text = _extract_ollama_text(result)
                if not text:
                    raise ValueError("Ollama returned an empty response")
                return text
        except Exception as e:
            last_error = e
            print(f"[WARN] Ollama attempt {attempt + 1} failed: {e}")
    raise RuntimeError(f"Ollama failed after retries: {last_error}")


async def call_gemini(prompt: str) -> str:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY is not configured")

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.5-flash:generateContent?key={key}"
    )
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            url,
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        if response.status_code != 200:
            raise Exception(f"Gemini returned {response.status_code}: {response.text[:500]}")
        data = response.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def call_ai(prompt: str) -> str:
    print(f"Using: {'Ollama' if USE_OLLAMA else 'Gemini'}")
    if USE_OLLAMA:
        try:
            return await call_ollama(prompt)
        except Exception as ollama_error:
            print(f"[WARN] Ollama failed, falling back to Gemini: {ollama_error}")
            try:
                return await call_gemini(prompt)
            except Exception as gemini_error:
                print(f"[ERROR] Gemini fallback also failed: {gemini_error}")
                return _build_local_tutor_reply(_extract_last_student_message(prompt))
    try:
        return await call_gemini(prompt)
    except Exception as gemini_error:
        print(f"[ERROR] Gemini failed: {gemini_error}")
        return _build_local_tutor_reply(_extract_last_student_message(prompt))


def extract_json(text: str) -> dict:
    import re, json
    
    print("RAW ANALYSIS RESPONSE:", text)
    print("PARSING TEXT:", text[-500:])
    
    try:
        # Format 1: XML tags
        if "<ANALYSIS>" in text:
            start = text.index("<ANALYSIS>") + 10
            end = text.index("</ANALYSIS>")
            return json.loads(text[start:end].strip())
    except: pass
    
    try:
        # Format 2: Markdown JSON block
        match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
        if match:
            return json.loads(match.group(1))
    except: pass
    
    try:
        # Format 3: Last JSON object in text
        matches = re.findall(r'\{[^{}]*\}', text, re.DOTALL)
        if matches:
            for m in reversed(matches):
                try:
                    return json.loads(m)
                except: continue
    except: pass
    
    # Default - no gap detected
    return {
        "detected_concept": None,
        "gap_status": "none",
        "response_to_student": text
    }
