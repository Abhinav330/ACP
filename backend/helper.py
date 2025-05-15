# Helper functions
import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import os
from dotenv import load_dotenv
load_dotenv()

JWT_SECRET = os.getenv("NEXTAUTH_SECRET")
JWT_ALGORITHM = "HS256"

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

def generate_verification_token(email: str) -> str:
    """Generate a JWT token for email verification"""
    expiry = datetime.now(timezone.utc) + timedelta(hours=24)  # 24 hour expiry for verification
    return jwt.encode(
        {"email": email, "exp": expiry},
        JWT_SECRET,
        algorithm=JWT_ALGORITHM
    )