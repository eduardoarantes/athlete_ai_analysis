#!/usr/bin/env python3
"""
Test Gemini function response format to verify correctness.
"""
import os
import google.generativeai as genai

# Configure Gemini
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("ERROR: GOOGLE_API_KEY not set")
    exit(1)

genai.configure(api_key=api_key)

# Define a simple function
tools = [{
    "function_declarations": [{
        "name": "calculate_power_zones",
        "description": "Calculate training power zones",
        "parameters": {
            "type": "object",
            "properties": {
                "ftp": {
                    "type": "number",
                    "description": "FTP in watts"
                }
            },
            "required": ["ftp"]
        }
    }]
}]

# Create model
model = genai.GenerativeModel(model_name="gemini-2.5-flash", tools=tools)

# Start chat
chat = model.start_chat(history=[])

# Send request
response = chat.send_message("Calculate power zones for FTP 260")

print("=== RESPONSE 1 ===")
try:
    text = response.text
    print(f"Text: {text}")
except Exception:
    print("Text: None (function call response)")

print(f"Candidates: {len(response.candidates)}")
if response.candidates:
    candidate = response.candidates[0]
    print(f"Parts: {len(candidate.content.parts)}")
    for i, part in enumerate(candidate.content.parts):
        if hasattr(part, 'function_call'):
            print(f"  Part {i}: Function call - {part.function_call.name}")
            print(f"    Args: {dict(part.function_call.args)}")

# Simulate function execution
zones_result = {
    "ftp": 260,
    "zones": {
        "z1": {"name": "Recovery", "min": 0, "max": 143},
        "z2": {"name": "Endurance", "min": 144, "max": 195},
    }
}

# Send function response - TEST DIFFERENT FORMATS
print("\n=== TESTING FUNCTION RESPONSE FORMAT ===")

# Format 1: With function name
try:
    response2 = chat.send_message({
        "parts": [{
            "function_response": {
                "name": "calculate_power_zones",
                "response": zones_result
            }
        }]
    })
    print("✓ Format 1 (with name) WORKS")
    print(f"  Response text: {response2.text[:100] if hasattr(response2, 'text') else 'None'}")
except Exception as e:
    print(f"✗ Format 1 (with name) FAILED: {e}")

print("\nDone!")
