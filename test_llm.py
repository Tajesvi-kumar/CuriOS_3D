import asyncio
import os
import sys

sys.path.insert(0, 'curios-ai/backend')
from prompt_builder import build_system_prompt
from ai_config import call_ai, extract_json

prompt = build_system_prompt('Rahul', 7, [])
full_prompt = prompt + '\n\nCONVERSATION SO FAR:\nSTUDENT: What is density?\nCURIOS:'

async def test():
    print("--- SENDING PROMPT TO AI ---")
    res = await call_ai(full_prompt)
    print("\n--- RAW OLLAMA RESPONSE (backend terminal output) ---")
    print(res)
    print("\n--- EXTRACTED JSON (what frontend receives) ---")
    print(extract_json(res))

asyncio.run(test())
