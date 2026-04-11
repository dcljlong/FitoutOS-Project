from pathlib import Path

path = Path("server.py")
lines = path.read_text(encoding="utf-8").splitlines()

inside_taskresponse = False
inserted = False
new_lines = []

for line in lines:
    new_lines.append(line)

    if line.startswith("class TaskResponse(BaseModel):"):
        inside_taskresponse = True
        continue

    if inside_taskresponse and line.strip() == "predecessor_ids: List[str]":
        new_lines.append("    predecessors: List[Dict[str, Any]] = []")
        inserted = True
        inside_taskresponse = False

if not inserted:
    raise SystemExit("TaskResponse predecessor_ids line not found")

path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
print("TASKRESPONSE PREDECESSORS INSERTED")
