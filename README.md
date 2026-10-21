# Staffroom1 web

The teacher-facing frontend for Staffroom1. The backend lives in `/opt/staffroom1` and is
read-only from here; backend requests go in `FRONTEND_REQUESTS.md`.

```sh
npm install
npm run gen        # API types from /openapi.json, analysis types + Ajv validator, metric help text
npm run dev        # http://127.0.0.1:5173 (proxies /api to 127.0.0.1:8000)
npm run typecheck && npm run lint && npm test
```

Generated files (`*.gen.*`) are committed, and their sources are snapshotted in `schema/`, so a
build doesn't need the API to be running. Design decisions: `docs/design-plan.md`. The style
tile is at `/style-tile`.
