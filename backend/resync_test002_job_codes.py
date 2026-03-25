import os
import uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient
from pathlib import Path

load_dotenv(Path(".env"))

job_number = "Job Number: TEST-002"

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

job = db.jobs.find_one({"job_number": job_number}, {"_id":0,"id":1,"job_number":1,"job_name":1})
if not job:
    print("JOB NOT FOUND")
    raise SystemExit(1)

master_codes = list(
    db.master_task_codes.find(
        {"is_global_fallback": False, "is_active": True},
        {"_id":0}
    ).sort("code", 1)
)

deleted = db.job_task_codes.delete_many({"job_id": job["id"]}).deleted_count

now = datetime.now(timezone.utc).isoformat()
docs = []
for m in master_codes:
    docs.append({
        "id": str(uuid.uuid4()),
        "job_id": job["id"],
        "master_code_id": m["id"],
        "code": m["code"],
        "name": m["name"],
        "custom_label": None,
        "is_active": True,
        "created_at": now
    })

if docs:
    db.job_task_codes.insert_many(docs)

print({
    "job_number": job["job_number"],
    "deleted_old_job_codes": deleted,
    "inserted_new_job_codes": len(docs)
})

for c in db.job_task_codes.find({"job_id": job["id"]}, {"_id":0,"code":1,"name":1}).sort("code", 1):
    print(c)
