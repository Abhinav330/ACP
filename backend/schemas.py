from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import datetime

class AchievementBase(BaseModel):
    title: str
    description: str
    icon_type: str
    date_earned: datetime

class ActivityLogBase(BaseModel):
    activity_type: str
    activity_date: datetime
    details: str

class ProfileBase(BaseModel):
    user_name: str
    bio: Optional[str] = None
    profile_picture: Optional[str] = None
    linkedin_url: Optional[str] = None
    website_url: Optional[str] = None
    total_questions_solved: int = 0
    total_score: int = 0
    top_percentage: float = 100.0

class ProfileCreate(ProfileBase):
    pass

class ProfileUpdate(ProfileBase):
    user_name: Optional[str] = None

class PrivateProfile(ProfileBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PublicProfile(ProfileBase):
    achievements: List[AchievementBase] = []
    activity_logs: List[ActivityLogBase] = []

    class Config:
        from_attributes = True

class PasswordChange(BaseModel):
    otp: str
    new_password: str 