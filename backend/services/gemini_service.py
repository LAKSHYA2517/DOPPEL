"""
Gemini Service — Generates study schedules from the Student State Vector (SSV).
"""
import json
import os
from datetime import datetime
from google import genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def generate_schedule(ssv: dict) -> list[dict]:
    """Send SSV to Gemini and get back a structured schedule as a list of task dicts."""
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

SYLLABI TO COMPLETE:
{syllabi_text}
{incomplete_text}

RULES:
1. Create a schedule for EACH DAY from {today} until the furthest deadline.
2. For each day, include 4-8 tasks spread across the day (morning to evening).
3. Include SPECIFIC LeetCode problems by their exact name when relevant to syllabus topics. For example, if studying arrays, suggest "Two Sum", "Best Time to Buy and Sell Stock", etc.
4. For LeetCode tasks, set verification_type to "leetcode" and put the problem name in verification_data.
5. If GitHub is connected and relevant, include GitHub tasks like "Push today's code to GitHub". Set verification_type to "github".
6. Include well-being tasks (breaks, exercise, sleep reminders) based on stress/sleep state.
7. If stress is high (>7), add more breaks and lighter workload.
8. If there are incomplete tasks from past days, reschedule them into the earliest available slots.
9. Balance study sessions with practice (LeetCode) and project work.
10. Each task needs a time slot (e.g. "09:00 AM"), a type, and proper verification info.

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

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        raw_text = response.text.strip()
        print(f"[Gemini] Response received ({len(raw_text)} chars)")

        # Clean up response — strip markdown code fences if present
        if raw_text.startswith("```"):
            # Remove ```json and ``` wrappers
            lines = raw_text.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            raw_text = "\n".join(lines)

        schedule = json.loads(raw_text)

        if not isinstance(schedule, list):
            print(f"[Gemini] Response is not a list, wrapping...")
            schedule = [schedule]

        print(f"[Gemini] Parsed {len(schedule)} tasks from response")
        return schedule

    except json.JSONDecodeError as e:
        print(f"[Gemini] JSON parse error: {e}")
        print(f"[Gemini] Raw response: {raw_text[:500]}")
        raise ValueError(f"Gemini returned invalid JSON: {e}")
    except Exception as e:
        print(f"[Gemini] Exception: {e}")
        raise
