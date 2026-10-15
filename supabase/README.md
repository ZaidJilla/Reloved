# Supabase SQL

Each file here is one saved query in the Supabase SQL Editor, named the same.

| File | When to run |
|---|---|
| `schema.sql` | Once, on a brand new project. Already applied to ours, never re-run. |
| `migrations/NNN_name.sql` | Once each, in number order. Safe to re-run, they're written to be idempotent. |
| `seed.sql` | Dev data only. Run whenever you want sample listings. |

**Workflow:** a database change means a new numbered file in `migrations/`
(next number, short snake_case name). In the SQL Editor create a new query
named `NNN name`, paste the file, run it, commit the file.
Throwaway checks go in a single query called `Scratch`, reuse it.
