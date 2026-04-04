from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
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