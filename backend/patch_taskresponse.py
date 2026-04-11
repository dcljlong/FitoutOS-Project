from pathlib import Path
import re

path = Path("server.py")
text = path.read_text(encoding="utf-8")

pattern = r'''class TaskResponse\(BaseModel\):\n(?P<body>(?:    .*\n)+?)\nclass '''
m = re.search(pattern, text)
if not m:
    raise SystemExit("TaskResponse block not found")

body = m.group("body")

if 'predecessors:' not in body:
    body = body.replace(
        '    predecessor_ids: List[str]\n',
        '    predecessor_ids: List[str]\n    predecessors: List[Dict[str, Any]] = []\n'
    )

new_block = 'class TaskResponse(BaseModel):\n' + body + '\nclass '
text = text[:m.start()] + new_block + text[m.end():]

path.write_text(text, encoding="utf-8")
print("PATCHED_TASKRESPONSE")
