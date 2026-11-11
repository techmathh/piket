# Security Specification — SiPiket OSIS

1. **Authentication & Roles**:
   - Public Read (`get`, `list`) on `/members`, `/schedules`, `/swaps`, and `/attendance` so the standalone Display Board (`Layar Display`) can display live schedules without login prompts.
   - Authenticated Write (`create`, `update`, `delete`) on `/members`, `/schedules`, `/swaps`, and `/attendance` requires `isAuthenticated()` (`request.auth != null` and `request.time != null`).
   - Admin role collection `/admins/{adminId}` is restricted to `isAdmin()` (`exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or verified email `saqilakhalifah@gmail.com`).
2. **Schema & Bounds Validation**:
   - Every write enforces strict key whitelisting (`hasOnly` and `hasAll`), string length bounds, type checks, and ID immutability (`request.resource.data.id == resource.data.id`).
3. **Default Deny**:
   - Root wildcard `match /{document=**}` denies all reads and writes by default.
