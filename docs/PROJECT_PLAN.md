# FieldWise project plan

## Product requirements

FieldWise is a browser-based agricultural planning tool for Bicol Region V. It helps farmers, agricultural extension staff, and researchers explore terrain, inspect the evidence available for a location, and compare crop rotation options once locally reviewed rules and data are available.

The default map view covers all six provinces. Use PSA province codes as string identifiers for Albay (`0500500000`), Camarines Norte (`0501600000`), Camarines Sur (`0501700000`), Catanduanes (`0502000000`), Masbate (`0504100000`), and Sorsogon (`0506200000`). A selected province filters the available sites. A selected site drives the climate charts and, when supported, the planning form. A single site's readings describe the sampled location and grid cell. Province or region summaries require a separately documented spatial aggregation method. [PSA Region V classification](https://psa.gov.ph/classification/psgc/provinces/0500000000)

Start with a public, read-only explorer and keep planning form inputs in the browser. The first release covers province boundaries and named sampling sites. Municipality boundaries, field drawing, satellite vegetation imagery, and hazard layers are follow-up features. Accounts, cloud-saved farms, live forecasts, and national coverage are outside the initial release.

## Website and 3D map

| Area | Requirement |
| --- | --- |
| Stack | React and TypeScript on Vite, Tailwind CSS and shadcn/ui for UI, Three.js for mapping, and shadcn/ui Chart with Recharts for time series. Use npm, commit its lockfiles, and use Node 22.12 or later in the Node 22 series. [Vite setup](https://vite.dev/guide/) · [shadcn/ui for Vite](https://ui.shadcn.com/docs/installation/vite) · [Three.js documentation](https://threejs.org/docs/) |
| Layout | Use one page with a map, province and site selectors, and a details panel. On small screens, place the controls and details below the map. Keep the keyboard-accessible selectors and daily readings table usable without the map. |
| Camera | Start in a north-up 2D view fitted to all six province polygons. If polygons are unavailable, use an approximate demo extent of `[121.5, 11.5]` to `[125.1, 15.1]` in longitude/latitude order. Add pan, zoom, compass, a reset-to-Bicol control, and a 2D/3D switch. Selecting a province highlights it and fits its bounds when its geometry is available. Selecting a site highlights its marker and opens its details. Preserve the selected province and site when switching views. |
| 3D terrain | Bundle a glTF model with editable terrain and water meshes. Load it in Three.js for both the north-up 2D view and the angled 3D view. Fit the camera to Bicol and extend the terrain beyond the default view. Keep hillshade independently toggleable. Store elevations in meters and label the 3× vertical exaggeration used for 3D display. Credit Mapzen, USGS, and NOAA. [Local map setup](../README.md#local-bicol-map) |
| Boundaries and sites | Use simplified WGS 84 GeoJSON for province polygons and site markers. Keep islands and multipolygons. Use NAMRIA/Geoportal Philippines as the first geometry source and check the chosen release's reuse terms before bundling. Join the features to the PSA codes. If no publishable geometry is available for the starter, keep the region view and selectors working and display “Province boundaries unavailable.” Use synthetic polygons only in tests. [Geoportal Philippines](https://www.geoportal.gov.ph/) · [PSA classifications](https://psa.gov.ph/classifications-api/psgc) |
| Basemap and layer controls | Bundle local terrain, hillshade, labeled places and water bodies, and OpenStreetMap highways, connecting roads, city streets, and paths. Keep a road visibility control and reveal smaller roads on zoom. Add province fills and outlines when publishable geometry is available. Provide a legend with units and dataset attribution. |
| Climate dashboard | Show daily rainfall, mean and maximum temperature, relative humidity, and solar radiation. Offer a metric selector, a date range control, a chart, a daily table, and coverage counts. Use bars for rainfall and lines for other metrics. Missing values appear as gaps and “Unavailable.” Show a partial label when totals or averages use an incomplete series. Label demo data and validated history visibly. |
| Fallbacks | If the bundled model fails to load, show a retry action. If WebGL2 is unavailable, keep the province/site selectors, charts, and table usable. If an overlay or date range has no coverage, show the unavailable state and keep the other layers and controls active. |

When a verified gridded rainfall or moisture dataset is ready, render its grid or raster with its native resolution and selected date or period in the legend. Use markers for point downloads. Keep map selection and chart dates tied to the same published time standard.

## Data requirements and pipeline

| Dataset | Use and validation |
| --- | --- |
| Province boundaries | Extract the six province features. Record publisher, vintage, original identifier, and terms. Validate geometry and code joins, preserve islands, and derive viewpoint bounds from the published geometry. Province polygons serve regional exploration. |
| Terrain and slope | Generate the starter display model from Mapzen Terrain Tiles. For reproducible elevation and slope analysis, use a versioned Copernicus GLO‑30 digital surface model, approximately 30 m. Mosaic and clip with a buffer, calculate slope in degrees in a meter-based projection using GDAL, and generate web tiles for the Bicol extent. Preserve NoData and record the source resolution and vertical reference. Slope calculations use the original elevation values, independent of display exaggeration. Carry forward the required Copernicus attribution. [Copernicus DEM and license](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) · [GDAL slope](https://gdal.org/en/stable/programs/gdal_raster_slope.html) |
| Historical weather | Start a fresh NASA POWER daily query for January 1–December 31, 2024 in UTC. Start with one verified land sampling site per province and record site name, point coordinates, and selection rationale. Request `PRECTOTCORR`, `T2M`, `T2M_MAX`, `RH2M`, and `ALLSKY_SFC_SW_DWN` through standard-resolution Agroclimatology. Use 2024 to verify the pipeline and use multi-year climate history for seasonal comparisons. Compare with available PAGASA station or gridded data where periods and units can be aligned. [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) · [PAGASA CliMap](https://climgridph.pagasa.dost.gov.ph/climapv2/) |
| Higher-resolution rainfall and soil moisture | Validate GPM IMERG precipitation and SMAP surface and root-zone soil moisture as separate source products. Record the source and resolution returned, match date windows explicitly, and preserve any conflict between the parameter label and product metadata for review. Treat these as gridded estimates. [NASA POWER meteorological sources](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/) · [NASA POWER hydrology sources](https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/) |
| Soil and crop guidance | Evaluate DA-BSWM soil series and suitability layers. Use locally applicable DA, PhilRice, or extension office crop calendars and agronomic references. Record the scale, coverage, date, and reuse permissions for each layer. Field-specific planning uses user-provided drainage, irrigation, crop history, and soil information where required by a reviewed rule. [BSWM maps](https://www.bswm.da.gov.ph/bswm-maps/) · [PhilRice Bicol research](https://www.philrice.gov.ph/wp-content/uploads/2020/07/Bicol-2019.pdf) |
| Optional overlays | Add cloud-masked Sentinel‑2 surface reflectance for satellite imagery or vegetation indices if useful. Keep acquisition dates and masked areas visible. For flood or landslide context, link to official GeoRiskPH resources first and publish overlays only when authoritative data and reuse permission are available. [Copernicus Sentinel‑2 documentation](https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html) · [GeoRiskPH HazardHunterPH](https://hazardhunter.georisk.gov.ph/about-hazardhunterph) |

### Import and publication

1. Store downloads under `data/raw/`. Use a tracked source catalog for provider, source URL, product, version or retrieval date, attribution, terms, coverage, resolution, units, CRS, and time standard. Register site coordinates as `[longitude, latitude]` with a stable site ID and province code. Verify real sites against the cleaned land and provincial geometry before publishing. Exclude the earlier CSV and results from the project and its fixtures.
2. Implement the weather importer with Node and `csv-parse`. Accept a registered site ID, an input CSV path, and an output JSON path. Example command after implementation is `node data/import-power.mjs --site albay-01 data/raw/albay-01-2024.csv data/processed/albay-01-2024.json`. Preserve source headers, normalize `YEAR` and `DOY` to ISO dates, sort rows, and convert `-999` and blanks to `null`. Preserve measured zero. Report per-metric coverage and missing dates. Reject duplicate or invalid dates, invalid numeric readings, unknown sites, and exports with no usable series. Validate before replacing an existing output.
3. Publish versioned static artifacts from `data/processed/`. Keep a manifest with `schemaVersion`, `releaseId`, sources, site metadata, available layers, and relative artifact URLs. Publish GeoJSON for boundaries, JSON per site for weather, and tiled assets for large raster layers. Keep analysis rasters out of the web build. The frontend reads the manifest and loads the selected artifact on demand. Use WGS 84 longitude/latitude for GeoJSON and Web Mercator XYZ for raster tiles.
4. Use the same schema for starter fixtures and published weather. Each row has `date`, `rainfallMm`, `meanTemperatureC`, `maxTemperatureC`, `relativeHumidityPct`, and `solarRadiationMjM2`. Values are numbers or `null`. Metadata includes a source ID, site ID, selected dates, units, time standard, and coverage. Keep optional moisture series separate in the first version so a missing moisture product does not prevent weather display.

## Crop rotation planner

Build this after the terrain and historical data release. Start with a limited list of locally reviewed crops and sequences. Let users select a site, target planting month, previous crop or crop family, water source, and known soil and drainage conditions. Allow “Unknown” inputs and use the existing site elevation, slope, and seasonal climate only where the source resolution and coverage support the rule.

Use a deterministic, versioned ruleset with a cited basis for each rule. Each sequence should show planting windows, why it qualifies or fails, limiting conditions, missing inputs, and rule sources. Use **Suitable under provided conditions**, **Conditional**, **Unsuitable**, and **Insufficient data** as result states. Required unknowns produce **Insufficient data**. Expose the sequence and rationale for review before adding any automated ranking.

Before enabling real recommendations, have a Bicol agriculture or extension reviewer approve the rules and review documented cases spanning rainfed and irrigated conditions, slope or drainage limits, conflicting evidence, missing inputs, and crops across different seasons. Use the applicable crop calendar and multi-year weather for seasonal rules. Keep field-level recommendations unavailable where evidence or rule coverage is insufficient.

## Repository and Git

```text
FieldWise/
├── README.md
├── .gitignore
├── docs/
│   └── PROJECT_PLAN.md
├── web/
│   ├── package.json and package-lock.json
│   ├── .env.example
│   ├── public/datasets/       # Optional local published data
│   └── src/                   # Map, dashboard, shared types, and demo fixtures
└── data/
    ├── README.md
    ├── package.json and package-lock.json
    ├── sources.json
    ├── import-power.mjs
    ├── tests/                 # Small synthetic CSV and GeoJSON fixtures
    ├── raw/                   # Local original downloads
    └── processed/             # Local normalized data and generated map assets
```

Put the following in the root `.gitignore` during the first coding pass. The tracked `.env.example` holds public optional map and dataset settings. `VITE_` variables are visible in the browser bundle. [Vite environment variables](https://vite.dev/guide/env-and-mode.html)

```gitignore
node_modules/
dist/
.vite/
coverage/
playwright-report/
test-results/
*.tsbuildinfo
*.log
.DS_Store
Thumbs.db
.env
.env.*
!.env.example
/data/raw/
/data/processed/
/web/public/datasets/
```

Track source, configuration, lockfiles, the source catalog, small synthetic test data, and the regional glTF model needed to run the demo. Keep large terrain, imagery, weather downloads, and generated tiles in versioned release storage outside Git. Document the steps to recreate and publish them.

## Implementation milestones for GPT‑5.6

| Milestone | Deliverable and acceptance |
| --- | --- |
| **1. Write the initial code** | Scaffold `web/` and `data/`, add the root `.gitignore`, and document the local setup. Build the map-first page, 2D/3D toggle, Bicol reset view, and province selection. Bundle one clearly labeled demo series with seven days of synthetic readings for each province, including a known zero and a missing value. Show site markers only where coordinates are verified. Add the NASA CSV importer and synthetic tests. Verify regional terrain and reference-point placement using the bundled model. The browser loads map and climate data from FieldWise. |
| **2. Publish the regional explorer** | Produce a versioned release with verified province geometry, a labeled sampling site in each province, dated historical data, and documented coverage by metric and site. Wire the map, selectors, and charts to the same site ID. Store tiles and larger assets separately and connect the static website over HTTPS. Verify attribution, loading, tile failures, and standalone dashboard operation before releasing. |
| **3. Add agricultural layers** | Publish elevation and slope from the reproducible terrain pipeline. Add vetted soil and gridded rainfall or moisture layers as source coverage allows. Compare derived slope and selected elevations to independent references, and verify coastlines, islands, units, and NoData before publishing. |
| **4. Add the crop rotation planner** | Implement the reviewed input form, ruleset, and explanation view. Test every result state and have the reviewer check representative Bicol cases before enabling recommendations. |

### Starter build checks

- From a fresh clone run `npm --prefix web ci`, `npm --prefix web run lint`, `npm --prefix web run build`, `npm --prefix web run dev`, `npm --prefix data ci`, and `npm --prefix data test`. Document the `npm.cmd` equivalent for PowerShell if required.
- Verify all six provinces, metric and date switching, map reset, the 2D/3D toggle, no-WebGL and terrain-failure states, visible attribution, and keyboard and mobile use. Confirm a site change clears any stale chart values while new data loads.
- Test leap-day import, missing dates, legitimate zero rainfall, `-999`, invalid dates and duplicate rows, invalid numbers, conflicting source metadata, and preservation of previous output after a failed import. Verify ignore rules with `git check-ignore`.
- Add CI for lint, build, data tests, and published-manifest validation. For deployment, use a static HTTPS host that supports the chosen tile endpoints and CORS. Test a preview release, smoke-test a published build on desktop and mobile, and retain the prior data release for rollback.
