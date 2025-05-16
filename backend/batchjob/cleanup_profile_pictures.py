import os
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(dotenv_path="D:/Algo crafters/ACP/backend/.env")

AZURE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
PROFILE_PICTURE_CONTAINER = os.getenv("AZURE_CONTAINER", "profile-picture")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "alterhire")

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
container_client = blob_service_client.get_container_client(PROFILE_PICTURE_CONTAINER)

mongo_client = MongoClient(MONGODB_URI)
db = mongo_client[DB_NAME]
profile_collection = db["User_info"]

# Get all referenced profile picture filenames from the database
referenced_files = set(
    p.get("profile_picture")
    for p in profile_collection.find({"profile_picture": {"$exists": True, "$ne": ""}})
    if p.get("profile_picture")
)

# List all blobs in the container
all_blobs = set(blob.name for blob in container_client.list_blobs())

# Find unused blobs, but never delete default-avatar.png
unused_blobs = {b for b in all_blobs - referenced_files if b != "default-avatar.png"}

for blob_name in unused_blobs:
    print(f"Deleting unused profile picture: {blob_name}")
    container_client.delete_blob(blob_name)

print(f"Deleted {len(unused_blobs)} unused profile pictures.") 