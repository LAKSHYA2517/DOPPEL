from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)
    university = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    github_account = relationship("GitHubAccount", back_populates="user", uselist=False)
    leetcode_account = relationship("LeetCodeAccount", back_populates="user", uselist=False)
    metrics = relationship("DailyMetrics", back_populates="user")
    goals = relationship("Goal", back_populates="user")
    schedule_items = relationship("ScheduleItem", back_populates="user")
    agent_actions = relationship("AgentAction", back_populates="user")
    syllabi = relationship("Syllabus", back_populates="user")
    generated_schedules = relationship("GeneratedSchedule", back_populates="user")

class GitHubAccount(Base):
    __tablename__ = "github_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    email = Column(String, nullable=True)
    username = Column(String, nullable=True)
    access_token = Column(String, nullable=True)  # Encrypted or password fallback
    password = Column(String, nullable=True)
    last_sync = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="github_account")

class LeetCodeAccount(Base):
    __tablename__ = "leetcode_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    email = Column(String, nullable=True)
    username = Column(String, nullable=True)
    password = Column(String, nullable=True)
    last_sync = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="leetcode_account")

class DailyMetrics(Base):
    __tablename__ = "daily_metrics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, default=datetime.utcnow)
    coding_streak_days = Column(Integer, default=0)
    leetcode_streak_days = Column(Integer, default=0)
    focus_score = Column(Float, default=0.0)
    current_stress_score = Column(Float, default=0.0)
    sleep_deficit_hours = Column(Float, default=0.0)

    user = relationship("User", back_populates="metrics")

class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    progress = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="goals")

class ScheduleItem(Base):
    __tablename__ = "schedule_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    time = Column(String)
    task = Column(String)
    type = Column(String)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="schedule_items")

class AgentAction(Base):
    __tablename__ = "agent_actions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    action = Column(Text)

    user = relationship("User", back_populates="agent_actions")

class Syllabus(Base):
    __tablename__ = "syllabi"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    pdf_filename = Column(String, nullable=True)
    pdf_data = Column(LargeBinary, nullable=True)
    deadline = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="syllabi")


class GeneratedSchedule(Base):
    __tablename__ = "generated_schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    syllabus_id = Column(Integer, ForeignKey("syllabi.id"), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    ssv_snapshot = Column(Text, nullable=True)  # JSON string of the SSV used
    gemini_raw_response = Column(Text, nullable=True)

    user = relationship("User", back_populates="generated_schedules")
    tasks = relationship("ScheduleTask", back_populates="schedule", cascade="all, delete-orphan")


class ScheduleTask(Base):
    __tablename__ = "schedule_tasks"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("generated_schedules.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(String, nullable=False)          # "2026-04-05"
    time = Column(String, nullable=True)            # "09:00 AM"
    task = Column(String, nullable=False)
    type = Column(String, default="Academic")       # Academic, LeetCode, GitHub, Well-being, Coding, Project
    status = Column(String, default="pending")      # pending, completed, missed, auto_verified
    verification_type = Column(String, default="manual")  # manual, leetcode, github
    verification_data = Column(String, nullable=True)     # e.g. problem slug, repo name
    order = Column(Integer, default=0)

    schedule = relationship("GeneratedSchedule", back_populates="tasks")