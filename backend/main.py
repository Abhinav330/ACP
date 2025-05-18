from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Request, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Callable, Union
import bcrypt
from datetime import datetime, timezone, timedelta
import uvicorn
from helper import hash_password, verify_password,  generate_verification_token
from bson import ObjectId
import subprocess
import json
import os
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from models import (Submission, 
                    UserProgress, 
                    SUBMISSIONS_COLLECTION, 
                    USER_PROGRESS_COLLECTION, 
                    UserSignup,
                    UserLogin,
                    PasswordResetRequest,
                    PasswordReset,
                    Question,
                    CodeExecutionRequest,
                    get_last_successful_submission)
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
from fastapi import APIRouter
from azure.storage.blob import BlobServiceClient, ContentSettings
import requests
from database import get_db, lifespan

# Load environment variables from .env file
load_dotenv(dotenv_path="D:\Algo crafters\ACP\backend\.env")
profile_picture_dir = os.getenv("PROFILE_PICTURE_PATH")
question_images_dir = os.getenv("QUESTIONS_IMAGE_PATH")

AZURE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
AZURE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER","profile-picture")
QUESTION_IMAGE_CONTAINER = os.getenv("QUESTION_IMAGE_CONTAINER", "question-images")
AZURE_FUNCTION_PANDAS_EXECUTOR_URL = os.getenv("AZURE_FUNCTION_KEY_PANDAS")
AZURE_FUNCTION_ONLY_PYTHON_EXECUTOR_URL = os.getenv("AZURE_FUNCTION_KEY_ONLY_PYTHON")

# JWT configuration for NextAuth.js compatibility
JWT_SECRET = os.getenv("NEXTAUTH_SECRET")  # Use the same secret as NextAuth
if not JWT_SECRET:
    JWT_SECRET = secrets.token_hex(32)
    print(f"Warning: NEXTAUTH_SECRET not found in environment variables. Using generated secret: {JWT_SECRET}")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days to match NextAuth default

# Rate limiting configuration
limiter = Limiter(key_func=get_remote_address)

from database import (
    client,
    db,
    candidate_collection,
    questions_collection,
    submissions_collection,
    user_progress_collection,
    profile_collection,
    modules_collection
)

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

        # Create initial profile in User_info
        profile_data = {
            "user_id": str(user_doc["_id"]),
            "first_name": user_doc.get("firstName", ""),
            "last_name": user_doc.get("lastName", ""),
            "username": f"{user_doc.get('firstName', '')} {user_doc.get('lastName', '')}".strip(),
            "email": user_doc.get("email"),
            "profile_picture": user_doc.get("profile_picture", ""),
            "bio": user_doc.get("bio", "Hey! I am learning Data Science & AI. I will be the Best AI expert in the world by practising AI on Algo Crafters."),
            "phone": user_doc.get("phone"),
            "company": user_doc.get("company"),
            "social_links": {
                "github": "",
                "linkedin": "",
                "portfolio": "",
                "company": user_doc.get("company", "")
            },
            "visibility_settings": {
                "github": True,
                "linkedin": True,
                "portfolio": True,
                "company": True,
                "email": False,
                "phone": False
            },
            "achievements": [],
            "badges": [],
            "preferred_languages": [],
            "created_at": user_doc.get("created_at", datetime.utcnow()),
            "updated_at": datetime.utcnow(),
            "total_score": 0,
            "total_questions_solved": 0,
            "contribution_data": []
        }
        await profile_collection.insert_one(profile_data)

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
        # Backward compatibility
        if 'moduleId' not in question_dict and 'Q_type' in question_dict:
            question_dict['moduleId'] = None
        if 'Q_type' not in question_dict and 'moduleId' in question_dict:
            question_dict['Q_type'] = None
        # Ensure images field is properly formatted
        if 'images' in question_dict:
            question_dict['images'] = [
                {'url': img['url'], 'caption': img['caption']} 
                for img in question_dict['images']
            ]
            # Store only filenames in the database
            for img in question_dict['images']:
                if img['url'].startswith(QUESTION_IMAGE_BLOB_SAS_URL):
                    # Extract filename from the URL
                    filename = img['url'].split('/')[-1].split('?')[0]
                    img['url'] = filename
        result = await questions_collection.insert_one(question_dict)
        if result.inserted_id:
            created_question = await questions_collection.find_one({'_id': result.inserted_id})
            return serialize_question(created_question)
        else:
            raise HTTPException(status_code=500, detail="Failed to create question")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/questions", dependencies=[Depends(require_user)])
