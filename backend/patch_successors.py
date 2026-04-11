from pathlib import Path

path = Path("server.py")
text = path.read_text()

old = """    task["predecessors"] = predecessors
    return TaskResponse(**task)"""

new = """    task["predecessors"] = predecessors

    # SUCCESSORS ENRICHMENT
    successors = []
    succ_tasks = await db.tasks.find(
        {"predecessor_ids": task_id},
        {"_id": 0, "id": 1, "task_name": 1}
    ).to_list(100)

    if succ_tasks:
        successors = [
            {
                "task_id": s.get("id"),
                "task_name": s.get("task_name")
            }
            for s in succ_tasks
        ]

    task["successors"] = successors

    return TaskResponse(**task)"""

if old not in text:
    raise Exception("Anchor not found - aborting safely")

text = text.replace(old, new)

path.write_text(text)
print("SUCCESS: successors patch applied")
