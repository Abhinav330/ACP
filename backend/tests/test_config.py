import os
import pytest
import pytest_asyncio
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import asyncio
from bson import ObjectId
import jwt
import sys

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment variables
load_dotenv()

# Test database configuration
TEST_DB_NAME = "test_db"
TEST_MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")

# JWT configuration
JWT_SECRET = os.getenv("NEXTAUTH_SECRET", "test_secret")
JWT_ALGORITHM = "HS256"

# Test email configuration
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpassword123"
TEST_NAME = "Test User"

@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(scope="session")
async def test_db(event_loop):
    """Create a test database connection."""
    client = AsyncIOMotorClient(TEST_MONGODB_URL)
    db = client[TEST_DB_NAME]
    
    # Clean up any existing test data
    await db.candidate_login.delete_many({})
    await db.Q_bank.delete_many({})
    await db.submissions.delete_many({})
    
    yield db
    
    # Clean up after tests
    await db.candidate_login.delete_many({})
    await db.Q_bank.delete_many({})
    await db.submissions.delete_many({})
    client.close()

@pytest.fixture
def test_user():
    """Create a test user data."""
    return {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": TEST_NAME,
        "is_admin": False,
        "is_restricted": False,
        "is_verified": False,
        "verification_token": None,
        "verification_token_expiry": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

@pytest.fixture
def test_question():
    """Create a test question data."""
    return {
        "title": "Test Question",
        "summary": "A test question for unit testing",
        "description": "This is a test question description",
        "category": ["test"],
        "difficulty": "easy",
        "points": 10,
        "examples": [{"input": "test", "output": "test"}],
        "starterCodes": [{"language": "python", "code": "def test():\n    pass"}],
        "allowedLanguages": ["python"],
        "testCases": [{"input": "test", "expected_output": "test", "is_hidden": False, "order": 1, "points": 10}],
        "docker_runner": "only_python",
        "images": [],
        "Q_type": "test",
        "working_driver": "def test():\n    return 'test'",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }

def create_test_token(user_id: str, expires_delta: timedelta = None) -> str:
    """Create a test JWT token."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode = {"sub": user_id, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM) 