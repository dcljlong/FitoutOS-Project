from dotenv import load_dotenv
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
import os, asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]

JOB_ID = "27ea5733-726f-4d62-a464-22989ca44736"
DEFAULT_HOURS = 8

async def main():
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    result = await db.scope_items.update_many(
        {
            "job_id": JOB_ID,
            "$or": [
                {"quoted_hours": None},
                {"quoted_hours": {"$exists": False}},
                {"approved_hours": None},
                {"approved_hours": {"$exists": False}},
            ],
        },
        {
            "$set": {
                "quoted_hours": DEFAULT_HOURS,
                "approved_hours": DEFAULT_HOURS,
            }
        },
    )

    print(f"matched={result.matched_count} modified={result.modified_count}")
    client.close()

asyncio.run(main())
