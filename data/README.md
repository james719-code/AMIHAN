# FieldWise data package

This package contains the small, reproducible data utilities used by FieldWise. Large original downloads belong in `raw/` and generated publication artifacts belong in `processed/`; both directories are intentionally ignored by Git.

## NASA POWER importer

Install dependencies from the repository root with:

```powershell
npm.cmd --prefix data install
```

Import a registered site's daily CSV with:

```powershell
node data/import-power.mjs --site albay-01 data/raw/albay-01-2024.csv data/processed/albay-01-2024.json
```

The importer validates the site, dates, numeric readings, duplicates, and usable coverage before replacing an existing output. It accepts NASA POWER CSV header blocks and normalizes the five starter metrics into the shared FieldWise weather schema.
