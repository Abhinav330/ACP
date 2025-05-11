from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from pymongo import MongoClient
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Callable, Union
import bcrypt
from datetime import datetime, timezone, timedelta
import uvicorn
from bson import ObjectId
import subprocess
import json
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from models import Submission, UserProgress, SUBMISSIONS_COLLECTION, USER_PROGRESS_COLLECTION
from email_service import email_service
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import secrets
from jose import jwt, JWTError
import random
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import asyncio

# Load environment variables from .env file
load_dotenv()

# JWT configuration for NextAuth.js compatibility
JWT_SECRET = os.getenv("NEXTAUTH_SECRET")  # Use the same secret as NextAuth
if not JWT_SECRET:
    JWT_SECRET = secrets.token_hex(32)
    print(f"Warning: NEXTAUTH_SECRET not found in environment variables. Using generated secret: {JWT_SECRET}")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days to match NextAuth default

# Rate limiting configuration
limiter = Limiter(key_func=get_remote_address)

# MongoDB connection setup
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "alterhire")

# Initialize Motor async client with connection options
client = AsyncIOMotorClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,  # 5 seconds timeout
    connectTimeoutMS=10000,  # 10 seconds connection timeout
    socketTimeoutMS=45000,  # 45 seconds socket timeout
    maxPoolSize=50,
    minPoolSize=10
)

db = client[DB_NAME]
candidate_collection = db['candidate_login']
questions_collection = db['Q_bank']
submissions_collection = db['submissions']
user_progress_collection = db['user_progress']
profile_collection = db['User_info']
    
# Initialize profile collection
# profile_collection = db['profiles']

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for FastAPI application"""
    # Startup: Test database connection
    try:
        await client.admin.command('ping')
        print("Successfully connected to MongoDB")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {e}")
        raise

    # Start cleanup task
    cleanup_task = asyncio.create_task(cleanup_unverified_users())
    
    yield  # Server is running
    
    # Cleanup
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    print("Shutting down application")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Algo Crafters API",
    description="Backend API for Algo Crafters platform",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limiting middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
IMAGES_DIR = UPLOAD_DIR / "images"
UPLOAD_DIR.mkdir(exist_ok=True)
IMAGES_DIR.mkdir(exist_ok=True)

# Configure CORS with updated settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Next.js frontend URL
        "https://localhost:3000",
        os.getenv("FRONTEND_URL", "http://localhost:3000"),  # Environment variable
        "https://*.ngrok.io",  # Allow ngrok URLs
        "https://*.ngrok-free.app"  # Allow new ngrok URLs
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Mount the uploads directory for images
app.mount("/api/v1/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")

# Mount the uploads directory
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Pydantic models for request validation
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

# Helper functions
def hash_password(password: str) -> bytes:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt)

def verify_password(plain_password: str, hashed_password: bytes) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

def serialize_question(question: dict) -> dict:
    """Serialize MongoDB question document to JSON-compatible format"""
    question['id'] = str(question['_id'])
    del question['_id']
    return question

# Add after the MongoDB connection setup
class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    async def __call__(self, authorization: str = Header(None)) -> bool:
        if not authorization:
            raise HTTPException(
                status_code=401,
                detail="Authorization header missing",
                headers={"WWW-Authenticate": "Bearer"}
            )
        try:
            payload = await verify_token(authorization)
            if payload.get("is_restricted", False):
                raise HTTPException(
                    status_code=403,
                    detail="Your account has been restricted"
                )
            # Only check admin requirement if "admin" is the only allowed role
            if "admin" in self.allowed_roles and "user" not in self.allowed_roles:
                if not payload.get("is_admin", False):
                    raise HTTPException(
                        status_code=403,
                        detail="Admin access required"
                    )
            return True
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"}
            )

# Create role checker instances
require_admin = RoleChecker(["admin"])  # Only admins
require_user = RoleChecker(["user", "admin"])  # Both users and admins

def generate_verification_token(email: str) -> str:
    """Generate a JWT token for email verification"""
    expiry = datetime.utcnow() + timedelta(hours=24)  # 24 hour expiry for verification
    return jwt.encode(
        {"email": email, "exp": expiry},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )

async def verify_token(authorization: str = Header(None)) -> dict:
    """Verify JWT token and return payload"""
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    try:
        # Extract token from Bearer scheme
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=401,
                detail="Invalid authentication scheme",
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (ValueError, JWTError) as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )

def generate_otp() -> str:
    """Generate a random 4-digit OTP"""
    return ''.join([str(random.randint(0, 9)) for _ in range(4)])

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Authentication dependencies
async def require_user(token: str = Depends(verify_token)) -> bool:
    """Dependency for endpoints that require any authenticated user"""
    return True

async def require_admin(token: str = Depends(verify_token)) -> bool:
    """Dependency for endpoints that require admin access"""
    if not token.get("is_admin"):
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return True

# Authentication endpoints
@app.post("/api/login")
@limiter.limit("5/minute")
async def login(credentials: UserLogin, request: Request):
    """Handle user login and return access token"""
    try:
        email = credentials.email
        password = credentials.password

        if not email or not password:
            raise HTTPException(status_code=400, detail="Email and password are required")

        # Find user
        user = await candidate_collection.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=400, detail="Invalid email or password")

        # Check if user is verified
        if not user.get("is_verified", False):
            raise HTTPException(
                status_code=400,
                detail="Please verify your email before logging in. Check your email for the verification link."
            )

        # Verify password
        if not verify_password(password, user["password"]):
            raise HTTPException(status_code=400, detail="Invalid email or password")

        # Generate access token
        access_token = create_access_token({
            "sub": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", ""),
            "is_admin": user.get("is_admin", False),
            "is_restricted": user.get("is_restricted", False)
        })

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user["_id"]),
                "email": user["email"],
                "name": user.get("name", ""),
                "is_admin": user.get("is_admin", False),
                "is_restricted": user.get("is_restricted", False),
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/signup")
@limiter.limit("3/minute")
async def signup(request: Request, user: UserSignup):
    """Handle user registration with OTP verification"""
    try:
        # Check if email already exists
        existing_user = await candidate_collection.find_one({"email": user.email})
        if existing_user:
            if existing_user.get("is_verified", False):
                raise HTTPException(status_code=400, detail="Email already registered")
            else:
                # Delete unverified user and allow re-registration
                await candidate_collection.delete_one({"_id": existing_user["_id"]})

        # Hash password
        hashed_password = hash_password(user.password)

        # Generate OTP
        otp = generate_otp()
        otp_expiry = datetime.utcnow() + timedelta(minutes=10)

        # Create user document
        user_doc = {
            "email": user.email,
            "password": hashed_password,
            "firstName": user.firstName,
            "lastName": user.lastName,
            "phone": user.phone,
            "company": user.company,
            "is_admin": user.is_admin,
            "is_restricted": user.is_restricted,
            "is_verified": False,
            "otp": otp,
            "otp_expiry": otp_expiry,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

        # Insert into database
        result = await candidate_collection.insert_one(user_doc)
        user_doc["_id"] = result.inserted_id

        # Send OTP email
        try:
            await email_service.send_otp_email(
                to_email=user.email,
                name=user.firstName or user.lastName,
                otp=otp
            )
        except Exception as e:
            print(f"Failed to send OTP email: {str(e)}")
            await candidate_collection.delete_one({"_id": result.inserted_id})
            raise HTTPException(
                status_code=500,
                detail="Failed to send verification OTP. Please try again."
            )

        return {
            "message": "Registration successful. Please check your email for the verification OTP.",
            "email": user.email
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/verify-email")
async def verify_email(request: dict):
    """Verify user's email using OTP"""
    try:
        email = request.get("email")
        otp = request.get("otp")

        if not email or not otp:
            raise HTTPException(status_code=400, detail="Email and OTP are required")

        # Find user and verify OTP
        user = await candidate_collection.find_one({
            "email": email,
            "otp": otp,
            "otp_expiry": {"$gt": datetime.utcnow()}
        })

        if not user:
            # If OTP is expired, delete the unverified user
            expired_user = await candidate_collection.find_one({
                "email": email,
                "otp": otp
            })
            if expired_user and not expired_user.get("is_verified", False):
                await candidate_collection.delete_one({"_id": expired_user["_id"]})
                raise HTTPException(
                    status_code=400,
                    detail="Verification OTP has expired. Please sign up again."
                )
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

        # Update user verification status and clear OTP
        await candidate_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "is_verified": True,
                    "otp": None,
                    "otp_expiry": None,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        return {"message": "Email verified successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Email verification error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/resend-otp")
