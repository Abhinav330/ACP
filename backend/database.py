from motor.motor_asyncio import AsyncIOMotorClient
import os
from fastapi import FastAPI
from contextlib import asynccontextmanager
import asyncio
from datetime import datetime, timedelta

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "alterhire")

# Initialize the client
client = AsyncIOMotorClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000,
    socketTimeoutMS=45000,
    maxPoolSize=50,
    minPoolSize=10
)

# Get database instance
db = client[DB_NAME]

# Collections
candidate_collection = db['candidate_login']
questions_collection = db['Q_bank']
submissions_collection = db['submissions']
user_progress_collection = db['user_progress']
profile_collection = db['User_info']
modules_collection = db['modules']

async def get_db():
    return db

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for FastAPI application"""
    # Startup: Test database connection
    try:
        await client.admin.command('ping')
        print("Successfully connected to MongoDB!")
    except Exception as e:
        print(f"Failed to connect to MongoDB: {str(e)}")
        raise e

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
    client.close()