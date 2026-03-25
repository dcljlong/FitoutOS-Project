import os
from dotenv import load_dotenv
from pymongo import MongoClient
from pathlib import Path

load_dotenv(Path(".env"))

job_number = "Job Number: TEST-002"

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

job = db.jobs.find_one({"job_number": job_number}, {"_id":0,"id":1,"job_number":1,"job_name":1})
print("JOB:", job)

if job:
    codes = list(db.job_task_codes.find({"job_id": job["id"]}, {"_id":0,"code":1,"name":1}).sort("code", 1))
    print("COUNT:", len(codes))
    for c in codes:
        print(c)
