from pathlib import Path

path = Path("server.py")
text = path.read_text(encoding="utf-8")

anchor = """@api_router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
"""

helpers = """async def build_upstream_chain(task_id: str, visited=None):
    if visited is None:
        visited = set()

    if task_id in visited:
        return []

    visited.add(task_id)

    task = await db.tasks.find_one({"id": task_id}, {"_id": 0, "predecessor_ids": 1})
    if not task:
        return []

    predecessor_ids = task.get("predecessor_ids") or []
    if not predecessor_ids:
        return []

    pred_tasks = await db.tasks.find(
        {"id": {"$in": predecessor_ids}},
        {"_id": 0, "id": 1, "task_name": 1, "is_critical": 1, "predecessor_ids": 1}
    ).to_list(100)

    chain = []
    for p in pred_tasks:
        pred_id = p.get("id")
        chain.append(
            {
                "task_id": pred_id,
                "task_name": p.get("task_name"),
                "is_critical": p.get("is_critical", False)
            }
        )
        chain.extend(await build_upstream_chain(pred_id, visited))

    return chain


async def build_downstream_chain(task_id: str, visited=None):
    if visited is None:
        visited = set()

    if task_id in visited:
        return []

    visited.add(task_id)

    succ_tasks = await db.tasks.find(
        {"predecessor_ids": task_id},
        {"_id": 0, "id": 1, "task_name": 1, "is_critical": 1}
    ).to_list(100)

    if not succ_tasks:
        return []

    chain = []
    for s in succ_tasks:
        succ_id = s.get("id")
        chain.append(
            {
                "task_id": succ_id,
                "task_name": s.get("task_name"),
                "is_critical": s.get("is_critical", False)
            }
        )
        chain.extend(await build_downstream_chain(succ_id, visited))

    return chain


@api_router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
"""

if anchor not in text:
    raise Exception("Anchor not found - aborting safely")

text = text.replace(anchor, helpers, 1)

old_return_block = """    task["successors"] = successors

    return TaskResponse(**task)"""

new_return_block = """    task["successors"] = successors
    task["upstream_chain"] = await build_upstream_chain(task_id)
    task["downstream_chain"] = await build_downstream_chain(task_id)

    return TaskResponse(**task)"""

if old_return_block not in text:
    raise Exception("Return anchor not found - aborting safely")

text = text.replace(old_return_block, new_return_block, 1)

path.write_text(text, encoding="utf-8")
print("SUCCESS: recursive chain helpers added")
