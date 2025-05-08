import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from datetime import datetime, timezone, timedelta
import jwt
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from tests.test_config import test_user, create_test_token, test_db

@pytest_asyncio.fixture
async def async_client():
    """Create an async test client."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest_asyncio.fixture
async def test_user_token(test_db):
    """Create a test user and return their token."""
    # Create test user
    user = await test_db.candidate_login.insert_one({
        **test_user,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "is_verified": True
    })
    user_id = str(user.inserted_id)
    
    # Create token
    token = create_test_token(user_id)
    return token

@pytest.mark.asyncio
async def test_signup(async_client, test_db):
    """Test user signup."""
    response = await async_client.post("/api/auth/signup", json={
        "email": "newuser@example.com",
        "password": "newpassword123",
        "firstName": "New",
        "lastName": "User"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "User created successfully"
    
    # Verify user was created in database
    user = await test_db.candidate_login.find_one({"email": "newuser@example.com"})
    assert user is not None
    assert user["is_verified"] is False

@pytest.mark.asyncio
async def test_login(async_client, test_db):
    """Test user login."""
    # First create a verified user
    await test_db.candidate_login.insert_one({
        **test_user,
        "is_verified": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    })
    
    # Test successful login
    response = await async_client.post("/api/auth/login", json={
        "email": test_user["email"],
        "password": test_user["password"]
    })
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    
    # Test failed login with wrong password
    response = await async_client.post("/api/auth/login", json={
        "email": test_user["email"],
        "password": "wrongpassword"
    })
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_email_verification(async_client, test_db):
    """Test email verification."""
    # Create unverified user
    user = await test_db.candidate_login.insert_one({
        **test_user,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    })
    user_id = str(user.inserted_id)
    
    # Create verification token
    token = create_test_token(user_id, timedelta(hours=3))
    
    # Test verification
    response = await async_client.get(f"/api/auth/verify-email?token={token}")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Email verified successfully"
    
    # Verify user is now verified
    updated_user = await test_db.candidate_login.find_one({"_id": user.inserted_id})
    assert updated_user["is_verified"] is True

@pytest.mark.asyncio
async def test_password_reset(async_client, test_db):
    """Test password reset flow."""
    # Create test user
    user = await test_db.candidate_login.insert_one({
        **test_user,
        "is_verified": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    })
    user_id = str(user.inserted_id)
    
    # Request password reset
    response = await async_client.post("/api/auth/forgot-password", json={
        "email": test_user["email"]
    })
    assert response.status_code == 200
    
    # Create reset token
    token = create_test_token(user_id, timedelta(hours=1))
    
    # Reset password
    response = await async_client.post("/api/auth/reset-password", json={
        "token": token,
        "newPassword": "newpassword123"
    })
    assert response.status_code == 200
    
    # Verify new password works
    response = await async_client.post("/api/auth/login", json={
        "email": test_user["email"],
        "password": "newpassword123"
    })
    assert response.status_code == 200 