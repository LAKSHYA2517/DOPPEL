"""
SSV (Student State Vector) Builder
Aggregates all user data into a single structured dictionary for Gemini.
"""
import json
from datetime import datetime
from sqlalchemy.orm import Session
from models import (
    User, GitHubAccount, LeetCodeAccount, DailyMetrics,
    Syllabus, AgentAction, ScheduleTask, GeneratedSchedule
)


def build_ssv(db: Session, user_id: int) -> dict:
    """Build the Student State Vector from all data sources."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return {}

    # --- Student profile ---
    student = {
        "name": user.name or "Student",
        "university": user.university or "Unknown",
    }

    # --- GitHub data ---
    github_account = db.query(GitHubAccount).filter(GitHubAccount.user_id == user_id).first()
    github_data = {
        "connected": bool(github_account),
        "username": github_account.username if github_account else None,
    }

    # --- LeetCode data ---
    leetcode_account = db.query(LeetCodeAccount).filter(LeetCodeAccount.user_id == user_id).first()
    leetcode_data = {
        "connected": bool(leetcode_account),
        "username": leetcode_account.username if leetcode_account else None,
    }

    # --- Metrics / Wellbeing ---
    metrics = db.query(DailyMetrics).filter(
        DailyMetrics.user_id == user_id
    ).order_by(DailyMetrics.date.desc()).first()

    wellbeing = {
        "coding_streak_days": metrics.coding_streak_days if metrics else 0,
        "leetcode_streak_days": metrics.leetcode_streak_days if metrics else 0,
        "focus_score": metrics.focus_score if metrics else 0,
        "stress_score": metrics.current_stress_score if metrics else 0,
        "sleep_deficit_hours": metrics.sleep_deficit_hours if metrics else 0,
    }

    # --- Latest journal entry ---
    latest_action = db.query(AgentAction).filter(
        AgentAction.user_id == user_id,
        AgentAction.action.like("Journal:%")
    ).order_by(AgentAction.timestamp.desc()).first()
    wellbeing["latest_journal"] = latest_action.action if latest_action else None

    # --- Syllabi ---
    syllabi = db.query(Syllabus).filter(Syllabus.user_id == user_id).all()
    today = datetime.now().date()
    syllabi_data = []
    for s in syllabi:
        deadline_date = s.deadline.date() if s.deadline else None
        days_remaining = (deadline_date - today).days if deadline_date else None
        syllabi_data.append({
            "id": s.id,
            "title": s.title,
            "content": s.content[:2000] if s.content else "(PDF uploaded, no text content)",
            "deadline": s.deadline.strftime("%Y-%m-%d") if s.deadline else None,
            "days_remaining": days_remaining,
        })

    # --- Incomplete tasks from existing schedule ---
    today_str = today.strftime("%Y-%m-%d")
    incomplete_tasks = []
    existing_tasks = db.query(ScheduleTask).filter(
        ScheduleTask.user_id == user_id,
        ScheduleTask.date < today_str,
        ScheduleTask.status.in_(["pending", "missed"]),
    ).all()
    for t in existing_tasks:
        incomplete_tasks.append({
            "date": t.date,
            "task": t.task,
            "type": t.type,
        })

    # --- Current schedule (today + future) ---
    current_tasks = db.query(ScheduleTask).filter(
        ScheduleTask.user_id == user_id,
        ScheduleTask.date >= today_str,
    ).order_by(ScheduleTask.date, ScheduleTask.order).all()
    current_schedule = {}
    for t in current_tasks:
        if t.date not in current_schedule:
            current_schedule[t.date] = []
        current_schedule[t.date].append({
            "task": t.task,
            "type": t.type,
            "status": t.status,
            "time": t.time,
        })

    ssv = {
        "student": student,
        "github": github_data,
        "leetcode": leetcode_data,
        "wellbeing": wellbeing,
        "syllabi": syllabi_data,
        "today": today_str,
        "incomplete_tasks_from_past": incomplete_tasks,
        "current_schedule": current_schedule,
    }

    print(f"[SSV] Built SSV with {len(syllabi_data)} syllabi, {len(incomplete_tasks)} incomplete tasks")
    return ssv
