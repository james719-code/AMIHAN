# FieldWise

FieldWise is a map-first agricultural planning project for Bicol Region V, Philippines. The [project plan](docs/PROJECT_PLAN.md) defines the 3D terrain viewer, climate and soil data pipeline, crop rotation planner, and the first coding milestone.

## Local setup

The first coding milestone is scaffolded in `web/` and `data/`. Use Node 22.12 or later in the Node 22 series.

```powershell
npm.cmd --prefix web install
npm.cmd --prefix web run lint
npm.cmd --prefix web run build
npm.cmd --prefix data install
npm.cmd --prefix data test
npm.cmd --prefix web run dev
```

Open the Vite URL printed by the dev server. The starter explorer uses clearly labeled seven-day synthetic readings and reference points. Terrain is configured through `web/.env.example`; copy it to `web/.env` to override the public Mapterhorn TileJSON endpoint. The browser does not call NASA during the starter demo.

The data importer accepts a registered site ID and NASA POWER daily CSV:

```powershell
node data/import-power.mjs --site albay-01 data/raw/albay-01-2024.csv data/processed/albay-01-2024.json
```
