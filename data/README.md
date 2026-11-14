# FieldWise data package

This package contains the small, reproducible data utilities used by FieldWise. Large original downloads belong in `raw/` and generated publication artifacts belong in `processed/`; both directories are intentionally ignored by Git.

## Crop rotation and rainfall inputs

When the files arrive, register the product, version, spatial coverage, time coverage, units, and missing-value rules in [the source catalog](sources.json).

| Source | Files and metadata to retain | Use |
| --- | --- | --- |
| [DA–BSWM](https://www.bswm.da.gov.ph/download/philippine-soil-series/) | Soil-series polygons with projection, attributes, and map legend, or georeferenced soil tests with sampling depth | Intersect the actual soil coverage with the planning area. Preserve multiple mapping units and areas with unknown soil. |
| [NASA GPM IMERG](https://gpm.nasa.gov/resources/documents/imerg-v07-technical-documentation) | Precipitation export with product/run, cell coordinates, timestamps, interval, units, and fill values | Replay historical rainfall by grid cell. For half-hourly rates in mm/hour, multiply by 0.5 hours to obtain interval depth in mm. Preserve missing intervals separately from dry ones. |
| [NASA POWER](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) | Daily agroclimatology exports with the source header, requested coordinates, date range, and time standard | Supply temperature, humidity, and solar radiation. Align dates with IMERG before comparing or aggregating. Keep each product's precipitation series separately identified. |

Soil polygons and rainfall cells retain their own footprints. Field-level rotation assessment also needs the planting month, irrigation, drainage, crop history, and locally reviewed rules. The existing weather fixtures are synthetic examples.

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
