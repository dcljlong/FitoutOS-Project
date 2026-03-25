import os
import uuid
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timezone

ROOT = Path(r"D:\FitoutOS Project\app\backend")
load_dotenv(ROOT / ".env")

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

codes = [
    {"code": "101", "name": "Suspended Ceilings / 2-way"},
    {"code": "102", "name": "Rondo Ceilings"},
    {"code": "103", "name": "Partition Walls"},
    {"code": "104", "name": "Aluminium"},
    {"code": "105", "name": "Plasterboard / Linings"},
    {"code": "106", "name": "Stopping"},
    {"code": "107", "name": "Insulation"},
    {"code": "108", "name": "Carpentry"},
    {"code": "109", "name": "Other"},
    {"code": "110", "name": "Carpet"},
    {"code": "111", "name": "FIRE RATING"},
    {"code": "115", "name": "Timber Partitions"},
    {"code": "ACCOM", "name": "Accomodation Allowance"},
    {"code": "Other", "name": "Other (please Specify)"},
    {"code": "P&G", "name": "Preliminary and General"},
    {"code": "P&Gs", "name": "P&G Supervision"},
    {"code": "P&Gt", "name": "P&G Travel"},
    {"code": "R/M", "name": "Repairs and Maintenace"},
    {"code": "Safety", "name": "Safety Equipment"},
    {"code": "Staff", "name": "Staff Purchases on Company account"},
    {"code": "Tools", "name": "Tools"},
    {"code": "training", "name": "Staff Training"},
]

now = datetime.now(timezone.utc).isoformat()

backup = list(db.master_task_codes.find({}))
print({"existing_master_count": len(backup)})

db.master_task_codes.delete_many({})

docs = []
for item in codes:
    docs.append({
        "id": str(uuid.uuid4()),
        "code": item["code"],
        "name": item["name"],
        "description": None,
        "category": None,
        "is_global_fallback": False,
        "is_active": True,
        "created_at": now,
    })

if docs:
    db.master_task_codes.insert_many(docs)

print({"inserted_master_count": len(docs)})
print(list(db.master_task_codes.find({}, {"_id": 0, "code": 1, "name": 1}).sort("code", 1)))
