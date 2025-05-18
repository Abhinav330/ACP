from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from bson import ObjectId
from database import (
    candidate_collection,
    questions_collection,
    submissions_collection,
    user_progress_collection,
    profile_collection,
    modules_collection
)

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, *args, **kwargs):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, _schema_generator: Any) -> Dict[str, Any]:
        return {"type": "string"}

class User(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    email: str = Field(unique=True, index=True)
    password: str
    is_admin: bool = Field(default=False)
    is_restricted: bool = Field(default=False)
    is_verified: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True

    @classmethod
    async def get_collection(cls):
        return candidate_collection

class UserInfo(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: PyObjectId
    user_name: str
    bio: str = Field(default="Hey! I am learning Data Science & AI. I will be the Best AI expert in the world by practising AI on Algo Crafters.")
    profile_picture: Optional[str] = None
    total_questions_solved: int = Field(default=0)
    total_score: int = Field(default=0)
    top_percentage: float = Field(default=100.0)
    linkedin_url: Optional[str] = None
    website_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True

    @classmethod
    async def get_collection(cls):
        return profile_collection

class Achievement(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: PyObjectId
    title: str
    description: Optional[str] = None
    icon_type: str = Field(default="medal")  # medal or trophy
    date_earned: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True

    @classmethod
    async def get_collection(cls):
        return profile_collection  # Achievements are stored in the user profile

class ActivityLog(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: PyObjectId
    activity_type: str  # e.g., "question_solved", "achievement_earned"
    activity_date: datetime = Field(default_factory=datetime.utcnow)
    details: Optional[str] = None

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True

    @classmethod
    async def get_collection(cls):
        return profile_collection  # Activity logs are stored in the user profile

class Submission(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    candidate_id: PyObjectId
    question_id: PyObjectId
    code_solve: str
    score: int
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    status: str
    execution_time: Optional[float] = None
    memory_used: Optional[float] = None
    test_cases_passed: Optional[int] = None
    total_test_cases: Optional[int] = None

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True

    @classmethod
    async def get_collection(cls):
        return submissions_collection

class UserProgress(BaseModel):
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    user_id: PyObjectId
    question_ids: List[PyObjectId] = []
    total_score: int = 0
    last_submission: Optional[datetime] = None

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True

    @classmethod
    async def get_collection(cls):
        return user_progress_collection

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

class User_info(BaseModel):
    user_id: PyObjectId
    user_name: str
    bio: str
    profile_picture: Optional[str] = None
    total_questions_solved: int
    total_score: int
    top_percentage: float
    linkedin_url: Optional[str] = None
    website_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    achievements: List[Dict[str, str]]
    activity_logs: List[Dict[str, str]]

# MongoDB Collection Names
SUBMISSIONS_COLLECTION = "submissions"
USER_PROGRESS_COLLECTION = "user_progress" 
PROFILE_COLLECTION = 'User_info' 

class UserSignup(BaseModel):
    email: EmailStr
    password: str
    firstName: Optional[str] = None
    lastName: str
    phone: Optional[str] = None
    company: Optional[str] = None
    is_admin: Optional[bool] = False
    is_restricted: Optional[bool] = False

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordResetRequest(BaseModel):
    email: str

class PasswordReset(BaseModel):
    token: str
    new_password: str

# Question models
class TestCase(BaseModel):
    input: str
    expected_output: str
    is_hidden: bool = False
    order: int
    points: int = 0

class Example(BaseModel):
    input: str
    output: str
    inputLanguage: str = "plaintext"
    outputLanguage: str = "plaintext"
    inputImage: Optional[Dict[str, str]] = None
    outputImage: Optional[Dict[str, str]] = None

class StarterCode(BaseModel):
    language: str
    code: str

class ImageData(BaseModel):
    url: str
    caption: str

class Question(BaseModel):
    title: str
    summary: str
    description: str
    category: List[str]
    difficulty: str
    points: int
    examples: List[Example]
    starterCodes: List[StarterCode] = []
    allowedLanguages: List[str] = ['python']
    testCases: List[TestCase] = []
    docker_runner: str = "only_python"
    images: List[ImageData] = []
    Q_type: str = "pandas"  # Module type: pandas, sklearn, ai
    working_driver: str = ""  # Working code solution

class QuestionCreate(Question):
    pass

class QuestionUpdate(Question):
    pass

class QuestionInDB(Question):
    id: str

class CodeExecutionRequest(BaseModel):
    code: str
    language: str
    question_id: str
    is_submission: bool = False
    docker_runner: str = "only_python"

async def get_last_successful_submission(user_id: str, question_id: str, db) -> Optional[Submission]:
    try:
        user_obj_id = ObjectId(user_id)
        question_obj_id = ObjectId(question_id)
    except Exception as e:
        print(f"Error converting IDs to ObjectId: {e}")
        return None

    submission = await db.submissions.find_one(
        {
            "candidate_id": user_obj_id,
            "question_id": question_obj_id,
            "status": "success"
        },
        sort=[("submitted_at", -1)]
    )
    if submission:
        return Submission(**submission)
    return None