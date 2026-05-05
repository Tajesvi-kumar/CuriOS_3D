import google.generativeai as genai
import os
import time

genai.configure(api_key="AIzaSyCcR-qUfN19FGmbWVDmkQ5TgFQUKmkFRM4")

video_path = r"C:\Users\tajes\OneDrive\Attachments\Desktop\glxy\WhatsApp Video 2026-04-17 at 23.21.06.mp4"

print(f"Uploading {video_path}...")
video_file = genai.upload_file(path=video_path)

while video_file.state.name == "PROCESSING":
    print("Processing video...")
    time.sleep(2)
    video_file = genai.get_file(video_file.name)

if video_file.state.name == "FAILED":
    print("Video processing failed.")
    exit(1)

print("Video uploaded. Generating description...")
model = genai.GenerativeModel(model_name="gemini-1.5-flash")
prompt = "Describe the 3D animation and cursor moving effect in this video in extreme detail. I need to recreate it in React Three Fiber. What are the shapes, colors, lines, interactions, and physics? Is it a particle wave, a network constellation, a black hole, glowing grid, or something else? How does it react to the cursor?"

response = model.generate_content([video_file, prompt])
print("\n--- DESCRIPTION ---")
print(response.text)

genai.delete_file(video_file.name)
print("Cleaned up video file.")
