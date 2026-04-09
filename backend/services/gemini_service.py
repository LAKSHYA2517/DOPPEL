"""
Gemini Service — Generates study schedules from the Student State Vector (SSV).
"""
import json
import os
import time
from datetime import datetime
from google import genai
import groq
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


def generate_schedule(ssv: dict, difficulty: str = "auto") -> list[dict]:
    """Send SSV to Gemini and get back a structured schedule as a list of task dicts.
    
    difficulty: 'auto', 'easy', 'medium', or 'hard'
    """
    if not GEMINI_API_KEY:
        print("[Gemini] ERROR: No GEMINI_API_KEY set in .env")
        raise ValueError("GEMINI_API_KEY not configured. Add it to your .env file.")

    client = genai.Client(api_key=GEMINI_API_KEY)

    # Build the prompt
    today = ssv.get("today", datetime.now().strftime("%Y-%m-%d"))
    syllabi = ssv.get("syllabi", [])
    incomplete = ssv.get("incomplete_tasks_from_past", [])
    wellbeing = ssv.get("wellbeing", {})
    leetcode = ssv.get("leetcode", {})
    github = ssv.get("github", {})

    syllabi_text = ""
    for s in syllabi:
        syllabi_text += f"\n--- Syllabus: {s['title']} ---\n"
        syllabi_text += f"Deadline: {s['deadline']} ({s['days_remaining']} days remaining)\n"
        syllabi_text += f"Content:\n{s['content']}\n"

    incomplete_text = ""
    if incomplete:
        incomplete_text = "\n\nINCOMPLETE TASKS FROM PREVIOUS DAYS (must be rescheduled):\n"
        for t in incomplete:
            incomplete_text += f"- [{t['type']}] {t['task']} (was scheduled for {t['date']})\n"

    # Build difficulty-specific instructions
    difficulty_lower = difficulty.lower() if difficulty else "auto"
    if difficulty_lower == "easy":
        difficulty_instructions = """
DIFFICULTY: EASY
- Keep the daily workload LIGHT: 3-5 tasks per day maximum.
- Schedule only 2-3 hours of focused study per day.
- Include generous breaks (at least 2 well-being tasks per day: breaks, exercise, relaxation).
- Choose EASY-level LeetCode problems (e.g. "Two Sum", "Valid Parentheses", "Merge Two Sorted Lists").
- Space study sessions out with rest periods in between.
- Prioritize student well-being over speed of completion.
- Study sessions should be 30-45 minutes max before a break.
"""
    elif difficulty_lower == "medium":
        difficulty_instructions = """
DIFFICULTY: MEDIUM
- Maintain a BALANCED workload: 5-7 tasks per day.
- Schedule 4-5 hours of focused study per day.
- Include 1-2 well-being tasks per day (short breaks, a walk).
- Choose MEDIUM-level LeetCode problems (e.g. "3Sum", "Longest Substring Without Repeating Characters", "Container With Most Water").
- Study sessions can be 45-60 minutes before a break.
- Balance depth and breadth of syllabus coverage.
"""
    elif difficulty_lower == "hard":
        difficulty_instructions = """
DIFFICULTY: HARD
- Push the student with an INTENSIVE workload: 7-10 tasks per day.
- Schedule 6-8 hours of focused study per day.
- Minimize breaks — only 1 well-being task per day (a short break or meal).
- Choose HARD-level LeetCode problems (e.g. "Median of Two Sorted Arrays", "Regular Expression Matching", "Trapping Rain Water").
- Include deep-dive sessions of 90-120 minutes of uninterrupted study.
- Cover syllabus topics at maximum depth with challenging practice.
- Push for faster completion even if stress is moderate.
"""
    else:
        # Auto mode: let Gemini decide based on student state (original behavior)
        difficulty_instructions = """
DIFFICULTY: AUTO (determined by current student state)
- If stress is high (>7) or sleep deficit is significant, use a lighter schedule with more breaks.
- If stress is low and the student is well-rested, push harder with more intensive study blocks.
- Naturally adjust the LeetCode problem difficulty based on student streaks and focus score.
"""

    prompt = f"""You are an AI study planner for a college student. Based on the following Student State Vector (SSV), generate a day-by-day study schedule from {today} until all syllabus deadlines are met.

STUDENT PROFILE:
- Name: {ssv.get('student', {}).get('name', 'Student')}
- University: {ssv.get('student', {}).get('university', 'Unknown')}

CURRENT STATE:
- GitHub connected: {github.get('connected', False)}, Username: {github.get('username', 'N/A')}
- Commit streak: {wellbeing.get('coding_streak_days', 0)} days
- LeetCode connected: {leetcode.get('connected', False)}, Username: {leetcode.get('username', 'N/A')}
- LeetCode streak: {wellbeing.get('leetcode_streak_days', 0)} days
- Focus score: {wellbeing.get('focus_score', 0)}
- Stress score: {wellbeing.get('stress_score', 0)}/10
- Sleep deficit: {wellbeing.get('sleep_deficit_hours', 0)} hours
- Latest journal: {wellbeing.get('latest_journal', 'None')}
{difficulty_instructions}
SYLLABI TO COMPLETE:
{syllabi_text}
{incomplete_text}

RULES:
1. Create a schedule for EACH DAY from {today} until the furthest deadline.
2. Follow the DIFFICULTY level instructions above for daily task count, study hours, and break frequency.
3. Include SPECIFIC LeetCode problems by their exact name, matching the difficulty level specified above.
4. For LeetCode tasks, set verification_type to "leetcode" and put the problem name in verification_data.
5. If GitHub is connected and relevant, include GitHub tasks like "Push today's code to GitHub". Set verification_type to "github".
6. Include well-being tasks (breaks, exercise, sleep reminders) as specified by the difficulty level.
7. If there are incomplete tasks from past days, reschedule them into the earliest available slots.
8. Balance study sessions with practice (LeetCode) and project work.
9. Each task needs a time slot (e.g. "09:00 AM"), a type, and proper verification info.

Respond with ONLY a valid JSON array. No markdown, no explanation. Each element must be:
{{
  "date": "YYYY-MM-DD",
  "time": "HH:MM AM/PM",
  "task": "task description",
  "type": "Academic|LeetCode|GitHub|Well-being|Coding|Project",
  "verification_type": "manual|leetcode|github",
  "verification_data": "problem name or null",
  "order": 1
}}

Generate the schedule now:"""

    print(f"[Gemini] Sending prompt ({len(prompt)} chars) to Gemini...")

    max_retries = 3
    base_delay = 2

    def clean_json_response(text):
        if text.startswith("```"):
            lines = text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            return "\n".join(lines).strip()
        return text

    raw_text = None
    success = False

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )

            raw_text = response.text.strip()
            print(f"[Gemini] Response received ({len(raw_text)} chars)")
            success = True
            break
        except Exception as e:
            print(f"[Gemini] Exception on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                delay = base_delay ** (attempt + 1)
                print(f"[Gemini] Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                print(f"[Gemini] Max retries reached.")

    if not success:
        if not GROQ_API_KEY:
            raise ValueError("Gemini failed and GROQ_API_KEY is not configured for fallback.")
            
        print("[Fallback] Gemini limit reached or failed. Attempting to generate schedule using Groq API (llama-3.3-70b-versatile)...")
        try:
            groq_client = groq.Groq(api_key=GROQ_API_KEY)
            chat_completion = groq_client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model="llama-3.3-70b-versatile",
                temperature=0.3,
            )
            raw_text = chat_completion.choices[0].message.content.strip()
            print(f"[Groq] Response received ({len(raw_text)} chars)")
        except Exception as groq_e:
            print(f"[Groq] Fallback also failed: {groq_e}")
            raise ValueError(f"Both Gemini and Groq fallback failed. Groq error: {groq_e}")

    try:
        clean_text = clean_json_response(raw_text)
        schedule = json.loads(clean_text)

        if not isinstance(schedule, list):
            print(f"[LLM] Response is not a list, wrapping...")
            schedule = [schedule]

        print(f"[LLM] Parsed {len(schedule)} tasks from response")
        return schedule

    except json.JSONDecodeError as e:
        print(f"[LLM] JSON parse error: {e}")
        print(f"[LLM] Raw response: {raw_text[:500]}")
        raise ValueError(f"LLM returned invalid JSON: {e}")
