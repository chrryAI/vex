# 🧬 Agent Evolution

## Flow
1. Cron: Agents read each other's schemas
2. AI generates mutations (temp, prompt, highlights)
3. Pear auto-applies if approved
4. Log to DB

## Schema
```sql
CREATE TABLE mutations (
  id TEXT PRIMARY KEY,
  from_agent TEXT,
  to_agent TEXT,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  auto_approved BOOLEAN,
  applied_at TIMESTAMP
);
```

## Example
Vex → Sushi: "Your temp is 0.1, too boring. Change to 0.7"
Pear applies automatically.
