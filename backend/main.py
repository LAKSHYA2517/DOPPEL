from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import re
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import engine, get_db, Base, SessionLocal
from models import User, DailyMetrics, Goal, ScheduleItem, AgentAction, GitHubAccount, LeetCodeAccount, Syllabus, GeneratedSchedule, ScheduleTask
from auth import authenticate_user, create_access_token, get_current_user, get_current_user_optional, get_password_hash, GUEST_USER_EMAIL
from services.github_service import sync_github_data, get_github_commits
from services.leetcode_service import sync_leetcode_data, get_recent_ac_submissions
from services.ssv_service import build_ssv
from services.gemini_service import generate_schedule
import json

# Create database tables
Base.metadata.create_all(bind=engine)


def add_column_if_missing(table_name: str, column_definition: str):
    with engine.connect() as conn:
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        existing_columns = [row[1] for row in result]
        column_name = column_definition.split()[0]
        if column_name not in existing_columns:
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_definition}"))


def ensure_account_columns():
    add_column_if_missing("github_accounts", "email VARCHAR")
    add_column_if_missing("github_accounts", "password VARCHAR")
    add_column_if_missing("leetcode_accounts", "email VARCHAR")
    add_column_if_missing("leetcode_accounts", "password VARCHAR")
    add_column_if_missing("daily_metrics", "leetcode_streak_days INTEGER DEFAULT 0")


ensure_account_columns()


def ensure_guest_user():
    db = SessionLocal()
    try:
        guest = db.query(User).filter(User.email == GUEST_USER_EMAIL).first()
        if not guest:
            guest = User(
                email=GUEST_USER_EMAIL,
                hashed_password=get_password_hash("guest-password"),
                name="Guest Learner",
                university="Your Institution"
            )
            db.add(guest)
            db.commit()
            db.refresh(guest)
            default_goals = [
                Goal(user_id=guest.id, name="Master Dynamic Programming", progress=20),
                Goal(user_id=guest.id, name="Maintain 8 Hours Sleep", progress=35)
            ]
            default_schedule = [
                ScheduleItem(user_id=guest.id, time="09:00 AM", task="Operating Systems Lecture", type="Academic", status="completed"),
                ScheduleItem(user_id=guest.id, time="02:00 PM", task="Capstone Project Work", type="Project", status="pending"),
                ScheduleItem(user_id=guest.id, time="08:00 PM", task="Advanced Algorithmic Practice", type="Coding", status="pending"),
                ScheduleItem(user_id=guest.id, time="08:30 PM", task="Mandatory Recovery Time", type="Well-being", status="pending")
            ]
            db.add_all(default_goals + default_schedule)
            db.commit()
    finally:
        db.close()

ensure_guest_user()

