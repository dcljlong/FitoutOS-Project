import os
import asyncio
import server
from pprint import pprint

async def run():
    r = await server.register(
        server.UserCreate(
            name="DirectCheck3",
            email="directcheck3@test.com",
            password=os.environ.get("FITOUTOS_TEST_PASSWORD", ""),
            role="admin"
        )
    )
    pprint(r.model_dump())
    print("UserResponse fields =", list(server.UserResponse.model_fields.keys()))

asyncio.run(run())
