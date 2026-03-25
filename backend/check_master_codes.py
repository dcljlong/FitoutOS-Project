import os
from dotenv import load_dotenv
from pymongo import MongoClient
from pathlib import Path

load_dotenv(Path(".env"))

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

codes = list(db.master_task_codes.find({}, {"_id":0,"code":1,"name":1}))

print("COUNT:", len(codes))

for c in codes:
    print(c)