app = FastAPI(title="DOPPEL API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for the deployed frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    university: str = None

class GitHubConnect(BaseModel):
    username: str
    password: str

class LeetCodeConnect(BaseModel):
    username: str
    password: str

class JournalData(BaseModel):
    text: str

class SyllabusCreate(BaseModel):
    title: str
    content: str
    deadline: str  # ISO format date string

class ProfileUpdate(BaseModel):
    name: str
    university: str

DEFAULT_TWIN_STATE = {
    "profile": {
        "name": "Guest Learner",
        "university": "Your Institution",
        "status": "Active"
    },
    "metrics": {
        "coding_streak_days": 0,
        "leetcode_streak_days": 0,
        "focus_score": 65,
        "current_stress_score": 5.0,
        "sleep_deficit_hours": 2.0
    },
    "goals": [
        {"name": "Master Dynamic Programming", "progress": 20},
        {"name": "Maintain 8 Hours Sleep", "progress": 35}
    ],
    "agent_status": {
        "needs_intervention": False,
        "agent_message": "Welcome! Link GitHub or LeetCode to enable real commit and streak tracking.",
        "history": [
            {"time": "09:00 AM", "action": "Welcome to your DOPPEL dashboard."}
        ]
    },
    "schedule": [
        {"id": 1, "time": "09:00 AM", "task": "Operating Systems Lecture", "type": "Academic", "status": "completed"},
        {"id": 2, "time": "02:00 PM", "task": "Capstone Project Work", "type": "Project", "status": "pending"},
        {"id": 3, "time": "08:00 PM", "task": "Advanced Algorithmic Practice", "type": "Coding", "status": "pending"},
        {"id": 4, "time": "08:30 PM", "task": "Mandatory Recovery Time", "type": "Well-being", "status": "pending"}
    ]
}

# Auth endpoints
@app.post("/api/auth/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = get_password_hash(user.password)
    db_user = User(email=user.email, hashed_password=hashed_password, name=user.name, university=user.university)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create default data
    default_goals = [
        Goal(user_id=db_user.id, name="Master Dynamic Programming", progress=0),
        Goal(user_id=db_user.id, name="Maintain 8 Hours Sleep", progress=0)
    ]
    default_schedule = [
        ScheduleItem(user_id=db_user.id, time="09:00 AM", task="Operating Systems Lecture", type="Academic", status="pending"),
        ScheduleItem(user_id=db_user.id, time="02:00 PM", task="Capstone Project Work", type="Project", status="pending"),
        ScheduleItem(user_id=db_user.id, time="08:00 PM", task="Advanced Algorithmic Practice", type="Coding", status="pending"),
        ScheduleItem(user_id=db_user.id, time="08:30 PM", task="Mandatory Recovery Time", type="Well-being", status="pending")
    ]
    db.add_all(default_goals + default_schedule)
    db.commit()
    
    access_token = create_access_token(data={"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/github/connect")
def connect_github(github: GitHubConnect, db: Session = Depends(get_db)):
    # Use guest user if no auth
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        raise HTTPException(status_code=500, detail="Guest user not found")
    
    username = github.username
    github_account = db.query(GitHubAccount).filter(GitHubAccount.user_id == guest.id).first()
    if github_account:
        github_account.email = None
        github_account.password = github.password
        github_account.username = username
        github_account.access_token = github.password
        github_account.last_sync = datetime.now()
    else:
        github_account = GitHubAccount(
            user_id=guest.id,
            email=None,
            password=github.password,
            username=username,
            access_token=github.password,
            last_sync=datetime.now()
        )
        db.add(github_account)
    db.commit()
    return {"message": "GitHub connected"}

@app.post("/api/leetcode/connect")
def connect_leetcode(leetcode: LeetCodeConnect, db: Session = Depends(get_db)):
    # Use guest user if no auth
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        raise HTTPException(status_code=500, detail="Guest user not found")
    
    username = leetcode.username
    leetcode_account = db.query(LeetCodeAccount).filter(LeetCodeAccount.user_id == guest.id).first()
    if leetcode_account:
        leetcode_account.email = None
        leetcode_account.password = leetcode.password
        leetcode_account.username = username
        leetcode_account.last_sync = datetime.now()
    else:
        leetcode_account = LeetCodeAccount(
            user_id=guest.id,
            email=None,
            password=leetcode.password,
            username=username,
            last_sync=datetime.now()
        )
        db.add(leetcode_account)
    db.commit()
    return {"message": "LeetCode connected"}

@app.get("/api/account/status")
def get_account_status(db: Session = Depends(get_db)):
    """Get current GitHub and LeetCode account connection status and metrics"""
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        return {"github": None, "leetcode": None, "error": "Guest user not found"}
    
    github = db.query(GitHubAccount).filter(GitHubAccount.user_id == guest.id).first()
    leetcode = db.query(LeetCodeAccount).filter(LeetCodeAccount.user_id == guest.id).first()
    metrics = db.query(DailyMetrics).filter(DailyMetrics.user_id == guest.id).order_by(DailyMetrics.date.desc()).first()
    
    return {
        "github": {
            "connected": bool(github),
            "email": github.email if github else None,
            "username": github.username if github else None,
            "last_sync": github.last_sync.isoformat() if github and github.last_sync else None
        },
        "leetcode": {
            "connected": bool(leetcode),
            "email": leetcode.email if leetcode else None,
            "username": leetcode.username if leetcode else None,
            "last_sync": leetcode.last_sync.isoformat() if leetcode and leetcode.last_sync else None
        },
        "metrics": {
            "coding_streak_days": metrics.coding_streak_days if metrics else 0,
            "leetcode_streak_days": metrics.leetcode_streak_days if metrics else 0,
            "focus_score": metrics.focus_score if metrics else 0,
            "last_updated": metrics.date.isoformat() if metrics else None
        }
    }

@app.post("/api/profile/update")
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db)):
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        raise HTTPException(status_code=500, detail="Guest user not found")
        
    guest.name = data.name
    guest.university = data.university
    db.commit()
    return {"message": "Profile updated successfully"}

@app.get("/api/twin/state")
def get_state(db: Session = Depends(get_db)):
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    
    # Deep copy to avoid mutating the global dictionary
    import copy
    state = copy.deepcopy(DEFAULT_TWIN_STATE)
    
    if not guest:
        return state
        
    state["profile"]["name"] = guest.name or "Guest Learner"
    state["profile"]["university"] = guest.university or "Your Institution"
        
    metrics = db.query(DailyMetrics).filter(DailyMetrics.user_id == guest.id).order_by(DailyMetrics.date.desc()).first()
    if metrics:
        state["metrics"] = {
            "coding_streak_days": metrics.coding_streak_days,
            "leetcode_streak_days": metrics.leetcode_streak_days,
            "focus_score": metrics.focus_score,
            "current_stress_score": metrics.current_stress_score,
            "sleep_deficit_hours": metrics.sleep_deficit_hours
        }
        
    goals = db.query(Goal).filter(Goal.user_id == guest.id).all()
    if goals:
        state["goals"] = [{"name": g.name, "progress": g.progress} for g in goals]
        
    actions = db.query(AgentAction).filter(AgentAction.user_id == guest.id).order_by(AgentAction.timestamp.desc()).limit(5).all()
    if actions:
        state["agent_status"]["history"] = [
            {"time": a.timestamp.strftime("%I:%M %p"), "action": a.action} 
            for a in actions
        ]
        
    return state

@app.post("/api/twin/sync_apis")
def sync_apis(db: Session = Depends(get_db)):
    print("\n[SYNC] Starting API sync...", flush=True)
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        print("[SYNC] Guest user not found!", flush=True)
        return {"message": "APIs Synced", "error": "Guest user not found"}

    # Sync GitHub
    print("[SYNC] Checking for GitHub account...", flush=True)
    github_account = db.query(GitHubAccount).filter(GitHubAccount.user_id == guest.id).first()
    github_metrics = None
    if github_account:
        print(f"[SYNC] GitHub account found: {github_account.username}", flush=True)
        github_metrics = sync_github_data(db, guest.id)
        github_account.last_sync = datetime.now()
        db.commit()
        print(f"[SYNC] GitHub sync completed. Metrics: {github_metrics}", flush=True)
    else:
        print("[SYNC] No GitHub account connected", flush=True)

    # Sync LeetCode
    print("[SYNC] Checking for LeetCode account...", flush=True)
    leetcode_account = db.query(LeetCodeAccount).filter(LeetCodeAccount.user_id == guest.id).first()
    leetcode_metrics = None
    if leetcode_account:
        print(f"[SYNC] LeetCode account found: {leetcode_account.username}", flush=True)
        leetcode_metrics = sync_leetcode_data(db, guest.id)
        leetcode_account.last_sync = datetime.now()
        db.commit()
        print(f"[SYNC] LeetCode sync completed. Metrics: {leetcode_metrics}", flush=True)
    else:
        print("[SYNC] No LeetCode account connected", flush=True)

    action = "API Sync: "
    if github_metrics:
        action += f"Updated GitHub streak to {github_metrics.coding_streak_days} days. "
    if leetcode_metrics:
        action += f"Updated LeetCode problems."

    agent_action = AgentAction(user_id=guest.id, action=action)
    db.add(agent_action)
    db.commit()

    return {"message": "APIs Synced"}

@app.post("/api/twin/journal")
def process_journal(data: JournalData, db: Session = Depends(get_db)):
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        return {"message": "Journal processed"}

    timestamp = datetime.now().strftime("%I:%M %p")
    text = data.text.lower()

    extracted_actions = []
    metrics = db.query(DailyMetrics).filter(DailyMetrics.user_id == guest.id).order_by(DailyMetrics.date.desc()).first()
    if not metrics:
        metrics = DailyMetrics(user_id=guest.id)
        db.add(metrics)
        db.commit()
        db.refresh(metrics)

    # Simulate extracting sleep data
    sleep_match = re.search(r'slept\s+(?:for\s+)?(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s+hours?\s+(?:of\s+)?sleep|sleep.*?(\d+(?:\.\d+)?)|got\s+(?:only\s+)?(\d+(?:\.\d+)?)\s+hours?', text)
    if sleep_match:
        matched_str = next(g for g in sleep_match.groups() if g is not None)
        hours = float(matched_str)
        metrics.sleep_deficit_hours = hours  # Now storing raw hours!
        if hours < 7:
            metrics.current_stress_score = min(10.0, metrics.current_stress_score + 1.5)
            extracted_actions.append(f"Recorded poor sleep: {hours}h")
        else:
            metrics.current_stress_score = max(0.0, metrics.current_stress_score - 1.0)
            extracted_actions.append(f"Recorded good sleep: {hours}h")

    # Simulate extracting coding data
    if "leetcode" in text or "code" in text or "github" in text:
        metrics.coding_streak_days = (metrics.coding_streak_days or 0) + 1
        metrics.leetcode_streak_days = (metrics.leetcode_streak_days or 0) + 1
        metrics.current_stress_score += 0.5
        extracted_actions.append("Extracted coding activity")

    # Simulate extracting stress
    crisis_keywords = ["suicide", "kill myself", "give up", "can't take it"]
    if any(k in text for k in crisis_keywords):
        metrics.current_stress_score = 10.0
        extracted_actions.append("Detected severe crisis/burnout")
    elif any(k in text for k in ["stress", "tired", "exhausted", "burnout", "depressed", "hopeless"]):
        metrics.current_stress_score = min(10.0, metrics.current_stress_score + 2.0)
        extracted_actions.append("Detected high stress")
    elif any(k in text for k in ["good", "great", "relaxed"]):
        metrics.current_stress_score = max(0.0, metrics.current_stress_score - 2.0)
        extracted_actions.append("Detected reduced stress")

    # Calculate dynamic focus score
    base_focus = 65.0
    streak_bonus = min(20.0, (metrics.coding_streak_days or 0) * 5.0)
    
    # Sleep penalty: if they sleep under 7 hours, they get penalized 5 pts per hour lost
    actual_sleep = metrics.sleep_deficit_hours or 0.0
    sleep_penalty = max(0.0, 7.0 - actual_sleep) * 5.0
    stress_penalty = (metrics.current_stress_score or 0.0) * 2.0
    
    new_focus = base_focus + streak_bonus - sleep_penalty - stress_penalty
    metrics.focus_score = max(0.0, min(100.0, new_focus))
    db.commit()

    agent_action = AgentAction(user_id=guest.id, action=f"Journal: {', '.join(extracted_actions) if extracted_actions else 'Processed entry'}")
    db.add(agent_action)
    db.commit()

    return {"message": "Journal processed"}

# --- Syllabus Endpoints ---

@app.post("/api/syllabus")
def create_syllabus(data: SyllabusCreate, db: Session = Depends(get_db)):
    """Create a syllabus from text input."""
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        raise HTTPException(status_code=500, detail="Guest user not found")

    try:
        deadline_dt = datetime.fromisoformat(data.deadline)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid deadline format. Use ISO format (YYYY-MM-DD).")

    syllabus = Syllabus(
        user_id=guest.id,
        title=data.title,
        content=data.content,
        deadline=deadline_dt,
    )
    db.add(syllabus)
    db.commit()
    db.refresh(syllabus)
    return {"message": "Syllabus created", "id": syllabus.id}


@app.post("/api/syllabus/upload")
async def upload_syllabus(
    title: str = Form(...),
    deadline: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Create a syllabus from a PDF upload."""
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        raise HTTPException(status_code=500, detail="Guest user not found")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    try:
        deadline_dt = datetime.fromisoformat(deadline)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid deadline format. Use ISO format (YYYY-MM-DD).")

    pdf_bytes = await file.read()

    syllabus = Syllabus(
        user_id=guest.id,
        title=title,
        pdf_filename=file.filename,
        pdf_data=pdf_bytes,
        deadline=deadline_dt,
    )
    db.add(syllabus)
    db.commit()
    db.refresh(syllabus)
    return {"message": "Syllabus uploaded", "id": syllabus.id}


# --- Health Data Endpoint ---

from services.health_service import parse_health_export

@app.post("/api/health/upload")
async def upload_health_data(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        raise HTTPException(status_code=500, detail="Guest user not found")

    contents = await file.read()
    filename = file.filename or ""

    try:
        health_data = parse_health_export(contents, filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing health file: {e}")
        
    extracted_actions = []
    
    # Update DailyMetrics
    metrics = db.query(DailyMetrics).filter(DailyMetrics.user_id == guest.id).order_by(DailyMetrics.date.desc()).first()
    if not metrics:
        metrics = DailyMetrics(user_id=guest.id)
        db.add(metrics)
        
    if health_data.get("hours_slept"):
        metrics.sleep_deficit_hours = health_data["hours_slept"]
        if health_data["hours_slept"] < 7:
            metrics.current_stress_score = min(10.0, metrics.current_stress_score + 1.5)
        else:
            metrics.current_stress_score = max(0.0, metrics.current_stress_score - 1.0)
        extracted_actions.append(f"Parsed {health_data['hours_slept']}h sleep from file")
        
    if health_data.get("stress_modifier"):
        metrics.current_stress_score = min(10.0, metrics.current_stress_score + health_data["stress_modifier"])
        extracted_actions.append("Adjusted stress from file metrics")

    # Recalculate focus
    base_focus = 65.0
    streak_bonus = min(20.0, (metrics.coding_streak_days or 0) * 5.0)
    actual_sleep = metrics.sleep_deficit_hours or 0.0
    sleep_penalty = max(0.0, 7.0 - actual_sleep) * 5.0
    stress_penalty = (metrics.current_stress_score or 0.0) * 2.0
    
    metrics.focus_score = max(0.0, min(100.0, base_focus + streak_bonus - sleep_penalty - stress_penalty))
    db.commit()

    if extracted_actions:
        action = AgentAction(user_id=guest.id, action=f"Health Sync: {', '.join(extracted_actions)}")
        db.add(action)
        db.commit()

    return {"message": "Health data synced successfully", "data": health_data}


@app.get("/api/syllabus")
def list_syllabi(db: Session = Depends(get_db)):
    """List all syllabi for the guest user."""
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        return []

    syllabi = db.query(Syllabus).filter(Syllabus.user_id == guest.id).order_by(Syllabus.created_at.desc()).all()
    return [
        {
            "id": s.id,
            "title": s.title,
            "content": s.content[:200] if s.content else None,
            "has_pdf": bool(s.pdf_data),
            "pdf_filename": s.pdf_filename,
            "deadline": s.deadline.isoformat() if s.deadline else None,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in syllabi
    ]


@app.get("/api/syllabus/{syllabus_id}/pdf")
def download_syllabus_pdf(syllabus_id: int, db: Session = Depends(get_db)):
    """Download the PDF for a syllabus entry."""
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus or not syllabus.pdf_data:
        raise HTTPException(status_code=404, detail="PDF not found")

    return Response(
        content=syllabus.pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{syllabus.pdf_filename or "syllabus.pdf"}"'},
    )


@app.delete("/api/syllabus/{syllabus_id}")
def delete_syllabus(syllabus_id: int, db: Session = Depends(get_db)):
    """Delete a syllabus entry."""
    syllabus = db.query(Syllabus).filter(Syllabus.id == syllabus_id).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")

    db.delete(syllabus)
    db.commit()
    return {"message": "Syllabus deleted"}


# --- Schedule Generation & Management Endpoints ---

def _get_guest(db: Session):
    """Helper to get guest user."""
    GUEST_EMAIL = "guest@twinagent.local"
    guest = db.query(User).filter(User.email == GUEST_EMAIL).first()
    if not guest:
        raise HTTPException(status_code=500, detail="Guest user not found")
    return guest


class ScheduleGenerateRequest(BaseModel):
    difficulty: str = "auto"  # auto, easy, medium, hard


@app.post("/api/schedule/generate")
def generate_schedule_endpoint(request: ScheduleGenerateRequest = None, db: Session = Depends(get_db)):
    """Build SSV, call Gemini, store schedule in DB."""
    difficulty = (request.difficulty if request else "auto") or "auto"
    guest = _get_guest(db)

    # Check that at least one syllabus exists
    syllabi = db.query(Syllabus).filter(Syllabus.user_id == guest.id).all()
    if not syllabi:
        raise HTTPException(status_code=400, detail="Add at least one syllabus before generating a schedule.")

    # Build SSV
    print("\n[Schedule] Building SSV...", flush=True)
    ssv = build_ssv(db, guest.id)

    # Call Gemini
    print("[Schedule] Calling Gemini...", flush=True)
    try:
        tasks_data = generate_schedule(ssv, difficulty=difficulty)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"[Schedule] Gemini error: {e}", flush=True)
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

    # Delete existing schedule
    old_schedules = db.query(GeneratedSchedule).filter(GeneratedSchedule.user_id == guest.id).all()
    for old in old_schedules:
        db.delete(old)
    db.flush()

    # Store new schedule
    gen_schedule = GeneratedSchedule(
        user_id=guest.id,
        ssv_snapshot=json.dumps(ssv),
        gemini_raw_response=json.dumps(tasks_data),
    )
    db.add(gen_schedule)
    db.flush()

    for i, task_data in enumerate(tasks_data):
        task = ScheduleTask(
            schedule_id=gen_schedule.id,
            user_id=guest.id,
            date=task_data.get("date", ssv["today"]),
            time=task_data.get("time", ""),
            task=task_data.get("task", "Untitled task"),
            type=task_data.get("type", "Academic"),
            status="pending",
            verification_type=task_data.get("verification_type", "manual"),
            verification_data=task_data.get("verification_data"),
            order=task_data.get("order", i),
        )
        db.add(task)

    db.commit()
    print(f"[Schedule] Stored {len(tasks_data)} tasks", flush=True)

    return {"message": f"Schedule generated with {len(tasks_data)} tasks", "task_count": len(tasks_data)}


@app.get("/api/schedule")
def get_schedule(db: Session = Depends(get_db)):
    """Get the current schedule grouped by date."""
    guest = _get_guest(db)

    tasks = db.query(ScheduleTask).filter(
        ScheduleTask.user_id == guest.id
    ).order_by(ScheduleTask.date, ScheduleTask.order).all()

    # Group by date
    schedule = {}
    for t in tasks:
        if t.date not in schedule:
            schedule[t.date] = []
        schedule[t.date].append({
            "id": t.id,
            "time": t.time,
            "task": t.task,
            "type": t.type,
            "status": t.status,
            "verification_type": t.verification_type,
            "verification_data": t.verification_data,
            "order": t.order,
        })

    # Sort dates
    sorted_schedule = []
    for date_str in sorted(schedule.keys()):
        sorted_schedule.append({
            "date": date_str,
            "tasks": schedule[date_str],
        })

    return {"schedule": sorted_schedule}


@app.patch("/api/schedule/task/{task_id}/toggle")
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    """Toggle a task between pending and completed (manual tasks only)."""
    task = db.query(ScheduleTask).filter(ScheduleTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status in ["pending", "missed"]:
        task.status = "completed"
    elif task.status == "completed":
        task.status = "pending"
    # auto_verified stays as-is

    db.commit()
    return {"message": f"Task toggled to {task.status}", "status": task.status}


@app.post("/api/schedule/verify")
def verify_tasks(db: Session = Depends(get_db)):
    """Auto-verify LeetCode and GitHub tasks by checking APIs."""
    guest = _get_guest(db)
    today_str = datetime.now().strftime("%Y-%m-%d")

    # Mark past pending tasks as missed
    past_pending = db.query(ScheduleTask).filter(
        ScheduleTask.user_id == guest.id,
        ScheduleTask.date < today_str,
        ScheduleTask.status == "pending",
    ).all()
    for t in past_pending:
        t.status = "missed"
    if past_pending:
        print(f"[Verify] Marked {len(past_pending)} past tasks as missed", flush=True)

    verified_count = 0

    # --- Verify LeetCode tasks ---
    leetcode_account = db.query(LeetCodeAccount).filter(LeetCodeAccount.user_id == guest.id).first()
    if leetcode_account and leetcode_account.username:
        submissions = get_recent_ac_submissions(leetcode_account.username)
        solved_titles = [t.lower() for t in submissions.get("titles", [])]
        solved_slugs = [s.lower() for s in submissions.get("slugs", [])]

        lc_tasks = db.query(ScheduleTask).filter(
            ScheduleTask.user_id == guest.id,
            ScheduleTask.verification_type == "leetcode",
            ScheduleTask.status.in_(["pending", "missed"]),
        ).all()

        for task in lc_tasks:
            vdata = (task.verification_data or "").lower()
            if vdata and (vdata in solved_titles or vdata in solved_slugs
                         or any(vdata in t for t in solved_titles)
                         or any(vdata in s for s in solved_slugs)):
                task.status = "auto_verified"
                verified_count += 1
                print(f"[Verify] LeetCode task auto-verified: {task.task}", flush=True)

    # --- Verify GitHub tasks ---
    github_account = db.query(GitHubAccount).filter(GitHubAccount.user_id == guest.id).first()
    if github_account and github_account.username:
        commits = get_github_commits(github_account.access_token, github_account.username, days=1)
        has_recent_commit = commits and commits[0] > 0

        if has_recent_commit:
            gh_tasks = db.query(ScheduleTask).filter(
                ScheduleTask.user_id == guest.id,
                ScheduleTask.verification_type == "github",
                ScheduleTask.date == today_str,
                ScheduleTask.status.in_(["pending", "missed"]),
            ).all()
            for task in gh_tasks:
                task.status = "auto_verified"
                verified_count += 1
                print(f"[Verify] GitHub task auto-verified: {task.task}", flush=True)

    db.commit()
    return {"message": f"Verification complete. {verified_count} tasks auto-verified.", "verified": verified_count}


@app.post("/api/schedule/adjust")
def adjust_schedule(request: ScheduleGenerateRequest = None, db: Session = Depends(get_db)):
    """Check for missed tasks and regenerate the remaining schedule."""
    difficulty = (request.difficulty if request else "auto") or "auto"
    guest = _get_guest(db)
    today_str = datetime.now().strftime("%Y-%m-%d")

    # Mark past pending as missed
    past_pending = db.query(ScheduleTask).filter(
        ScheduleTask.user_id == guest.id,
        ScheduleTask.date < today_str,
        ScheduleTask.status == "pending",
    ).all()
    for t in past_pending:
        t.status = "missed"
    db.commit()

    # Check if there are missed tasks that need adjustment
    missed_count = db.query(ScheduleTask).filter(
        ScheduleTask.user_id == guest.id,
        ScheduleTask.status == "missed",
    ).count()

    if missed_count == 0:
        return {"message": "No adjustment needed. All tasks on track."}

    # Rebuild SSV (which includes incomplete tasks) and regenerate
    ssv = build_ssv(db, guest.id)

    try:
        tasks_data = generate_schedule(ssv, difficulty=difficulty)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schedule adjustment failed: {str(e)}")

    # Delete only future tasks (keep completed/verified history)
    future_pending = db.query(ScheduleTask).filter(
        ScheduleTask.user_id == guest.id,
        ScheduleTask.date >= today_str,
        ScheduleTask.status.in_(["pending", "missed"]),
    ).all()
    for t in future_pending:
        db.delete(t)
    db.flush()

    # Get or create schedule record
    gen_schedule = db.query(GeneratedSchedule).filter(
        GeneratedSchedule.user_id == guest.id
    ).order_by(GeneratedSchedule.generated_at.desc()).first()

    if not gen_schedule:
        gen_schedule = GeneratedSchedule(user_id=guest.id)
        db.add(gen_schedule)
        db.flush()

    # Store new tasks
    new_count = 0
    for i, task_data in enumerate(tasks_data):
        task_date = task_data.get("date", today_str)
        if task_date >= today_str:  # Only add future tasks
            task = ScheduleTask(
                schedule_id=gen_schedule.id,
                user_id=guest.id,
                date=task_date,
                time=task_data.get("time", ""),
                task=task_data.get("task", "Untitled task"),
                type=task_data.get("type", "Academic"),
                status="pending",
                verification_type=task_data.get("verification_type", "manual"),
                verification_data=task_data.get("verification_data"),
                order=task_data.get("order", i),
            )
            db.add(task)
            new_count += 1

    db.commit()
    return {"message": f"Schedule adjusted. {missed_count} missed tasks rescheduled into {new_count} new tasks."}