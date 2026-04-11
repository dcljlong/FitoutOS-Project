from dotenv import load_dotenv
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
import os, asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]

JOB_ID = "27ea5733-726f-4d62-a464-22989ca44736"

async def main():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    scope_rows = await db.scope_items.find({"job_id": JOB_ID}, {"_id": 0}).to_list(1000)
    task_rows = await db.tasks.find({"job_id": JOB_ID, "is_internal": True}, {"_id": 0}).to_list(1000)

    total_hours = sum(float(s.get("approved_hours") or 0) for s in scope_rows)
    per_task = round(total_hours / len(task_rows), 2) if task_rows else 0

    modified = 0
    for task in task_rows:
        result = await db.tasks.update_one(
            {"id": task["id"], "job_id": JOB_ID},
            {"$set": {"quoted_hours": per_task}}
        )
        modified += result.modified_count

    print(f"tasks={len(task_rows)} total_hours={total_hours} per_task={per_task} modified={modified}")
    client.close()

asyncio.run(main())
