import os
from azure.storage.blob import BlobServiceClient
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(dotenv_path="D:/Algo crafters/ACP/backend/.env")

AZURE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
QUESTION_IMAGE_CONTAINER = os.getenv("QUESTION_IMAGE_CONTAINER", "question-images")
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "alterhire")

blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
container_client = blob_service_client.get_container_client(QUESTION_IMAGE_CONTAINER)

mongo_client = MongoClient(MONGODB_URI)
db = mongo_client[DB_NAME]
questions_collection = db["Q_bank"]

# Gather all referenced image filenames from questions
referenced_files = set()
for q in questions_collection.find():
    # Main images
    for img in q.get("images", []):
        if img.get("url"):
            referenced_files.add(img["url"])
    # Example images
    for ex in q.get("examples", []):
        if ex.get("inputImage") and ex["inputImage"].get("url"):
            referenced_files.add(ex["inputImage"]["url"])
        if ex.get("outputImage") and ex["outputImage"].get("url"):
            referenced_files.add(ex["outputImage"]["url"])

# List all blobs in the container
all_blobs = set(blob.name for blob in container_client.list_blobs())

# Find unused blobs
unused_blobs = all_blobs - referenced_files

for blob_name in unused_blobs:
    print(f"Deleting unused question image: {blob_name}")
    container_client.delete_blob(blob_name)

print(f"Deleted {len(unused_blobs)} unused question images.") 