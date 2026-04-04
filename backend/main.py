from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from datetime import datetime
import re
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import engine, get_db, Base, SessionLocal
from models import User, DailyMetrics, Goal, ScheduleItem, AgentAction, GitHubAccount, LeetCodeAccount
from auth import authenticate_user, create_access_token, get_current_user, get_current_user_optional, get_password_hash, GUEST_USER_EMAIL
from services.github_service import sync_github_data
from services.leetcode_service import sync_leetcode_data

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

app = FastAPI(title="Digital Twin Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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

DEFAULT_TWIN_STATE = {
    "profile": {
        "name": "Guest Learner",
        "university": "Your Institution",
        "status": "Active"
    },
    "metrics": {
        "coding_streak_days": 0,
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
            {"time": "09:00 AM", "action": "Welcome to your digital twin dashboard."}
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
            "focus_score": metrics.focus_score if metrics else 0,
            "last_updated": metrics.date.isoformat() if metrics else None
        }
    }

@app.get("/api/twin/state")
def get_state():
    return DEFAULT_TWIN_STATE

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
    sleep_match = re.search(r'slept.*?(\d+)|sleep.*?(\d+)', text)
    if sleep_match:
        hours = float(sleep_match.group(1) or sleep_match.group(2))
        metrics.sleep_deficit_hours = max(0, metrics.sleep_deficit_hours - hours)
        extracted_actions.append(f"Extracted sleep: {hours}h")
        
        # Heal state if sleep is good
        if metrics.sleep_deficit_hours < 2:
            metrics.current_stress_score = 4.0

    # Simulate extracting coding data
    if "leetcode" in text or "code" in text or "github" in text:
        metrics.coding_streak_days += 1
        metrics.current_stress_score += 0.5
        extracted_actions.append("Extracted coding activity")

    # Simulate extracting stress
    if "stress" in text or "tired" in text or "exhausted" in text:
        metrics.current_stress_score = min(10, metrics.current_stress_score + 1)
        extracted_actions.append("Detected high stress")

    metrics.focus_score = min(100, metrics.coding_streak_days * 10)
    db.commit()

    agent_action = AgentAction(user_id=guest.id, action=f"Journal: {', '.join(extracted_actions) if extracted_actions else 'Processed entry'}")
    db.add(agent_action)
    db.commit()

    return {"message": "Journal processed"}