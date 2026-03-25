import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from passlib.context import CryptContext
from datetime import datetime, timezone
import uuid

ROOT = Path(r"D:\FitoutOS Project\app\backend")
load_dotenv(ROOT / ".env")

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

email = "admin@example.com"
password = "admin123"

hashed = pwd_context.hash(password)

existing = db.users.find_one({"email": email})

doc = {
    "id": existing["id"] if existing and existing.get("id") else str(uuid.uuid4()),
    "email": email,
    "name": "Admin",
    "role": "admin",
    "hashed_password": hashed,
    "created_at": existing.get("created_at") if existing and existing.get("created_at") else datetime.now(timezone.utc).isoformat(),
}

db.users.update_one({"email": email}, {"$set": doc}, upsert=True)

print({
    "email": email,
    "password": password,
    "status": "created_or_updated"
})
