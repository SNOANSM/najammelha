---
name: Auth and reporting integration
description: Cookie sessions and report category identifiers must stay aligned across the generated client and UI.
---

The generated API client must send `credentials: include` for this web app because authentication is cookie-based. Report forms and filters must submit category IDs, while category names and labels are display text.

**Why:** A successful login can still look broken if subsequent generated API calls omit the session cookie, and sending the Arabic display name instead of the database category ID causes report creation to fail validation or lookup.

**How to apply:** Keep cookie credentials enabled in the shared fetch wrapper and normalize API categories to use `id` for form/filter values and `label` for visible text.