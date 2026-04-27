import asyncio
import os
import sys

sys.path.insert(0, 'curios-ai/backend')
from prompt_builder import build_chat_prompt, build_analysis_prompt
from ai_config import call_ai, call_gemini

async def test():
    chat_prompt = build_chat_prompt('Rahul', 7, [])
    analysis_prompt = build_analysis_prompt('Rahul', 7, [])
    
    full_chat_prompt = f"{chat_prompt}\n\nCONVERSATION SO FAR:\nSTUDENT: What is density?\nCURIOS:"
    full_analysis_prompt = f"{analysis_prompt}\n\nCONVERSATION SO FAR:\nSTUDENT: What is density?\n"
    
    print("Starting gather...")
    chat_task = call_ai(full_chat_prompt)
    analysis_task = call_gemini(full_analysis_prompt)
    
    try:
        student_message, analysis_text = await asyncio.gather(chat_task, analysis_task)
        print("CHAT:", student_message[:100])
        print("ANALYSIS:", analysis_text[:100])
    except Exception as e:
        print("Error in gather:", e)

asyncio.run(test())
