import asyncio
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Override Cerebras key to trigger fallback
import ai_config
ai_config.CEREBRAS_API_KEY = "invalid-key-to-force-fallback"

async def verify_fallback():
    prompt = "Explain density in 1 short sentence."
    print("Testing call_ai with simulated Cerebras failure...")
    try:
        response = await ai_config.call_ai(prompt)
        print("\n--- Response Received ---")
        print(response)
        print("-------------------------")
        if response and "density" in response.lower():
            print("\nVerification SUCCESSFUL! Fallback to Gemini was seamless and returned a correct result.")
        else:
            print("\nVerification FAILED: Response was empty or incorrect.")
    except Exception as e:
        print(f"\nVerification FAILED with exception: {e}")

asyncio.run(verify_fallback())
