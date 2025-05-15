from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from bson import ObjectId
from datetime import datetime

from app.core.database import question_collection, collection_collection
from app.core.security import require_user, require_admin
from app.schemas.collection import CollectionCreate, CollectionUpdate, CollectionOut

router = APIRouter(prefix="/api/collections", tags=["Collections"])

@router.post("/", dependencies=[Depends(require_admin)])
async def create_collection(collection: CollectionCreate):
    collection_dict = collection.dict()
    collection_dict["created_at"] = datetime.utcnow()
    collection_dict["updated_at"] = datetime.utcnow()

    result = await collection_collection.insert_one(collection_dict)
    collection_dict["_id"] = result.inserted_id
    return collection_dict

@router.get("/", response_model=List[CollectionOut])
async def get_collections(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    user=Depends(require_user)
):
    collections = await collection_collection.find().skip(skip).limit(limit).to_list(length=limit)
    return collections

@router.get("/{collection_id}", response_model=CollectionOut)
async def get_collection(collection_id: str, user=Depends(require_user)):
    collection = await collection_collection.find_one({"_id": ObjectId(collection_id)})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    return collection

@router.put("/{collection_id}", dependencies=[Depends(require_admin)])
async def update_collection(collection_id: str, collection: CollectionUpdate):
    existing_collection = await collection_collection.find_one({"_id": ObjectId(collection_id)})
    if not existing_collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    update_data = collection.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    await collection_collection.update_one(
        {"_id": ObjectId(collection_id)},
        {"$set": update_data}
    )

    updated_collection = await collection_collection.find_one({"_id": ObjectId(collection_id)})
    return updated_collection

@router.delete("/{collection_id}", dependencies=[Depends(require_admin)])
async def delete_collection(collection_id: str):
    result = await collection_collection.delete_one({"_id": ObjectId(collection_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Collection not found")
    return {"message": "Collection deleted successfully"}

@router.post("/{collection_id}/questions/{question_id}", dependencies=[Depends(require_admin)])
async def add_question_to_collection(collection_id: str, question_id: str):
    collection = await collection_collection.find_one({"_id": ObjectId(collection_id)})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    question = await question_collection.find_one({"_id": ObjectId(question_id)})
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    await collection_collection.update_one(
        {"_id": ObjectId(collection_id)},
        {"$addToSet": {"question_ids": question_id}}
    )
    return {"message": "Question added to collection"}

@router.delete("/{collection_id}/questions/{question_id}", dependencies=[Depends(require_admin)])
async def remove_question_from_collection(collection_id: str, question_id: str):
    collection = await collection_collection.find_one({"_id": ObjectId(collection_id)})
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    await collection_collection.update_one(
        {"_id": ObjectId(collection_id)},
        {"$pull": {"question_ids": question_id}}
    )
    return {"message": "Question removed from collection"}
