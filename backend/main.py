from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(title="Digital Twin Agent API",version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TWIN_STATE = {
    "profile": {
        "name": "Lakshya",
        "university": "Vellore Institute of Technology",
        "status": "Active"
    },
    "metrics": {
        "coding_streak_days": 14,
        "focus_score": 65,            # New metric (0-100)
        "current_stress_score": 8.5,  # High stress trigger
        "sleep_deficit_hours": 5.0
    },
    "goals": [
        {"name": "Master Dynamic Programming", "progress": 60},
        {"name": "Maintain 8 Hours Sleep", "progress": 45}
    ],
    "agent_status": {
        "needs_intervention": True,
        "agent_message": "Critical sleep deficit detected. Cognitive load is high. I have autonomously rescheduled tonight's algorithm practice to tomorrow.",
        "history": [
            {"time": "10:00 AM", "action": "Detected skipped breakfast. Flagged energy dip risk."},
            {"time": "02:30 PM", "action": "Noticed 3 hours of continuous study. Suggested 15m screen break."}
        ]
    },
    "schedule": [
        {"id": 1, "time": "09:00 AM", "task": "Operating Systems Lecture", "type": "Academic", "status": "completed"},
        {"id": 2, "time": "02:00 PM", "task": "Capstone Project Work", "type": "Project", "status": "pending"},
        {"id": 3, "time": "08:00 PM", "task": "Advanced Algorithmic Practice", "type": "Coding", "status": "agent_blocked"}, 
        {"id": 4, "time": "08:30 PM", "task": "Mandatory Recovery Time", "type": "Well-being", "status": "agent_added"}
    ]
}

class LogData(BaseModel):
    activity_type: str # 'sleep', 'coding', 'study'
    duration_hours: float

@app.get("/api/twin/state")
def get_state():
    return TWIN_STATE

@app.post("/api/twin/log")
def log_activity(data: LogData):
    timestamp = datetime.now().strftime("%I:%M %p")
    
    if data.activity_type == "sleep":
        TWIN_STATE["metrics"]["sleep_deficit_hours"] = max(0, TWIN_STATE["metrics"]["sleep_deficit_hours"] - data.duration_hours)
        TWIN_STATE["goals"][1]["progress"] = min(100, TWIN_STATE["goals"][1]["progress"] + (data.duration_hours * 5))
        
        if TWIN_STATE["metrics"]["sleep_deficit_hours"] < 2:
            TWIN_STATE["metrics"]["current_stress_score"] = 4.0
            TWIN_STATE["agent_status"]["needs_intervention"] = False
            TWIN_STATE["agent_status"]["agent_message"] = "Metrics stabilized. Schedule optimized for peak productivity."
            TWIN_STATE["schedule"][2]["status"] = "pending" # Unblock task
            TWIN_STATE["agent_status"]["history"].insert(0, {"time": timestamp, "action": "Sleep logged. Deficit cleared. Schedule restored."})
            
    elif data.activity_type == "coding":
        TWIN_STATE["metrics"]["coding_streak_days"] += 1
        TWIN_STATE["goals"][0]["progress"] = min(100, TWIN_STATE["goals"][0]["progress"] + 5)
        TWIN_STATE["metrics"]["current_stress_score"] += 0.5
        TWIN_STATE["agent_status"]["history"].insert(0, {"time": timestamp, "action": f"Logged {data.duration_hours}h coding. Streak updated."})
        
    elif data.activity_type == "study":
        TWIN_STATE["metrics"]["focus_score"] = min(100, TWIN_STATE["metrics"]["focus_score"] + 10)
        TWIN_STATE["metrics"]["current_stress_score"] += 1.0
        TWIN_STATE["agent_status"]["history"].insert(0, {"time": timestamp, "action": f"Deep work session logged ({data.duration_hours}h)."})

    return {"message": "Success", "new_state": TWIN_STATE}