@limiter.limit("3/minute")
async def resend_otp(request: dict):
    """Resend verification OTP"""
    try:
        email = request.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        # Find user
        user = await candidate_collection.find_one({"email": email})
        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        if user.get("is_verified", False):
            raise HTTPException(status_code=400, detail="Email is already verified")

        # Generate new OTP
        otp = generate_otp()
        otp_expiry = datetime.utcnow() + timedelta(minutes=10)

        # Update user with new OTP
        await candidate_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "otp": otp,
                    "otp_expiry": otp_expiry,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        # Send OTP email
        try:
            await email_service.send_otp_email(
                to_email=email,
                name=user.get("firstName") or user.get("lastName", ""),
                otp=otp
            )
        except Exception as e:
            print(f"Failed to send OTP email: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Failed to send verification OTP. Please try again."
            )

        return {"message": "Verification OTP sent successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Resend OTP error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Add a cleanup job to remove unverified users after 3 hours
async def cleanup_unverified_users():
    """Periodically remove unverified users after 3 hours"""
    while True:
        try:
            # Delete unverified users older than 3 hours
            cutoff_time = datetime.utcnow() - timedelta(hours=3)
            result = await candidate_collection.delete_many({
                "is_verified": False,
                "created_at": {"$lt": cutoff_time}
            })
            if result.deleted_count > 0:
                print(f"Cleaned up {result.deleted_count} unverified users")
        except Exception as e:
            print(f"Error in cleanup job: {str(e)}")
        
        # Run every hour
        await asyncio.sleep(3600)

@app.post("/api/verify-otp")
async def verify_otp(request: dict):
    try:
        email = request.get("email")
        otp = request.get("otp")

        if not email or not otp:
            raise HTTPException(status_code=400, detail="Email and OTP are required")

        # Find user and verify OTP
        user = await candidate_collection.find_one({
            "email": email,
            "otp": otp,
            "otp_expiry": {"$gt": datetime.now(timezone.utc)}
        })

        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

        # Update user verification status and clear OTP
        await candidate_collection.update_one(
            {"email": email},
            {
                "$set": {
                    "is_verified": True,
                    "otp": None,
                    "otp_expiry": None
                }
            }
        )

        return {"status": "success", "message": "Email verified successfully"}

    except Exception as e:
        print(f"Error in verify_otp: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/questions", dependencies=[Depends(require_admin)])
async def create_question(question: Question):
    try:
        question_dict = question.dict()
        question_dict['created_at'] = datetime.now(timezone.utc)
        
        # Ensure images field is properly formatted
        if 'images' in question_dict:
            question_dict['images'] = [
                {'url': img['url'], 'caption': img['caption']} 
                for img in question_dict['images']
            ]
        
        result = await questions_collection.insert_one(question_dict)
        
        if result.inserted_id:
            created_question = await questions_collection.find_one({'_id': result.inserted_id})
            return serialize_question(created_question)
        else:
            raise HTTPException(status_code=500, detail="Failed to create question")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/questions", dependencies=[Depends(require_user)])
async def get_questions(category: Optional[str] = None, difficulty: Optional[str] = None):
    try:
        # Log the request
        print(f"Fetching questions with filters - Category: {category}, Difficulty: {difficulty}")
        
        # Build query based on filters
        query = {}
        if category:
            query["category"] = category
        if difficulty:
            query["difficulty"] = difficulty

        # Fetch questions with error handling
        try:
            cursor = questions_collection.find(query)
            questions = await cursor.to_list(length=None)
            if not questions:
                print("No questions found matching the criteria")
                return []
            # Convert ObjectId to string for JSON serialization
            for question in questions:
                question["id"] = str(question["_id"])
                del question["_id"]
            print(f"Successfully fetched {len(questions)} questions")
            return questions
        except Exception as db_error:
            print(f"Database error while fetching questions: {db_error}")
            raise HTTPException(
                status_code=500,
                detail="Failed to fetch questions from database"
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in get_questions: {e}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while fetching questions"
        )

@app.get("/api/questions/filters", dependencies=[Depends(require_user)])
async def get_filters():
    try:
        # Get all unique categories from all documents
        categories = set()
        cursor = questions_collection.find({}, {"category": 1})
        async for doc in cursor:
            if isinstance(doc.get("category"), list):
                categories.update(doc["category"])
            else:
                categories.add(doc.get("category"))
        
        difficulties = await questions_collection.distinct('difficulty')
        return {
            "categories": list(categories),
            "difficulties": difficulties
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/questions/{question_id}", dependencies=[Depends(require_admin)])
async def update_question(question_id: str, question: Question):
    try:
        # Convert the question model to a dictionary
        question_dict = question.dict()
        
        # Add update timestamp
        question_dict['updated_at'] = datetime.now(timezone.utc)
        
        # Ensure all fields are properly formatted
        if 'images' in question_dict:
            question_dict['images'] = [
                {'url': img['url'], 'caption': img['caption']} 
                for img in question_dict['images']
            ]
        
        # Ensure examples have proper language fields
        if 'examples' in question_dict:
            for example in question_dict['examples']:
                example['inputLanguage'] = example.get('inputLanguage', 'plaintext')
                example['outputLanguage'] = example.get('outputLanguage', 'plaintext')
                # Ensure image fields exist
                if 'inputImage' not in example:
                    example['inputImage'] = None
                if 'outputImage' not in example:
                    example['outputImage'] = None

        # Ensure test cases have proper order and points
        if 'testCases' in question_dict:
            for i, test_case in enumerate(question_dict['testCases']):
                test_case['order'] = i + 1
                test_case['points'] = int(test_case.get('points', 0))

        # Ensure starterCodes is a list
        if 'starterCodes' not in question_dict:
            question_dict['starterCodes'] = []

        # Ensure allowedLanguages is a list
        if 'allowedLanguages' not in question_dict:
            question_dict['allowedLanguages'] = ['python']

        # Ensure Q_type exists
        if 'Q_type' not in question_dict:
            question_dict['Q_type'] = 'pandas'

        # Update the question in the database
        result = await questions_collection.update_one(
            {'_id': ObjectId(question_id)},
            {'$set': question_dict}
        )
        
        if result.modified_count:
            # Fetch and return the updated question
            updated_question = await questions_collection.find_one({'_id': ObjectId(question_id)})
            if updated_question:
                return serialize_question(updated_question)
            else:
                raise HTTPException(status_code=404, detail="Question not found after update")
        else:
            raise HTTPException(status_code=404, detail="Question not found")
    except Exception as e:
        print(f"Error updating question: {str(e)}")  # Add logging
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/questions/{question_id}", dependencies=[Depends(require_admin)])
async def delete_question(question_id: str):
    try:
        result = await questions_collection.delete_one({'_id': ObjectId(question_id)})
        if result.deleted_count:
            return {"message": "Question deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Question not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/users", dependencies=[Depends(require_admin)])
async def get_users():
    try:
        cursor = candidate_collection.find({}, {
            'password': 0  # Exclude password from results
        })
        users = await cursor.to_list(length=None)
        
        # Convert ObjectId to string for each user
        for user in users:
            user['id'] = str(user['_id'])
            del user['_id']
            
            # Ensure boolean fields exist
            user['is_admin'] = bool(user.get('is_admin', False))
            user['is_restricted'] = bool(user.get('is_restricted', False))
            
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/users/{user_id}/status", dependencies=[Depends(require_admin)])
async def update_user_status(user_id: str, status_update: dict):
    try:
        # Validate the update contains valid fields
        if not any(key in status_update for key in ['is_admin', 'is_restricted']):
            raise HTTPException(status_code=400, detail="Invalid update fields")

        update_fields = {}
        if 'is_admin' in status_update:
            update_fields['is_admin'] = bool(status_update['is_admin'])
        if 'is_restricted' in status_update:
            update_fields['is_restricted'] = bool(status_update['is_restricted'])

        result = await candidate_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_fields}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="User not found")

        # Return updated user
        updated_user = await candidate_collection.find_one(
            {'_id': ObjectId(user_id)},
            {'password': 0}  # Exclude password
        )
        
        if updated_user:
            updated_user['id'] = str(updated_user['_id'])
            del updated_user['_id']
            return updated_user
        else:
            raise HTTPException(status_code=404, detail="User not found")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/questions/{question_id}", dependencies=[Depends(require_user)])
