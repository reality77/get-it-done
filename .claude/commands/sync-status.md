Diagnose the PouchDB/CouchDB sync configuration for the get-it-done app.

## Steps

1. Read `src/get-it-done/src/lib/couchdb.ts` to understand how the remote database is configured (URL construction, auth headers, sync options).
2. Read `src/get-it-done/src/stores/auth.ts` to understand the authentication flow and how credentials are passed to the sync layer.
3. Summarise:
   - The remote URL pattern (how the CouchDB host/database is determined)
   - How authentication is handled (credentials, session cookies, etc.)
   - The sync strategy (one-shot vs. live, retry logic, conflict handling)
4. Flag any obvious issues:
   - Missing error handling on sync failures
   - Credentials stored insecurely
   - No conflict resolution strategy
   - Hard-coded URLs or credentials
5. If the user described a specific sync problem, focus analysis on the most likely cause and suggest concrete fixes.