async def get_questions(
    moduleId: Optional[str] = None,
    Q_type: Optional[str] = None,
    category: Optional[str] = None,
    difficulty: Optional[str] = None
):
    query = {}
    if moduleId:
        query["moduleId"] = moduleId
    elif Q_type:
        query["Q_type"] = Q_type
    if category:
        query["category"] = category
    if difficulty:
        query["difficulty"] = difficulty

    cursor = questions_collection.find(query)
    questions = await cursor.to_list(length=None)
    for question in questions:
        question["id"] = str(question["_id"])
        del question["_id"]
        if "moduleId" not in question:
            question["moduleId"] = None
        if "Q_type" not in question:
            question["Q_type"] = None
    return questions

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
        question_dict = question.dict()
        question_dict['updated_at'] = datetime.now(timezone.utc)
        # Backward compatibility
        if 'moduleId' not in question_dict and 'Q_type' in question_dict:
            question_dict['moduleId'] = None
        if 'Q_type' not in question_dict and 'moduleId' in question_dict:
            question_dict['Q_type'] = None
        # Ensure all fields are properly formatted
        if 'images' in question_dict:
            question_dict['images'] = [
                {'url': img['url'], 'caption': img['caption']} 
                for img in question_dict['images']
            ]
            # Store only filenames in the database
            for img in question_dict['images']:
                if img['url'].startswith(QUESTION_IMAGE_BLOB_SAS_URL):
                    # Extract filename from the URL
                    filename = img['url'].split('/')[-1].split('?')[0]
                    img['url'] = filename
        if 'examples' in question_dict:
            for example in question_dict['examples']:
                example['inputLanguage'] = example.get('inputLanguage', 'plaintext')
                example['outputLanguage'] = example.get('outputLanguage', 'plaintext')
                if 'inputImage' not in example:
                    example['inputImage'] = None
                if 'outputImage' not in example:
                    example['outputImage'] = None
                # Store only filenames for example images
                if example.get('inputImage') and example['inputImage'].get('url'):
                    if example['inputImage']['url'].startswith(QUESTION_IMAGE_BLOB_SAS_URL):
                        filename = example['inputImage']['url'].split('/')[-1].split('?')[0]
                        example['inputImage']['url'] = filename
                if example.get('outputImage') and example['outputImage'].get('url'):
                    if example['outputImage']['url'].startswith(QUESTION_IMAGE_BLOB_SAS_URL):
                        filename = example['outputImage']['url'].split('/')[-1].split('?')[0]
                        example['outputImage']['url'] = filename
        if 'testCases' in question_dict:
            for i, test_case in enumerate(question_dict['testCases']):
                test_case['order'] = i + 1
                test_case['points'] = int(test_case.get('points', 0))
        if 'starterCodes' not in question_dict:
            question_dict['starterCodes'] = []
        if 'allowedLanguages' not in question_dict:
            question_dict['allowedLanguages'] = ['python']
        if 'Q_type' not in question_dict:
            question_dict['Q_type'] = 'pandas'
        result = await questions_collection.update_one(
            {'_id': ObjectId(question_id)},
            {'$set': question_dict}
        )
        if result.modified_count:
            updated_question = await questions_collection.find_one({'_id': ObjectId(question_id)})
            return serialize_question(updated_question)
        else:
            raise HTTPException(status_code=404, detail="Question not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def serialize_question(question):
    if not question:
        return None
    
    # Convert ObjectId to string
    question['_id'] = str(question['_id'])
    
    # Convert image filenames to full URLs
    if 'images' in question:
        question['images'] = [
            {
                'url': get_question_image_url(img['url']),
                'caption': img['caption']
            }
            for img in question['images']
        ]
    
    # Convert example image filenames to full URLs
    if 'examples' in question:
        for example in question['examples']:
            if example.get('inputImage') and example['inputImage'].get('url'):
                example['inputImage']['url'] = get_question_image_url(example['inputImage']['url'])
            if example.get('outputImage') and example['outputImage'].get('url'):
                example['outputImage']['url'] = get_question_image_url(example['outputImage']['url'])
    
    return question

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
def run_code_via_azure_function_only_python(input_data):
    # url = "http://localhost:7071/api/run_code_executor"  # Or your deployed Azure Function URL
    url = "https://pandasexecutor.azurewebsites.net/api/run_io_executor?code="+AZURE_FUNCTION_ONLY_PYTHON_EXECUTOR_URL
    # print("input_data:", requests.post(url, json=input_data))
    response = requests.post(url, json=input_data)
    
    response.raise_for_status()
    return response.json()
def run_code_via_azure_function_pandas(input_data):
    # url = "http://localhost:7071/api/run_code_executor"  # Or your deployed Azure Function URL
    url = "https://pandasexecutor.azurewebsites.net/api/run_code_executor?code="+AZURE_FUNCTION_PANDAS_EXECUTOR_URL
    # print("input_data:", requests.post(url, json=input_data))
    response = requests.post(url, json=input_data)
    
    response.raise_for_status()
    return response.json()

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

        try:
            # Call Azure Function instead of Docker
            if docker_runner == 'only_python':
                results= run_code_via_azure_function_only_python(input_data)
            else:
                results = run_code_via_azure_function_pandas(input_data)
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
            # (rest of your logic for points, emails, etc.)
                return {
                    "status": "success",
                    "results": visible_results,
                    "score": score,
                    "test_cases_passed": test_cases_passed,
                    "total_test_cases": total_test_cases,
                    "is_submission": execution_request.is_submission,
                "debug_output": results.get('debug_output', '')
            }
        except Exception as e:
            print(f"Error in execute_code: {str(e)}")
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

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
container_client = blob_service_client.get_container_client(AZURE_CONTAINER)
question_image_container_client = blob_service_client.get_container_client(QUESTION_IMAGE_CONTAINER)

BLOB_SAS_URL = os.getenv("BLOB_SAS_URL")
BLOB_SAS_TOKEN = os.getenv("BLOB_SAS_TOKEN")
QUESTION_IMAGE_BLOB_SAS_URL = os.getenv("QUESTION_IMAGE_BLOB_SAS_URL")
QUESTION_IMAGE_BLOB_SAS_TOKEN = os.getenv("QUESTION_IMAGE_BLOB_SAS_TOKEN")

def get_profile_picture_url(filename: str) -> str:
    new_file= ""

    # If it's already a full URL
    if filename.startswith("http") or filename.startswith("https"):
        if "?" in filename:
            return filename
        else:
            return f"{filename}?{BLOB_SAS_TOKEN}"
    else:
        new_file = f"{BLOB_SAS_URL}/{filename}?{BLOB_SAS_TOKEN}"

        return new_file

def get_question_image_url(filename: str) -> str:
    if not filename:
        return ""
        
    # If it's already a full URL
    if filename.startswith("http") or filename.startswith("https"):
        if "?" in filename:
            return filename
        else:
            return f"{filename}?{QUESTION_IMAGE_BLOB_SAS_TOKEN}"
    else:
        return f"{QUESTION_IMAGE_BLOB_SAS_URL}/{filename}?{QUESTION_IMAGE_BLOB_SAS_TOKEN}"

@app.post("/api/upload-profile-picture", dependencies=[Depends(require_user)])
async def upload_profile_picture(file: UploadFile = File(...), authorization: str = Header(None)):
    try:
        token_data = await verify_token(authorization)
        user_id = str(token_data["sub"])
        ext = os.path.splitext(file.filename)[1]
        filename = f"profile_{user_id}{ext}"
        blob_client = container_client.get_blob_client(filename)
        data = await file.read()
        content_type = file.content_type or "image/png"
        blob_client.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type)
        )
        # Store only the filename in the database
        await profile_collection.update_one({"user_id": user_id}, {"$set": {"profile_picture": filename}})
        url = get_profile_picture_url(filename)
        return {"url": url, "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/private-profile")
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
    # Patch: Add top-level linkedin_url and website_url from social_links
    social_links = profile.get("social_links", {})
    profile["linkedin_url"] = social_links.get("linkedin", "")
    profile["website_url"] = social_links.get("portfolio", "")
    # Always return a SAS URL for the profile picture
    if profile.get("profile_picture"):
        profile["profile_picture"] = get_profile_picture_url(profile["profile_picture"])
    else:
        profile["profile_picture"] = get_profile_picture_url("default-avatar.png")
    # Calculate top_percentage
    try:
        all_profiles = await profile_collection.find({}, {"total_score": 1, "user_id": 1}).to_list(length=None)
        scores = sorted([p.get("total_score", 0) for p in all_profiles], reverse=True)
        user_score = profile.get("total_score", 0)
        user_rank = scores.index(user_score) + 1 if user_score in scores else len(scores)
        total_users = len(scores)
        top_percentage = round((user_rank / total_users) * 100, 2) if total_users > 0 else 100.0
        profile["top_percentage"] = bucket_top_percentage(top_percentage)
    except Exception as e:
        profile["top_percentage"] = "Top 100%"
    # Always include module_percentiles
    profile["module_percentiles"] = profile.get("module_percentiles", {})
    return profile

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
            # Update per-module percentiles
            await update_user_module_percentiles(str(submission.candidate_id))

        return {
            "status": "success",
            "message": "Submission recorded successfully",
            "submission_id": str(insert_result.inserted_id)
        }

    except Exception as e:
        print(f"Error in submit_solution: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

# Helper function for bucketing top percentage
def bucket_top_percentage(top_percentage: float) -> str:
    if top_percentage <= 1:
        return 1
    elif top_percentage <= 5:
        return 5
    elif top_percentage <= 10:
        return 10
    elif top_percentage <= 20:
        return 20
    elif top_percentage <= 25:
        return 25
    elif top_percentage <= 30:
        return 30
    elif top_percentage <= 35:
        return 35
    elif top_percentage <= 40:
        return 40
    elif top_percentage <= 45:
        return 45
    elif top_percentage <= 50:
        return 50
    else:
        return top_percentage

@app.get("/api/profiles/{user_id}", dependencies=[Depends(require_user)])
async def get_profile(user_id: str):
    profile = await profile_collection.find_one({"user_id": user_id})
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if "_id" in profile:
        profile["_id"] = str(profile["_id"])
    # Patch: Add top-level linkedin_url and website_url from social_links
    social_links = profile.get("social_links", {})
    profile["linkedin_url"] = social_links.get("linkedin", "")
    profile["website_url"] = social_links.get("portfolio", "")
    # Calculate top_percentage (same as private profile)
    try:
        all_profiles = await profile_collection.find({}, {"total_score": 1, "user_id": 1}).to_list(length=None)
        scores = sorted([p.get("total_score", 0) for p in all_profiles], reverse=True)
        user_score = profile.get("total_score", 0)
        user_rank = scores.index(user_score) + 1 if user_score in scores else len(scores)
        total_users = len(scores)
        top_percentage = round((user_rank / total_users) * 100, 2) if total_users > 0 else 100.0
        profile["top_percentage"] = bucket_top_percentage(top_percentage)
    except Exception as e:
        profile["top_percentage"] = "Top 100%"
    # After fetching profile ...
    profile["module_percentiles"] = profile.get("module_percentiles", {})
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
        profile_picture_value = profile_update.get("profile_picture")
        if profile_picture_value:
            # If it's a URL, extract the filename only (no query, no slashes)
            if isinstance(profile_picture_value, str) and (profile_picture_value.startswith("http") or profile_picture_value.startswith("https")):
                profile_picture_value = profile_picture_value.split("/")[-1].split("?")[0]
        profile_data = {
            "user_id": user_id,
            "username": profile_update.get("user_name") or f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
            "email": user.get("email"),
            **({"profile_picture": profile_picture_value} if profile_picture_value else {}),
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
        # Patch: Add top-level linkedin_url and website_url from social_links
        social_links = updated_profile.get("social_links", {})
        updated_profile["linkedin_url"] = social_links.get("linkedin", "")
        updated_profile["website_url"] = social_links.get("portfolio", "")
        # Update per-module percentiles
        await update_user_module_percentiles(user_id)
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
    # Fetch current module_percentiles to preserve it
    current_profile = await profile_collection.find_one({"user_id": user_id})
    module_percentiles = current_profile.get("module_percentiles", {}) if current_profile else {}
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
        "contribution_data": contribution_data,
        "module_percentiles": module_percentiles
    }
    await profile_collection.update_one(
        {"user_id": user_id},
        {"$set": profile_data},
        upsert=True
    )
    # Update per-module percentiles
    await update_user_module_percentiles(user_id)

async def update_user_module_percentiles(user_id: str):
    modules = await modules_collection.find({}).to_list(length=None)
    module_names = [m['name'] for m in modules]
    module_percentiles = {}

    for module in module_names:
        # Get all users' scores for this module
        user_scores = []
        async for user in profile_collection.find({}):
            uid = user.get('user_id')
            # Aggregate user's score for this module
            pipeline = [
                {"$match": {"candidate_id": ObjectId(uid), "status": "success"}},
                {"$lookup": {
                    "from": "Q_bank",
                    "localField": "question_id",
                    "foreignField": "_id",
                    "as": "question"
                }},
                {"$unwind": "$question"},
                {"$match": {"question.Q_type": module}},
                {"$group": {"_id": None, "score": {"$sum": "$score"}}}
            ]
            agg = await submissions_collection.aggregate(pipeline).to_list(length=None)
            score = agg[0]['score'] if agg else 0
            user_scores.append((uid, score))

        # Now, for each user, calculate ranking percentile
        total_users = len(user_scores)
        user_score = 0
        for uid, score in user_scores:
            if uid == user_id:
                user_score = score
                break
        lower_count = sum(1 for _, s in user_scores if s < user_score)
        percentile = 100 - (lower_count / total_users) * 100 if total_users > 0 else 100.0
        # Always include all modules
        module_percentiles[module] = {
            'score': user_score,
            'percentile': round(percentile, 1) if user_score > 0 else 100.0
        }

    # Update user_info
    await profile_collection.update_one(
        {"user_id": user_id},
        {"$set": {"module_percentiles": module_percentiles}}
    )

@app.get("/api/admin/modules", dependencies=[Depends(require_admin)])
async def list_modules():
    modules = await modules_collection.find({}).to_list(length=None)
    for module in modules:
        module["id"] = str(module["_id"])
        del module["_id"]
    return modules

@app.post("/api/admin/modules", dependencies=[Depends(require_admin)])
async def create_module(module: dict = Body(...)):
    now = datetime.utcnow().isoformat()
    module["createdAt"] = now
    module["updatedAt"] = now
    result = await modules_collection.insert_one(module)
    module["id"] = str(result.inserted_id)
    return module

@app.put("/api/admin/modules/{module_id}", dependencies=[Depends(require_admin)])
async def update_module(module_id: str, module: dict = Body(...)):
    module["updatedAt"] = datetime.utcnow().isoformat()
    await modules_collection.update_one({"_id": ObjectId(module_id)}, {"$set": module})
    return {"id": module_id, "status": "updated"}

@app.delete("/api/admin/modules/{module_id}", dependencies=[Depends(require_admin)])
async def delete_module(module_id: str):
    await modules_collection.delete_one({"_id": ObjectId(module_id)})
    return {"id": module_id, "status": "deleted"}

@app.get("/api/admin/questions", dependencies=[Depends(require_admin)])
async def get_admin_questions():
    try:
        cursor = questions_collection.find({})
        questions = await cursor.to_list(length=None)
        for question in questions:
            question["id"] = str(question["_id"])
            del question["_id"]
            if "moduleId" not in question:
                question["moduleId"] = None
            if "Q_type" not in question or not question["Q_type"]:
                question["Q_type"] = "unknown"
        return questions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/questions/{question_id}", dependencies=[Depends(require_admin)])
async def get_admin_question(question_id: str):
    try:
        question = await questions_collection.find_one({'_id': ObjectId(question_id)})
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        return serialize_question(question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-question-image", dependencies=[Depends(require_admin)])
async def upload_question_image(file: UploadFile = File(...)):
    try:
        # Create a unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"question_{timestamp}_{file.filename}"
        
        # Upload to Azure Blob Storage
        blob_client = question_image_container_client.get_blob_client(filename)
        data = await file.read()
        content_type = file.content_type or "image/png"
        blob_client.upload_blob(
            data,
            overwrite=True,
            content_settings=ContentSettings(content_type=content_type)
        )
        
        # Return the filename and URL
        url = get_question_image_url(filename)
        return {"url": url, "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/question-image/{filename}")
async def get_question_image(filename: str):
    url = f"{QUESTION_IMAGE_BLOB_SAS_URL}/{filename}?{QUESTION_IMAGE_BLOB_SAS_TOKEN}"
    resp = requests.get(url)
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Image not found")
    # Guess content type from filename
    content_type = "image/png"
    if filename.lower().endswith(".jpg") or filename.lower().endswith(".jpeg"):
        content_type = "image/jpeg"
    elif filename.lower().endswith(".gif"):
        content_type = "image/gif"
    elif filename.lower().endswith(".webp"):
        content_type = "image/webp"
    return Response(content=resp.content, media_type=content_type)

@app.get("/api/success-history/{question_id}", dependencies=[Depends(require_user)])
async def get_last_successful_submission_api(question_id: str, authorization: str = Header(None)):
    """Get the last successful submission for a question by the authenticated user"""
    print("=== Starting last successful submission API ===")  # Debug log
    try:
        # First verify database connection
        try:
            await client.admin.command('ping')
        except Exception as e:
            print(f"Database connection error: {str(e)}")
            raise HTTPException(status_code=500, detail="Database connection error")

        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization header missing")

        # Verify token
        try:
            token_data = await verify_token(authorization)
            user_id = str(token_data["sub"])
        except Exception as e:
            print(f"Token verification error: {str(e)}")
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        # Use the shared model function to get the last successful submission
        submission = await get_last_successful_submission(user_id, question_id, db)
        if not submission:
            return {"message": "No successful submission found"}

        return submission  # FastAPI will serialize the Pydantic model

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in get_last_successful_submission_api: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal server error")

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