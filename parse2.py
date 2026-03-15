import json, sys
res = json.load(sys.stdin)
for issue in res.get("issues", []):
    line = issue.get("line")
    message = issue.get("message")
    file = issue.get("component")
    if file and "Tribe.tsx" in file:
        print(f"Line {line}: {message}")
