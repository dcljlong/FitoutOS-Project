from pathlib import Path

path = Path("server.py")
text = path.read_text(encoding="utf-8")

old = """    predecessor_ids: List[str]
    predecessors: List[Dict[str, Any]] = []
    owner_party: Optional[str] = None"""

new = """    predecessor_ids: List[str]
    predecessors: List[Dict[str, Any]] = []
    successors: List[Dict[str, Any]] = []
    owner_party: Optional[str] = None"""

if old not in text:
    raise Exception("Anchor not found - aborting safely")

text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("SUCCESS: TaskResponse successors field added")
