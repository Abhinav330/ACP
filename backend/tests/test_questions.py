import pytest
from datetime import datetime, timezone
from bson import ObjectId
from main import app
from fastapi.testclient import TestClient
from test_config import test_user, test_db, test_question
import jwt
import os
from fastapi import Request

# Create test client
client = TestClient(app)

# JWT configuration
JWT_SECRET = os.getenv("NEXTAUTH_SECRET", "test_secret")
JWT_ALGORITHM = "HS256"

def get_auth_token(user_id: str) -> str:
    """Get authentication token for testing."""
    return jwt.encode({"sub": user_id}, JWT_SECRET, algorithm=JWT_ALGORITHM)

@pytest.mark.asyncio
async def test_create_question(test_db, test_question):
    """Test question creation functionality."""
    # Create an admin user
    admin_user = {
        "email": "admin@example.com",
        "password": "adminpassword123",
        "name": "Admin User",
        "is_admin": True,
        "is_verified": True
    }
    await test_db.candidate_login.insert_one(admin_user)
    admin_token = get_auth_token(str(admin_user["_id"]))
    
    # Test successful question creation
    response = client.post(
        "/api/questions",
        json=test_question,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == test_question["title"]
    assert data["difficulty"] == test_question["difficulty"]
    
    # Test question creation without admin privileges
    regular_user = {
        "email": "user@example.com",
        "password": "userpassword123",
        "name": "Regular User",
        "is_admin": False,
        "is_verified": True
    }
    await test_db.candidate_login.insert_one(regular_user)
    user_token = get_auth_token(str(regular_user["_id"]))
    
    response = client.post(
        "/api/questions",
        json=test_question,
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 403

@pytest.mark.asyncio
async def test_get_questions(test_db, test_question):
    """Test question retrieval functionality."""
    # Insert a test question
    await test_db.Q_bank.insert_one(test_question)
    
    # Create a regular user
    regular_user = {
        "email": "user@example.com",
        "password": "userpassword123",
        "name": "Regular User",
        "is_admin": False,
        "is_verified": True
    }
    await test_db.candidate_login.insert_one(regular_user)
    user_token = get_auth_token(str(regular_user["_id"]))
    
    # Test getting all questions
    response = client.get(
        "/api/questions",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["title"] == test_question["title"]
    
    # Test getting questions with filters
    response = client.get(
        "/api/questions?category=test&difficulty=easy",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["category"] == ["test"]
    assert data[0]["difficulty"] == "easy"

@pytest.mark.asyncio
async def test_submit_solution(test_db, test_question, test_user):
    """Test solution submission functionality."""
    # Insert test question
    question_result = await test_db.Q_bank.insert_one(test_question)
    question_id = str(question_result.inserted_id)
    
    # Create a verified user
    user = {
        "email": test_user["email"],
        "password": test_user["password"],
        "name": test_user["name"],
        "is_admin": False,
        "is_verified": True
    }
    user_result = await test_db.candidate_login.insert_one(user)
    user_id = str(user_result.inserted_id)
    user_token = get_auth_token(user_id)
    
    # Test successful submission
    submission = {
        "code": "def test():\n    return 'test'",
        "language": "python",
        "question_id": question_id,
        "is_submission": True
    }
    
    response = client.post(
        "/api/execute-code",
        json=submission,
        headers={
            "Authorization": f"Bearer {user_token}",
            "email": test_user["email"]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["test_cases_passed"] > 0
    
    # Verify submission was recorded
    submission_record = await test_db.submissions.find_one({
        "candidate_id": ObjectId(user_id),
        "question_id": ObjectId(question_id)
    })
    assert submission_record is not None
    assert submission_record["status"] == "success"
    
    # Test submission with invalid code
    invalid_submission = {
        "code": "def test():\n    return 'wrong'",
        "language": "python",
        "question_id": question_id,
        "is_submission": True
    }
    
    response = client.post(
        "/api/execute-code",
        json=invalid_submission,
        headers={
            "Authorization": f"Bearer {user_token}",
            "email": test_user["email"]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["test_cases_passed"] == 0

@pytest.mark.asyncio
async def test_user_progress(test_db, test_question, test_user):
    """Test user progress tracking."""
    # Insert test question
    question_result = await test_db.Q_bank.insert_one(test_question)
    question_id = str(question_result.inserted_id)
    
    # Create a verified user
    user = {
        "email": test_user["email"],
        "password": test_user["password"],
        "name": test_user["name"],
        "is_admin": False,
        "is_verified": True
    }
    user_result = await test_db.candidate_login.insert_one(user)
    user_id = str(user_result.inserted_id)
    user_token = get_auth_token(user_id)
    
    # Submit a successful solution
    submission = {
        "code": "def test():\n    return 'test'",
        "language": "python",
        "question_id": question_id,
        "is_submission": True
    }
    
    await client.post(
        "/api/execute-code",
        json=submission,
        headers={
            "Authorization": f"Bearer {user_token}",
            "email": test_user["email"]
        }
    )
    
    # Test getting user progress
    response = client.get(
        f"/api/user/progress/{user_id}",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total_score"] > 0
    assert question_id in data["question_ids"]
    
    # Test getting module progress
    response = client.get(
        f"/api/user/module-progress/{user_id}/test",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["score"] > 0
    assert data["completed"] > 0
    assert data["percentage"] > 0 