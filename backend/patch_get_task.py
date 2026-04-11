from pathlib import Path

path = Path("server.py")
text = path.read_text(encoding="utf-8")

old = '''@api_router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskResponse(**task)
'''

new = '''@api_router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, user: dict = Depends(get_current_user)):
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    predecessor_ids = task.get("predecessor_ids") or []
    predecessors = []

    if predecessor_ids:
        pred_tasks = await db.tasks.find(
            {"id": {"$in": predecessor_ids}},
            {"_id": 0, "id": 1, "task_name": 1}
        ).to_list(100)

        predecessors = [
            {
                "task_id": p.get("id"),
                "task_name": p.get("task_name")
            }
            for p in pred_tasks
        ]

    task["predecessors"] = predecessors
    return TaskResponse(**task)
'''

if old not in text:
    raise SystemExit("OLD BLOCK NOT FOUND")

path.write_text(text.replace(old, new), encoding="utf-8")
print("PATCHED")
