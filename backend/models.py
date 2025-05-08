from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
from datetime import datetime
from bson import ObjectId
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    is_admin = Column(Boolean, default=False)
    is_restricted = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user_info = relationship("User_info", back_populates="user", uselist=False)


class Submission(BaseModel):
    candidate_id: str
    question_id: str
    code_solve: str
    score: int = 0
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "pending"  # pending, success, failed
    execution_time: Optional[float] = None
    memory_used: Optional[float] = None
    test_cases_passed: Optional[int] = None
    total_test_cases: Optional[int] = None


class UserProgress(BaseModel):
    user_id: str
    question_ids: List[str] = []  # List of solved question IDs
    total_score: int = 0  # Sum of max scores from submissions
    last_submission: Optional[datetime] = None


class UserProfile(BaseModel):
    user_id: str
    username: Optional[str] = None
    profile_picture: Optional[str] = None
    bio: Optional[str] = None
    social_links: Dict[str, str] = {
        "github": "",
        "linkedin": "",
        "portfolio": "",
        "company": ""
    }
    visibility_settings: Dict[str, bool] = {
        "github": True,
        "linkedin": True,
        "portfolio": True,
        "company": True
    }
    achievements: List[Dict[str, str]] = []  # For future achievement system
    badges: List[str] = []  # For future badge system
    preferred_languages: List[str] = []
    created_at: datetime
    updated_at: datetime


class User_info(Base):
    __tablename__ = "user_info"

    id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    user_name = Column(String, nullable=False)
    bio = Column(String, default="Hey! I am learning Data Science & AI. I will be the Best AI expert in the world by practising AI on Algo Crafters.")
    profile_picture = Column(String, nullable=True)
    total_questions_solved = Column(Integer, default=0)
    total_score = Column(Integer, default=0)
    top_percentage = Column(Float, default=100.0)
    linkedin_url = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="user_info")
    achievements = relationship("Achievement", back_populates="user_info")
    activity_logs = relationship("ActivityLog", back_populates="user_info")


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_info.id"))
    title = Column(String, nullable=False)
    description = Column(String)
    icon_type = Column(String, default="medal")  # medal or trophy
    date_earned = Column(DateTime(timezone=True), server_default=func.now())

    user_info = relationship("User_info", back_populates="achievements")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user_info.id"))
    activity_type = Column(String, nullable=False)  # e.g., "question_solved", "achievement_earned"
    activity_date = Column(DateTime(timezone=True), server_default=func.now())
    details = Column(String)

    user_info = relationship("User_info", back_populates="activity_logs")


# MongoDB Collection Names
SUBMISSIONS_COLLECTION = "submissions"
USER_PROGRESS_COLLECTION = "user_progress" 
PROFILE_COLLECTION = 'User_info' 
