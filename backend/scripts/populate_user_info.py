#!/usr/bin/env python3

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv
import logging
from bson.objectid import ObjectId

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB connection settings
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "alterhire")

DEFAULT_BIO = "Hey! I am learning Data Science & AI. I will be the Best AI expert in the world by practising AI on Algo Crafters."
DEFAULT_AVATAR = "/default-avatar.png"
DEFAULT_ACHIEVEMENTS = []
DEFAULT_BADGES = []

async def migrate_user_profiles():
    """
    Migrate user data from candidate_login to User_info collection.
    Creates or updates profile entries for users, including stats from user_progress and submissions.
    """
    try:
        # Initialize MongoDB client
        client = AsyncIOMotorClient(
            MONGODB_URI,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=45000
        )
        db = client[DB_NAME]
        
        # Get collections
        candidate_login = db['candidate_login']
        user_info = db['User_info']
        user_progress = db['user_progress']
        submissions = db['submissions']
        
        # Get all users from candidate_login
        users = await candidate_login.find({}).to_list(length=None)
        
        logger.info(f"Found {len(users)} users in candidate_login")
        
        # Counter for tracking progress
        created_count = 0
        updated_count = 0
        skipped_count = 0
        error_count = 0
        
        for user in users:
            try:
                user_id = str(user["_id"])
                # Check if user already has a profile
                existing_profile = await user_info.find_one({"user_id": user_id})
                
                # Get stats from user_progress
                progress = await user_progress.find_one({"user_id": ObjectId(user_id)})
                total_score = progress.get("total_score", 0) if progress else 0
                question_ids = progress.get("question_ids", []) if progress else []
                total_questions_solved = len(question_ids)
                
                # Get contribution data from submissions (last 365 days)
                one_year_ago = datetime.utcnow() - timedelta(days=365)
                pipeline = [
                    {
                        "$match": {
                            "candidate_id": ObjectId(user_id),
                            "status": "success",
                            "submitted_at": {"$gte": one_year_ago}
                        }
                    },
                    {
                        "$group": {
                            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$submitted_at"}},
                            "count": {"$sum": 1}
                        }
                    },
                    {
                        "$project": {
                            "date": "$_id",
                            "count": 1,
                            "_id": 0
                        }
                    }
                ]
                contribution_data = await submissions.aggregate(pipeline).to_list(length=None)
                
                # Prepare profile document
                profile_data = {
                    "user_id": user_id,
                    "first_name": user.get("firstName", ""),
                    "last_name": user.get("lastName", ""),
                    "username": f"{user.get('firstName', '')} {user.get('lastName', '')}".strip(),
                    "email": user.get("email"),
                    **({"profile_picture": user["profile_picture"]} if user.get("profile_picture") else {}),
                    "bio": user.get("bio") or DEFAULT_BIO,
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
                    "achievements": user.get("achievements") if user.get("achievements") is not None else DEFAULT_ACHIEVEMENTS,
                    "badges": user.get("badges") if user.get("badges") is not None else DEFAULT_BADGES,
                    "preferred_languages": [],
                    "created_at": user.get("created_at", datetime.utcnow()),
                    "updated_at": datetime.utcnow(),
                    "total_score": total_score,
                    "total_questions_solved": total_questions_solved,
                    "contribution_data": contribution_data
                }
                
                if existing_profile:
                    # Update existing profile
                    result = await user_info.update_one(
                        {"user_id": user_id},
                        {"$set": profile_data}
                    )
                    if result.modified_count > 0:
                        updated_count += 1
                        logger.info(f"Updated profile for user {user['email']}")
                    else:
                        skipped_count += 1
                        logger.debug(f"No changes for user {user['email']}")
                else:
                    # Insert new profile
                    result = await user_info.insert_one(profile_data)
                    if result.inserted_id:
                        created_count += 1
                        logger.info(f"Created profile for user {user['email']}")
                    else:
                        error_count += 1
                        logger.error(f"Failed to create profile for user {user['email']}")
                
            except Exception as e:
                error_count += 1
                logger.error(f"Error processing user {user.get('email', 'unknown')}: {str(e)}")
        
        # Log final statistics
        logger.info("Migration completed!")
        logger.info(f"Total users processed: {len(users)}")
        logger.info(f"New profiles created: {created_count}")
        logger.info(f"Existing profiles updated: {updated_count}")
        logger.info(f"Existing profiles skipped: {skipped_count}")
        logger.info(f"Errors encountered: {error_count}")
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        raise
    finally:
        # Close MongoDB connection
        client.close()
        logger.info("MongoDB connection closed")

def run_migration():
    """Run the migration script"""
    try:
        asyncio.run(migrate_user_profiles())
    except KeyboardInterrupt:
        logger.info("Migration interrupted by user")
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")

if __name__ == "__main__":
    run_migration() 