async def get_question(question_id: str):
    try:
        question = await questions_collection.find_one({'_id': ObjectId(question_id)})
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        return serialize_question(question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute-code", dependencies=[Depends(require_user)])
async def execute_code(execution_request: CodeExecutionRequest, authorization: str = Header(None)):
    try:
        print(f"Executing code for question: {execution_request.question_id}")  # Debug log
        
        # Get user from token
        token_data = await verify_token(authorization)
        if not token_data:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
        
        # Get user from database
        user = await candidate_collection.find_one({"email": token_data["email"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_id = str(user["_id"])
        print(f"User ID: {user_id}")  # Debug log
        
        # Get question test cases
        question = await questions_collection.find_one({'_id': ObjectId(execution_request.question_id)})
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        # Verify language is allowed for this question
        if execution_request.language not in question.get('allowedLanguages', []):
            raise HTTPException(status_code=400, detail="Language not allowed for this question")

        # Get the docker runner type from the question
        docker_runner = question.get('docker_runner', 'only_python')

        # Prepare test cases
        test_cases = question.get('testCases', [])
        if not test_cases:
            raise HTTPException(status_code=400, detail="No test cases found for this question")

        # Prepare input data for the executor
        input_data = {
            'code': execution_request.code,
            'test_cases': test_cases,
            'working_driver': question.get('working_driver', '')  # Include working code solution
        }

        # Choose the appropriate docker executor based on docker_runner
        if docker_runner == "pandas":
            executor_dir = Path(__file__).parent / 'pandas-executor'
            docker_image = 'pandas-executor'
        elif docker_runner == "only_python":
            executor_dir = Path(__file__).parent / 'code-executor'
            docker_image = 'code-executor'
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported docker runner: {docker_runner}")

        if not executor_dir.exists():
            raise HTTPException(status_code=500, detail=f"{docker_runner} executor not found")

        try:
            # Build the Docker image if it doesn't exist
            build_process = subprocess.run(
                ['docker', 'build', '-t', docker_image, str(executor_dir)],
                capture_output=True,
                encoding='utf-8',
                errors='replace'
            )
            
            if build_process.returncode != 0:
                raise HTTPException(status_code=500, detail=f"Failed to build {docker_image} Docker image")

            # Convert input data to JSON string and encode to bytes
            input_json = json.dumps(input_data)
            input_bytes = input_json.encode('utf-8') + b'\n'

            # Run the code in Docker container with volume mount for debug log
            debug_log_dir = executor_dir / 'debug_logs'
            debug_log_dir.mkdir(exist_ok=True)
            debug_log_file = debug_log_dir / 'debug.log'
            
            # Clear previous debug log
            debug_log_file.write_text('')
            
            process = subprocess.Popen(
                ['docker', 'run', '--rm', '-i', '--network=none', '--memory=512m', '--cpus=1',
                 '-v', f'{str(debug_log_file)}:/tmp/debug.log',
                 docker_image],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=False
            )

            try:
                # Send input and get output with proper encoding
                stdout, stderr = process.communicate(input=input_bytes, timeout=25)
                
                # Check return code
                if process.returncode != 0:
                    error_message = stderr.decode('utf-8', errors='replace')
                    raise HTTPException(status_code=500, detail=f"Code execution failed: {error_message}")

                # Parse output with proper decoding
                output_str = stdout.decode('utf-8', errors='replace').strip()
                
                # Read debug log
                debug_output = debug_log_file.read_text() if debug_log_file.exists() else ""
                
                try:
                    results = json.loads(output_str)
                except json.JSONDecodeError:
                    raise HTTPException(status_code=500, detail="Failed to parse execution results")

                # Calculate score based on test cases passed
                total_test_cases = len(test_cases)
                test_cases_passed = sum(1 for result in results['results'] if result.get('passed', False))
                score = int((test_cases_passed / total_test_cases) * question.get('points', 0))

                # If this is a submission, record it
                if execution_request.is_submission:
                    print(f"Recording submission with score: {score}")  # Debug log
                    submission = Submission(
                        candidate_id=user_id,
                        question_id=execution_request.question_id,
                        code_solve=execution_request.code,
                        score=score,
                        status="success" if test_cases_passed > 0 else "failed",
                        test_cases_passed=test_cases_passed,
                        total_test_cases=total_test_cases
                    )
                    await submit_solution(submission)

                # Filter results based on submission type
                if not execution_request.is_submission:
                    visible_results = [
                        result for i, result in enumerate(results['results'])
                        if not test_cases[i].get('is_hidden', False)
                    ]
                else:
                    visible_results = results['results']

                # If the submission is successful and it's a final submission
                if execution_request.is_submission and test_cases_passed == total_test_cases:
                    # Calculate points earned
                    points_earned = question.get("points", 0)
                    # Update user's total score
                    new_score = user.get("total_score", 0) + points_earned
                    await candidate_collection.update_one(
                        {"_id": user["_id"]},
                        {"$set": {"total_score": new_score}}
                    )
                    # Send challenge completed email
                    try:
                        email_sent = await email_service.send_challenge_completed_email(
                            to_email=token_data["email"],
                            name=user.get("firstName") or user.get("lastName"),
                            challenge_title=question.get("title", "Unknown Challenge"),
                            points=points_earned,
                            total_score=new_score
                        )
                        if not email_sent:
                            print(f"Failed to send challenge completion email to {token_data['email']}")
                    except Exception as e:
                        print(f"Error sending challenge completion email: {str(e)}")

                return {
                    "status": "success",
                    "results": visible_results,
                    "score": score,
                    "test_cases_passed": test_cases_passed,
                    "total_test_cases": total_test_cases,
                    "is_submission": execution_request.is_submission,
                    "debug_output": debug_output
                }

            except subprocess.TimeoutExpired:
                process.kill()
                raise HTTPException(status_code=408, detail="Code execution timed out")

        except subprocess.CalledProcessError as e:
            error_message = e.stderr.decode('utf-8', errors='replace') if e.stderr else str(e)
            raise HTTPException(status_code=500, detail=f"Docker execution failed: {error_message}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in execute_code: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-image", dependencies=[Depends(require_admin)])
async def upload_image(file: UploadFile = File(...)):
    try:
        # Create a unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file.filename}"
        
        # Save to the images directory
        file_path = IMAGES_DIR / filename
        
        # Write the file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Return the relative URL path that can be used to access the image
        return {
            "url": f"/api/v1/images/{filename}",
            "filename": filename
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add these models after other models
class QuestionCollection(BaseModel):
    name: str
    description: str
    questions: List[str] = []

class QuestionCollectionResponse(BaseModel):
    id: str
    name: str
    description: str
    questions: List[Question]
    createdAt: str
    updatedAt: str

# Add these routes after other routes

@app.get("/api/question-collections", dependencies=[Depends(require_user)])
async def get_question_collections():
    collections = []
    cursor = db.Q_collections.find()
    async for collection in cursor:
        # Get all questions for this collection
        questions = []
        for question_id in collection.get('questions', []):
            question = await db.Q_bank.find_one({"_id": ObjectId(question_id)})
            if question:
                questions.append(Question(**question))

        collections.append({
            "id": str(collection["_id"]),
            "name": collection["name"],
            "description": collection["description"],
            "questions": questions,
            "createdAt": collection.get("createdAt", ""),
            "updatedAt": collection.get("updatedAt", "")
        })
    return collections

@app.post("/api/question-collections", dependencies=[Depends(require_admin)])
async def create_question_collection(collection: QuestionCollection):
    now = datetime.utcnow().isoformat()
    collection_dict = collection.dict()
    collection_dict["createdAt"] = now
    collection_dict["updatedAt"] = now
    
    result = await db.Q_collections.insert_one(collection_dict)
    return {"id": str(result.inserted_id), "status": "success"}

@app.put("/api/question-collections/{collection_id}", dependencies=[Depends(require_admin)])
async def update_question_collection(collection_id: str, collection: QuestionCollection):
    now = datetime.utcnow().isoformat()
    update_data = collection.dict()
    update_data["updatedAt"] = now
    
    result = await db.Q_collections.update_one(
        {"_id": ObjectId(collection_id)},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"status": "success"}

@app.delete("/api/question-collections/{collection_id}", dependencies=[Depends(require_admin)])
async def delete_question_collection(collection_id: str):
    result = await db.Q_collections.delete_one({"_id": ObjectId(collection_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"status": "success"}

@app.post("/api/question-collections/{collection_id}/questions", dependencies=[Depends(require_admin)])
async def add_question_to_collection(collection_id: str, question_data: dict):
    # Verify question exists
    question = await db.Q_bank.find_one({"_id": ObjectId(question_data["questionId"])})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    
    # Add question to collection
    result = await db.Q_collections.update_one(
        {"_id": ObjectId(collection_id)},
        {
            "$addToSet": {"questions": question_data["questionId"]},
            "$set": {"updatedAt": datetime.utcnow().isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"status": "success"}

@app.delete("/api/question-collections/{collection_id}/questions/{question_id}", dependencies=[Depends(require_admin)])
async def remove_question_from_collection(collection_id: str, question_id: str):
    result = await db.Q_collections.update_one(
        {"_id": ObjectId(collection_id)},
        {
            "$pull": {"questions": question_id},
            "$set": {"updatedAt": datetime.utcnow().isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Collection or question not found")
    return {"status": "success"}

@app.get("/api/user/progress/{candidate_id}", dependencies=[Depends(require_user)])
async def get_user_progress(candidate_id: str, authorization: str = Header(None)):
    try:
        # Verify token and get user data
        token_data = await verify_token(authorization)
        if not token_data:
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        # Only allow users to access their own progress or admins to access any progress
        if not token_data.get("is_admin") and str(token_data.get("sub")) != candidate_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Get user progress
        progress = await user_progress_collection.find_one({"user_id": ObjectId(candidate_id)})
        if not progress:
            # Create default progress object
            progress = {
                "_id": ObjectId(),
                "user_id": ObjectId(candidate_id),
                "question_ids": [],
                "total_score": 0,
                "last_submission": None
            }

        # Convert ObjectIds to strings for JSON serialization
        progress["_id"] = str(progress["_id"])
        progress["user_id"] = str(progress["user_id"])
        progress["question_ids"] = [str(q_id) for q_id in progress.get("question_ids", [])]

        # Get submission details for each question
        submissions_by_question = {}
        for question_id in progress["question_ids"]:
            cursor = submissions_collection.find({
                "candidate_id": ObjectId(candidate_id),
                "question_id": ObjectId(question_id),
                "status": "success"
            }).sort("score", -1).limit(1)
            
            best_submission = await cursor.to_list(length=1)
            if best_submission:
                submissions_by_question[question_id] = {
                    "score": best_submission[0].get("score", 0),
                    "submitted_at": best_submission[0].get("submitted_at")
                }

        progress["submissions"] = submissions_by_question
        return progress

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/submissions/{candidate_id}/{question_id}", dependencies=[Depends(require_user)])
async def get_submissions(candidate_id: str, question_id: str, authorization: str = Header(None)):
    try:
        # Verify token and get user data
        token_data = await verify_token(authorization)
        if not token_data:
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        # Only allow users to access their own submissions or admins to access any submissions
        if not token_data.get("is_admin") and str(token_data.get("sub")) != candidate_id:
            raise HTTPException(status_code=403, detail="Access denied")

        cursor = submissions_collection.find({
            "candidate_id": ObjectId(candidate_id),
            "question_id": ObjectId(question_id)
        }).sort("submitted_at", -1)
        
        submissions = await cursor.to_list(length=None)
        
        # Convert ObjectIds to strings for JSON serialization
        for submission in submissions:
            submission["_id"] = str(submission["_id"])
            submission["candidate_id"] = str(submission["candidate_id"])
            submission["question_id"] = str(submission["question_id"])
        
        return submissions

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/leaderboard", dependencies=[Depends(require_user)])
async def get_leaderboard(page: int = 1, limit: int = 10):
    try:
        # Calculate skip value for pagination
        skip = (page - 1) * limit
        
        # Get total count of users with progress
        total_users = await user_progress_collection.count_documents({})
        
        # Get top users by total score with pagination
        cursor = user_progress_collection.find(
            {},
            {"user_id": 1, "total_score": 1, "question_ids": 1}
        ).sort("total_score", -1).skip(skip).limit(limit)
        
        leaderboard = await cursor.to_list(length=None)

        # Get user details for each user in leaderboard
        result = []
        for entry in leaderboard:
            user = await candidate_collection.find_one(
                {"_id": entry["user_id"]},
                {"firstName": 1, "lastName": 1}
            )
            if user:
                result.append({
                    "user_id": str(entry["user_id"]),
                    "user_name": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
                    "total_score": entry.get("total_score", 0),
                    "questions_solved": len(entry.get("question_ids", [])),
                })

        return {
            "rankings": result,
            "total_users": total_users,
            "page": page,
            "total_pages": (total_users + limit - 1) // limit
        }

    except Exception as e:
        print(f"Error in get_leaderboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/module-progress/{user_id}/{module_id}", dependencies=[Depends(require_user)])
async def get_module_progress(user_id: str, module_id: str, authorization: str = Header(None)):
    try:
        # Verify token and get user data
        token_data = await verify_token(authorization)
        if not token_data:
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        # Only allow users to access their own progress or admins to access any progress
        if not token_data.get("is_admin") and str(token_data.get("sub")) != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Handle undefined user ID gracefully
        if user_id == "undefined":
            return {
                "score": 0,
                "completed": 0,
                "total": 0,
                "percentage": 0,
                "solved_questions": {},
                "question_scores": {}
            }
            
        # Get total questions for this module from Q_bank
        total_questions = await questions_collection.count_documents({"Q_type": module_id})
        if total_questions == 0:
            return {
                "score": 0,
                "completed": 0,
                "total": 0,
                "percentage": 0,
                "solved_questions": {},
                "question_scores": {}
            }

        # Get successful submissions for this user in this module
        pipeline = [
            {
                "$match": {
                    "candidate_id": ObjectId(user_id),
                    "status": "success"
                }
            },
            {
                "$lookup": {
                    "from": "Q_bank",
                    "localField": "question_id",
                    "foreignField": "_id",
                    "as": "question"
                }
            },
            {
                "$match": {
                    "question.Q_type": module_id
                }
            },
            {
                "$group": {
                    "_id": "$question_id",
                    "max_score": {"$max": "$score"},
                    "total_points": {"$first": "$question.points"}
                }
            }
        ]

        results = await submissions_collection.aggregate(pipeline).to_list(None)
        
        if not results:
            return {
                "score": 0,
                "completed": 0,
                "total": total_questions,
                "percentage": 0,
                "solved_questions": {},
                "question_scores": {}
            }

        # Calculate total score and prepare question scores
        total_score = 0
        question_scores = {}
        solved_questions = {}

        for result in results:
            question_id = str(result["_id"])
            max_score = result["max_score"]
            total_points = result["total_points"][0] if result["total_points"] else 0
            
            total_score += max_score
            question_scores[question_id] = {
                "score": max_score,
                "total": total_points
            }
            solved_questions[question_id] = max_score >= total_points

        completed = len([q for q in solved_questions.values() if q])
        percentage = (completed / total_questions) * 100 if total_questions > 0 else 0

        return {
            "score": total_score,
            "completed": completed,
            "total": total_questions,
            "percentage": percentage,
            "solved_questions": solved_questions,
            "question_scores": question_scores
        }

    except Exception as e:
        print(f"Error in get_module_progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user-performance/{user_id}", dependencies=[Depends(require_user)])
async def get_user_performance(user_id: str, authorization: str = Header(None)):
    try:
        # Verify token and get user data
        token_data = await verify_token(authorization)
        if not token_data:
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        # Make public profiles accessible to all authenticated users
        # Only check admin/self for private data
        user = await candidate_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get user progress
        progress = await user_progress_collection.find_one({"user_id": ObjectId(user_id)})
        if not progress:
            return {
                "user_name": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
                "total_score": 0,
                "questions": []
            }

        # Get all solved questions with their details
        questions = []
        for question_id in progress.get("question_ids", []):
            # Get question details
            question = await questions_collection.find_one({"_id": question_id})
            if not question:
                continue

            # Get best submission for this question
            cursor = submissions_collection.find({
                "candidate_id": ObjectId(user_id),
                "question_id": question_id,
                "status": "success"
            }).sort("score", -1).limit(1)
            
            best_submission = await cursor.to_list(length=1)
            if best_submission:
                questions.append({
                    "title": question.get("title", ""),
                    "tags": question.get("category", []),
                    "solved_at": best_submission[0].get("submitted_at"),
                    "points_earned": best_submission[0].get("score", 0),
                    "total_points": question.get("points", 0)
                })

        return {
            "user_name": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
            "total_score": progress.get("total_score", 0),
            "questions": questions
        }

    except Exception as e:
        print(f"Error in get_user_performance: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(request: PasswordResetRequest):
    """Handle forgot password request"""
    try:
        email = request.email
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        # Find user
        user = await candidate_collection.find_one({"email": email})
        if not user:
            # Don't reveal if user exists
            return {"message": "If an account exists with this email, you will receive a password reset link"}

        if not user.get("is_verified", False):
            raise HTTPException(status_code=400, detail="Please verify your email before resetting password")

        # Generate reset token
        reset_token = generate_verification_token(email)

        # Update user with reset token
        await candidate_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "reset_token": reset_token,
                    "reset_token_expiry": datetime.utcnow() + timedelta(hours=1),
                    "updated_at": datetime.utcnow()
                }
            }
        )

        # Send reset email
        try:
            await email_service.send_password_reset_email(
                email,
                reset_token,
                user.get("firstName") or user.get("lastName", "")
            )
        except Exception as e:
            print(f"Failed to send password reset email: {str(e)}")
            # Remove reset token if email fails
            await candidate_collection.update_one(
                {"_id": user["_id"]},
                {
                    "$unset": {
                        "reset_token": "",
                        "reset_token_expiry": ""
                    }
                }
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to send password reset email. Please try again."
            )

        return {"message": "If an account exists with this email, you will receive a password reset link"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Forgot password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/api/reset-password")
async def reset_password(request: PasswordReset):
    """Reset user's password using reset token"""
    try:
        token = request.token
        new_password = request.new_password

        if not token or not new_password:
            raise HTTPException(status_code=400, detail="Token and new password are required")

        try:
            # Verify token
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            email = payload.get("email")
            if not email:
                raise HTTPException(status_code=400, detail="Invalid reset token")
        except JWTError:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

        # Find user and verify token
        user = await candidate_collection.find_one({
            "email": email,
            "reset_token": token,
            "reset_token_expiry": {"$gt": datetime.utcnow()}
        })

        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

        # Hash new password
        hashed_password = hash_password(new_password)

        # Update password and clear reset token
        await candidate_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "password": hashed_password,
                    "updated_at": datetime.utcnow()
                },
                "$unset": {
                    "reset_token": "",
                    "reset_token_expiry": ""
                }
            }
        )

        return {"message": "Password reset successfully"}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Reset password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/api/health")
async def health_check():
    """Check the health status of the API and its dependencies"""
    try:
        # Check database connection
        await client.admin.command('ping')
        
        # Check collections
        collections = await db.list_collection_names()
        required_collections = [
            'candidate_login',
            'Q_bank',
            'submissions',
            'user_progress'
        ]
        
        missing_collections = [
            col for col in required_collections 
            if col not in collections
        ]
        
        # Check email service
        email_service_status = "healthy"
        try:
            await email_service.check_connection()
        except Exception as e:
            email_service_status = f"unhealthy: {str(e)}"

        if missing_collections:
            return {
                "status": "degraded",
                "database": "connected",
                "email_service": email_service_status,
                "missing_collections": missing_collections,
                "message": "Some required collections are missing"
            }
            
        return {
            "status": "healthy",
            "database": "connected",
            "email_service": email_service_status,
            "collections": "all present",
            "message": "System is healthy"
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "message": "System is unhealthy"
        }

async def submit_solution(submission: Submission) -> dict:
    """Record a solution submission and update user progress"""
    try:
        print(f"Received submission: {submission.dict()}")  # Debug log
        
        # Convert string IDs to ObjectIds
        submission_dict = submission.dict()
        submission_dict["_id"] = ObjectId()
        submission_dict["candidate_id"] = ObjectId(submission.candidate_id)
        submission_dict["question_id"] = ObjectId(submission.question_id)
        submission_dict["submitted_at"] = datetime.utcnow()
        
        print(f"Saving submission: {submission_dict}")  # Debug log
        
        # Save the submission
        insert_result = await submissions_collection.insert_one(submission_dict)
        print(f"Submission saved with ID: {insert_result.inserted_id}")  # Debug log

        if submission.status == "success":
            print("Processing successful submission")  # Debug log
            
            # Get all submissions for this question by this candidate
            cursor = submissions_collection.find({
                "candidate_id": ObjectId(submission.candidate_id),
                "question_id": ObjectId(submission.question_id),
                "status": "success"
            })
            submissions = await cursor.to_list(length=None)
            print(f"Found {len(submissions)} previous submissions")  # Debug log
            
            # Calculate max score for this question
            max_score = max([s.get("score", 0) for s in submissions])
            print(f"Max score for this question: {max_score}")  # Debug log
            
            # Update user progress
            user_progress = await user_progress_collection.find_one({
                "user_id": ObjectId(submission.candidate_id)  # Using candidate_id as user_id
            })
            
            if not user_progress:
                print("Creating new user progress")  # Debug log
                # Create new progress document
                user_progress = {
                    "user_id": ObjectId(submission.candidate_id),  # Using candidate_id as user_id
                    "question_ids": [],
                    "total_score": 0,
                    "last_submission": submission.submitted_at
                }
            
            # Add question to solved list if not already present
            question_id_str = str(submission.question_id)
            if question_id_str not in [str(q_id) for q_id in user_progress.get("question_ids", [])]:
                print(f"Adding new question {question_id_str} to solved list")  # Debug log
                user_progress["question_ids"].append(ObjectId(submission.question_id))
            
            # Calculate total score by getting the best score for each unique question
            pipeline = [
                {
                    "$match": {
                        "candidate_id": ObjectId(submission.candidate_id),
                        "status": "success"
                    }
                },
                {
                    "$group": {
                        "_id": "$question_id",
                        "max_score": {"$max": "$score"}
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "total_score": {"$sum": "$max_score"}
                    }
                }
            ]
            
            aggregation_result = await submissions_collection.aggregate(pipeline).to_list(length=1)
            total_score = aggregation_result[0]["total_score"] if aggregation_result else 0
            
            print(f"Total score calculated: {total_score}")  # Debug log
            
            # Update progress
            user_progress["total_score"] = total_score
            user_progress["last_submission"] = submission.submitted_at
            
            print(f"Updating user progress: {user_progress}")  # Debug log
            
            # Update or insert user progress
            update_result = await user_progress_collection.update_one(
                {"user_id": ObjectId(submission.candidate_id)},  # Using candidate_id as user_id
                {"$set": user_progress},
                upsert=True
            )
            print(f"User progress updated: {update_result.modified_count} documents modified")

            # Update user profile stats
            await update_user_profile_stats(str(submission.candidate_id))

        return {
            "status": "success",
            "message": "Submission recorded successfully",
            "submission_id": str(insert_result.inserted_id)
        }

    except Exception as e:
        print(f"Error in submit_solution: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/profiles/{user_id}", dependencies=[Depends(require_user)])
async def get_profile(user_id: str):
    profile = await profile_collection.find_one({"user_id": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if "_id" in profile:
        profile["_id"] = str(profile["_id"])
    return profile

@app.put("/api/private-profile", dependencies=[Depends(require_user)])
async def update_private_profile(
    profile_update: dict = Body(...),
    authorization: str = Header(None)
):
    """
    Update the user's profile and instantly aggregate stats from user_progress and submissions.
    """
    try:
        # Get user from token
        token_data = await verify_token(authorization)
        user_id = str(token_data["sub"])
        user = await candidate_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Get stats from user_progress
        progress = await user_progress_collection.find_one({"user_id": ObjectId(user_id)})
        total_score = progress.get("total_score", 0) if progress else 0
        question_ids = progress.get("question_ids", []) if progress else []
        total_questions_solved = len(question_ids)

        # Get contribution data from submissions (last 365 days)
        one_year_ago = datetime.utcnow() - timedelta(days=365)
        pipeline = [
            {"$match": {
                "candidate_id": ObjectId(user_id),
                "status": "success",
                "submitted_at": {"$gte": one_year_ago}
            }},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$submitted_at"}},
                "count": {"$sum": 1}
            }},
            {"$project": {
                "date": "$_id",
                "count": 1,
                "_id": 0
            }}
        ]
        contribution_data = await submissions_collection.aggregate(pipeline).to_list(length=None)

        # Prepare profile document
        profile_data = {
            "user_id": user_id,
            "username": profile_update.get("user_name") or f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
            "email": user.get("email"),
            **({"profile_picture": profile_update["profile_picture"]} if profile_update.get("profile_picture") else {}),
            "bio": profile_update.get("bio") or user.get("bio") or "Hey! I am learning Data Science & AI. I will be the Best AI expert in the world by practising AI on Algo Crafters.",
            "phone": user.get("phone"),
            "company": user.get("company"),
            "social_links": profile_update.get("social_links", {
                "github": "",
                "linkedin": "",
                "portfolio": "",
                "company": user.get("company", "")
            }),
            "visibility_settings": profile_update.get("visibility", {
                "github": True,
                "linkedin": True,
                "portfolio": True,
                "company": True,
                "email": False,
                "phone": False
            }),
            "achievements": profile_update.get("achievements") if profile_update.get("achievements") is not None else [],
            "badges": profile_update.get("badges") if profile_update.get("badges") is not None else [],
            "preferred_languages": profile_update.get("preferred_languages", []),
            "created_at": user.get("created_at", datetime.utcnow()),
            "updated_at": datetime.utcnow(),
            "total_score": total_score,
            "total_questions_solved": total_questions_solved,
            "contribution_data": contribution_data
        }

        # Update or insert profile
        await profile_collection.update_one(
            {"user_id": user_id},
            {"$set": profile_data},
            upsert=True
        )
        # Return updated profile
        updated_profile = await profile_collection.find_one({"user_id": user_id})
        if updated_profile and "_id" in updated_profile:
            updated_profile["_id"] = str(updated_profile["_id"])
        return updated_profile
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def update_user_profile_stats(user_id: str):
    """Update the User_info profile for the user with latest stats and contributions."""
    user = await candidate_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        return
    progress = await user_progress_collection.find_one({"user_id": ObjectId(user_id)})
    total_score = progress.get("total_score", 0) if progress else 0
    question_ids = progress.get("question_ids", []) if progress else []
    total_questions_solved = len(question_ids)
    one_year_ago = datetime.utcnow() - timedelta(days=365)
    pipeline = [
        {"$match": {
            "candidate_id": ObjectId(user_id),
            "status": "success",
            "submitted_at": {"$gte": one_year_ago}
        }},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$submitted_at"}},
            "count": {"$sum": 1}
        }},
        {"$project": {
            "date": "$_id",
            "count": 1,
            "_id": 0
        }}
    ]
    contribution_data = await submissions_collection.aggregate(pipeline).to_list(length=None)
    profile_data = {
        "user_id": user_id,
        "username": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
        "email": user.get("email"),
        **({"profile_picture": user["profile_picture"]} if user.get("profile_picture") else {}),
        "bio": user.get("bio") or "Hey! I am learning Data Science & AI. I will be the Best AI expert in the world by practising AI on Algo Crafters.",
        "phone": user.get("phone"),
        "company": user.get("company"),
        "social_links": {
            "github": "",
            "linkedin": "",
            "portfolio": "",
            "company": user.get("company", "")
        },
        "visibility_settings": {
            "github": True,
            "linkedin": True,
            "portfolio": True,
            "company": True,
            "email": False,
            "phone": False
        },
        "achievements": user.get("achievements") if user.get("achievements") is not None else [],
        "badges": user.get("badges") if user.get("badges") is not None else [],
        "preferred_languages": [],
        "created_at": user.get("created_at", datetime.utcnow()),
        "updated_at": datetime.utcnow(),
        "total_score": total_score,
        "total_questions_solved": total_questions_solved,
        "contribution_data": contribution_data
    }
    await profile_collection.update_one(
        {"user_id": user_id},
        {"$set": profile_data},
        upsert=True
    )

@app.get("/api/private-profile", dependencies=[Depends(require_user)])
async def get_private_profile(authorization: str = Header(None)):
    token_data = await verify_token(authorization)
    user_id = str(token_data["sub"])
    profile = await profile_collection.find_one({"user_id": user_id})
    if not profile:
        # Auto-create default profile if missing
        await update_user_profile_stats(user_id)
        profile = await profile_collection.find_one({"user_id": user_id})
    if profile and "_id" in profile:
        profile["_id"] = str(profile["_id"])
    return profile

# Uvicorn configuration
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable auto-reload on code changes
        workers=1,    # Number of worker processes
        log_level="info",
        access_log=True,
    ) 