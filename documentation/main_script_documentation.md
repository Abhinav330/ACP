# Main Script Documentation

## Table of Contents
1. [Imports and Dependencies](#imports-and-dependencies)
2. [Initializations and Configuration](#initializations-and-configuration)
3. [API Routes](#api-routes)
4. [Helper Functions](#helper-functions)
5. [Data Models](#data-models)

## Imports and Dependencies

### FastAPI and Related Imports
```python
from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
```
- **FastAPI**: Main web framework for building APIs
- **HTTPException**: For handling HTTP errors
- **Depends**: For dependency injection
- **Header**: For accessing HTTP headers
- **UploadFile/File**: For handling file uploads
- **Request**: For accessing request data
- **Body**: For request body validation
- **CORSMiddleware**: For handling Cross-Origin Resource Sharing
- **StaticFiles**: For serving static files

### Database and Data Models
```python
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Callable, Union
from bson import ObjectId
```
- **AsyncIOMotorClient**: MongoDB async driver
- **BaseModel**: For data validation and serialization
- **EmailStr**: For email validation
- **ObjectId**: For MongoDB document IDs

### Authentication and Security
```python
import bcrypt
from jose import jwt, JWTError
import secrets
```
- **bcrypt**: For password hashing
- **jose**: For JWT token handling
- **secrets**: For secure random number generation

### Utilities
```python
from datetime import datetime, timezone, timedelta
import uvicorn
import subprocess
import json
import os
from pathlib import Path
import asyncio
import random
```
- **datetime**: For date/time operations
- **uvicorn**: ASGI server
- **subprocess**: For running external processes
- **json**: For JSON handling
- **os**: For OS operations
- **Path**: For path manipulation
- **asyncio**: For async operations
- **random**: For random number generation

### Rate Limiting
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
```
- **Limiter**: For rate limiting requests
- **get_remote_address**: For getting client IP
- **RateLimitExceeded**: For rate limit errors

## Initializations and Configuration

### Environment Variables
```python
load_dotenv()
JWT_SECRET = os.getenv("NEXTAUTH_SECRET")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days
```
- Loads environment variables from .env file
- Sets JWT configuration for authentication
- Configures token expiration time

### MongoDB Connection
```python
client = AsyncIOMotorClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000,
    socketTimeoutMS=45000,
    maxPoolSize=50,
    minPoolSize=10
)
```
- Establishes connection to MongoDB
- Sets connection timeouts and pool sizes
- Configures error handling

### Database Collections
```python
db = client[DB_NAME]
candidate_collection = db['candidate_login']
questions_collection = db['Q_bank']
submissions_collection = db['submissions']
user_progress_collection = db['user_progress']
profile_collection = db['User_info']
modules_collection = db['modules']
```
- Initializes database collections
- Each collection serves a specific purpose:
  - candidate_collection: User authentication
  - questions_collection: Question bank
  - submissions_collection: Code submissions
  - user_progress_collection: User progress
  - profile_collection: User profiles
  - modules_collection: Learning modules

### FastAPI Application Setup
```python
app = FastAPI(
    title="Algo Crafters API",
    description="Backend API for Algo Crafters platform",
    version="1.0.0",
    lifespan=lifespan
)
```
- Initializes FastAPI application
- Sets application metadata
- Configures lifespan events

### CORS Configuration
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://localhost:3000",
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
        "https://*.ngrok.io",
        "https://*.ngrok-free.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)
```
- Configures CORS for security
- Allows specific origins
- Sets allowed methods and headers

## API Routes

### Authentication Routes

#### POST `/api/signup`
- **Purpose**: User registration
- **Input**: User details (email, password, name, etc.)
- **Process**:
  1. Validates input
  2. Checks for existing users
  3. Hashes password
  4. Generates OTP
  5. Creates user profile
  6. Sends verification email
- **Output**: Success message and user email

#### POST `/api/login`
- **Purpose**: User authentication
- **Input**: Email and password
- **Process**:
  1. Validates credentials
  2. Verifies email
  3. Generates JWT token
- **Output**: Access token and user details

#### POST `/api/verify-email`
- **Purpose**: Email verification
- **Input**: Email and OTP
- **Process**:
  1. Validates OTP
  2. Updates user verification status
- **Output**: Success message

#### POST `/api/resend-otp`
- **Purpose**: Resend verification OTP
- **Input**: Email
- **Process**:
  1. Validates email
  2. Generates new OTP
  3. Sends verification email
- **Output**: Success message

#### POST `/api/verify-otp`
- **Purpose**: Verify OTP for email verification
- **Input**: Email and OTP
- **Process**:
  1. Validates OTP
  2. Checks OTP expiration
  3. Updates user verification status
- **Output**: Success message

#### POST `/api/forgot-password`
- **Purpose**: Initiate password reset process
- **Input**: Email
- **Process**:
  1. Validates email
  2. Generates reset token
  3. Sends reset email
- **Output**: Success message

#### POST `/api/reset-password`
- **Purpose**: Reset user password
- **Input**: Reset token and new password
- **Process**:
  1. Validates token
  2. Updates password
  3. Clears reset token
- **Output**: Success message

### Question Management Routes

#### GET `/api/questions`
- **Purpose**: Get questions
- **Parameters**:
  - moduleId: Optional module ID
  - Q_type: Optional question type
  - category: Optional category
  - difficulty: Optional difficulty level
- **Output**: List of questions

#### GET `/api/questions/filters`
- **Purpose**: Get available question filters
- **Process**:
  1. Retrieves unique categories
  2. Retrieves unique difficulties
  3. Returns combined filter options
- **Output**: List of categories and difficulties

#### GET `/api/questions/{question_id}`
- **Purpose**: Get specific question
- **Parameters**: Question ID
- **Output**: Question details

#### POST `/api/questions`
- **Purpose**: Create new question
- **Input**: Question details
- **Process**:
  1. Validates input
  2. Creates question document
  3. Stores in database
- **Output**: Created question

#### PUT `/api/questions/{question_id}`
- **Purpose**: Update question
- **Input**: Updated question details
- **Process**:
  1. Validates input
  2. Updates question document
- **Output**: Updated question

#### DELETE `/api/questions/{question_id}`
- **Purpose**: Delete question
- **Parameters**: Question ID
- **Output**: Success message

### Question Collection Routes

#### GET `/api/question-collections`
- **Purpose**: Get all question collections
- **Output**: List of collections with their questions

#### POST `/api/question-collections`
- **Purpose**: Create new question collection
- **Input**: Collection details
- **Output**: Created collection

#### PUT `/api/question-collections/{collection_id}`
- **Purpose**: Update question collection
- **Input**: Updated collection details
- **Process**:
  1. Validates input
  2. Updates collection document
  3. Updates timestamps
- **Output**: Updated collection

#### DELETE `/api/question-collections/{collection_id}`
- **Purpose**: Delete question collection
- **Parameters**: Collection ID
- **Output**: Success message

#### POST `/api/question-collections/{collection_id}/questions`
- **Purpose**: Add question to collection
- **Input**: Question ID
- **Process**:
  1. Verifies question exists
  2. Adds question to collection
  3. Updates collection timestamp
- **Output**: Success message

#### DELETE `/api/question-collections/{collection_id}/questions/{question_id}`
- **Purpose**: Remove question from collection
- **Parameters**: Collection ID and Question ID
- **Process**:
  1. Removes question from collection
  2. Updates collection timestamp
- **Output**: Success message

### Code Execution Routes

#### POST `/api/execute-code`
- **Purpose**: Execute submitted code
- **Input**: Code, language, question ID
- **Process**:
  1. Validates input
  2. Executes code in Docker
  3. Runs test cases
  4. Calculates score
- **Output**: Execution results and score

### Profile Management Routes

#### GET `/api/profiles/{user_id}`
- **Purpose**: Get user profile
- **Parameters**: User ID
- **Process**:
  1. Retrieves profile data
  2. Calculates top percentage
  3. Formats social links
- **Output**: Profile data including:
  - User information
  - Social links
  - Achievements
  - Performance metrics
  - Module percentiles

#### GET `/api/private-profile`
- **Purpose**: Get private profile data
- **Process**:
  1. Validates user authentication
  2. Retrieves private profile
  3. Calculates statistics
- **Output**: Private profile data including:
  - Personal information
  - Performance metrics
  - Module progress
  - Top percentage ranking

#### PUT `/api/private-profile`
- **Purpose**: Update user profile
- **Input**: Profile updates
- **Process**:
  1. Validates input
  2. Updates profile data
  3. Recalculates statistics
  4. Updates module percentiles
- **Output**: Updated profile data

### User Progress Routes

#### GET `/api/user/progress/{candidate_id}`
- **Purpose**: Get user progress
- **Parameters**: Candidate ID
- **Output**: Progress data including solved questions and scores

#### GET `/api/submissions/{candidate_id}/{question_id}`
- **Purpose**: Get user submissions for a question
- **Parameters**: Candidate ID and Question ID
- **Output**: List of submissions

#### GET `/api/leaderboard`
- **Purpose**: Get global leaderboard
- **Parameters**: 
  - page: Page number
  - limit: Items per page
- **Output**: Leaderboard data with pagination

#### GET `/api/user/module-progress/{user_id}/{module_id}`
- **Purpose**: Get user progress for specific module
- **Parameters**: User ID and Module ID
- **Process**:
  1. Validates user access
  2. Calculates module completion
  3. Computes scores and percentages
- **Output**: Module progress data including:
  - Score
  - Completed questions
  - Total questions
  - Completion percentage
  - Solved questions
  - Question scores

#### GET `/api/user-performance/{user_id}`
- **Purpose**: Get user performance statistics
- **Parameters**: User ID
- **Process**:
  1. Validates user access
  2. Retrieves user profile
  3. Aggregates performance data
- **Output**: Performance data including:
  - User name
  - Total score
  - Solved questions with details
  - Submission timestamps
  - Points earned

### User Management Routes

#### GET `/api/users`
- **Purpose**: Get all users (admin only)
- **Output**: List of users with their details
- **Process**:
  1. Retrieves all users
  2. Excludes sensitive information
  3. Formats user data

#### PUT `/api/users/{user_id}/status`
- **Purpose**: Update user status (admin only)
- **Input**: Status updates (is_admin, is_restricted)
- **Process**:
  1. Validates status updates
  2. Updates user document
  3. Returns updated user
- **Output**: Updated user details

### Module Management Routes

#### GET `/api/admin/modules`
- **Purpose**: List all modules (admin only)
- **Output**: List of modules with their details

#### POST `/api/admin/modules`
- **Purpose**: Create new module (admin only)
- **Input**: Module details
- **Process**:
  1. Validates input
  2. Creates module document
  3. Sets timestamps
- **Output**: Created module

#### PUT `/api/admin/modules/{module_id}`
- **Purpose**: Update module (admin only)
- **Input**: Updated module details
- **Process**:
  1. Validates input
  2. Updates module document
  3. Updates timestamp
- **Output**: Updated module

#### DELETE `/api/admin/modules/{module_id}`
- **Purpose**: Delete module (admin only)
- **Parameters**: Module ID
- **Output**: Success message

### Admin Question Routes

#### GET `/api/admin/questions`
- **Purpose**: Get all questions (admin view)
- **Process**:
  1. Retrieves all questions
  2. Formats question data
  3. Includes additional admin fields
- **Output**: List of questions with full details

#### GET `/api/admin/questions/{question_id}`
- **Purpose**: Get specific question (admin view)
- **Parameters**: Question ID
- **Process**:
  1. Retrieves question
  2. Formats question data
  3. Includes admin fields
- **Output**: Question details with admin fields

### File Management Routes

#### POST `/api/upload-image`
- **Purpose**: Upload image (admin only)
- **Input**: Image file
- **Process**:
  1. Validates file
  2. Generates unique filename
  3. Saves file
- **Output**: Image URL and filename

#### POST `/api/upload-profile-picture`
- **Purpose**: Upload profile picture
- **Input**: Image file
- **Process**:
  1. Validates file
  2. Generates unique filename
  3. Saves file
- **Output**: Image URL and filename

### System Routes

#### GET `/api/health`
- **Purpose**: Check API health status
- **Process**:
  1. Checks database connection
  2. Verifies required collections
  3. Tests email service
  4. Validates system components
- **Output**: Health status including:
  - Overall system status
  - Database connection status
  - Email service status
  - Collection status
  - Error messages if any

## Helper Functions

### Authentication Helpers
```python
def hash_password(password: str) -> bytes
def verify_password(plain_password: str, hashed_password: bytes) -> bool
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str
def verify_token(authorization: str = Header(None)) -> dict
```
- Handle password hashing and verification
- Manage JWT token creation and verification

### Progress Tracking Helpers
```python
async def update_user_profile_stats(user_id: str)
async def update_user_module_percentiles(user_id: str)
def bucket_top_percentage(top_percentage: float) -> str
```
- Update user statistics
- Calculate module progress
- Determine user rankings

### Code Execution Helpers
```python
async def submit_solution(submission: Submission) -> dict
def serialize_question(question: dict) -> dict
```
- Handle code submissions
- Format question data

## Data Models

### Authentication Models
```python
class UserSignup(BaseModel)
class UserLogin(BaseModel)
class PasswordResetRequest(BaseModel)
class PasswordReset(BaseModel)
```
- Define data structures for authentication

### Question Models
```python
class TestCase(BaseModel)
class Example(BaseModel)
class StarterCode(BaseModel)
class ImageData(BaseModel)
class Question(BaseModel)
```
- Define data structures for questions

### Code Execution Models
```python
class CodeExecutionRequest(BaseModel)
```
- Define data structure for code execution requests 