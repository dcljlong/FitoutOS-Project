import os
from dotenv import load_dotenv
from pymongo import MongoClient
from pathlib import Path

load_dotenv(Path(".env"))

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

job_number = input("Job number: ").strip()
job = db.jobs.find_one({"job_number": job_number}, {"_id":0,"id":1,"job_number":1,"job_name":1})
if not job:
    print("JOB NOT FOUND")
    raise SystemExit(1)

codes = list(db.job_task_codes.find({"job_id": job["id"]}, {"_id":0,"code":1,"name":1,"custom_label":1}).sort("code", 1))

print("JOB:", job)
print("COUNT:", len(codes))
for c in codes:
    print(c)
