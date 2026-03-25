import os
from dotenv import load_dotenv
from pymongo import MongoClient
from pathlib import Path

load_dotenv(Path(".env"))

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

jobs = list(
    db.jobs.find({}, {"_id":0, "id":1, "job_number":1, "job_name":1, "created_at":1})
    .sort("created_at", -1)
    .limit(20)
)

print("COUNT:", len(jobs))
for j in jobs:
    print(j)
