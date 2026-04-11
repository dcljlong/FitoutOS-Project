from pathlib import Path

path = Path("server.py")
text = path.read_text(encoding="utf-8")

old_pred = """        predecessors = [
            {
                "task_id": p.get("id"),
                "task_name": p.get("task_name")
            }
            for p in pred_tasks
        ]"""

new_pred = """        predecessors = [
            {
                "task_id": p.get("id"),
                "task_name": p.get("task_name"),
                "is_critical": p.get("is_critical", False)
            }
            for p in pred_tasks
        ]"""

old_succ = """        successors = [
            {
                "task_id": s.get("id"),
                "task_name": s.get("task_name")
            }
            for s in succ_tasks
        ]"""

new_succ = """        successors = [
            {
                "task_id": s.get("id"),
                "task_name": s.get("task_name"),
                "is_critical": s.get("is_critical", False)
            }
            for s in succ_tasks
        ]"""

if old_pred not in text:
    raise Exception("Predecessor anchor not found")

if old_succ not in text:
    raise Exception("Successor anchor not found")

text = text.replace(old_pred, new_pred)
text = text.replace(old_succ, new_succ)

path.write_text(text, encoding="utf-8")
print("SUCCESS: linked task critical flags added")
