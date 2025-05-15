from pymongo import MongoClient
from bson import ObjectId

client = MongoClient("mongodb://localhost:27017/")
db = client["alterhire"]

user_info = db["User_info"]
submissions = db["submissions"]
qbank = db["Q_bank"]
candidate_login = db["candidate_login"]

# 1. Get all module names (distinct Q_type)
module_names = qbank.distinct("Q_type")

# 2. Get all users
all_users = list(user_info.find({}))

for user in all_users:
    user_id = user["user_id"]
    module_percentiles = {}

    for module in module_names:
        # Get all questions in this module
        question_ids = [q["_id"] for q in qbank.find({"Q_type": module})]

        # Get all submissions for this user in this module
        user_subs = list(submissions.find({
            "candidate_id": ObjectId(user_id),
            "question_id": {"$in": question_ids},
            "status": "success"
        }))

        # For each question, get the best score
        best_scores = {}
        for sub in user_subs:
            qid = sub["question_id"]
            score = sub.get("score", 0)
            if qid not in best_scores or score > best_scores[qid]:
                best_scores[qid] = score

        user_score = sum(best_scores.values())

        # Get all users' scores for this module
        all_scores = []
        for other_user in all_users:
            other_id = other_user["user_id"]
            other_subs = list(submissions.find({
                "candidate_id": ObjectId(other_id),
                "question_id": {"$in": question_ids},
                "status": "success"
            }))
            other_best = {}
            for sub in other_subs:
                qid = sub["question_id"]
                score = sub.get("score", 0)
                if qid not in other_best or score > other_best[qid]:
                    other_best[qid] = score
            all_scores.append(sum(other_best.values()))

        # Calculate percentile
        num_lower = sum(1 for s in all_scores if s < user_score)
        total_users = len(all_scores)
        percentile = round(100 * num_lower / total_users, 2) if total_users > 0 else 100.0

        module_percentiles[module] = {"score": user_score, "percentile": percentile}

    # Update user_info
    user_info.update_one(
        {"user_id": user_id},
        {"$set": {"module_percentiles": module_percentiles}}
    )

print("Migration complete!") 