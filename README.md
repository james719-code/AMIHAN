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

Open the Vite URL printed by the dev server. The starter explorer uses clearly labeled seven-day synthetic readings and reference points. The map and climate demo load entirely from files served by FieldWise.

## Crop rotation planning

Select a city, town, or volcano to zoom in on its terrain and roads. **Reset Bicol view** returns to the regional overview.

The planner lists crops documented in Bicol and shows the soil, rainfall, and climate inputs pending for the selected place. See [the data intake notes](data/README.md#crop-rotation-and-rainfall-inputs) for the BSWM, IMERG, and NASA POWER files. Crop suggestions and rainfall replay await the supplied data.

Use **Climate** on the map to switch between demo rainfall, temperatures, humidity, and solar radiation. Scrub or play the seven synthetic days. The readings appear at the original reference coordinates. In 3D, positive rainfall adds animated marks at those points. Zero and missing values remain distinct.

Use **Field Check** to shade the regional terrain by slope and select two land points for an elevation profile. Measurements use the original terrain heights. The display mesh has roughly 660 m spacing across Bicol, so the profile describes regional terrain and leaves gaps over water. The rotation planner shows point A and takes planting month, water source, drainage, and previous crop as field inputs.

## Local Bicol map

Three.js loads [bicol.glb](web/public/maps/bicol.glb), a glTF model with separate **Terrain** and **Water** meshes. Import the file into Blender to edit the geometry and export it as glTF Binary with Y Up enabled. Keep the **Terrain** mesh name and the model's origin and scale so the markers stay aligned. The glTF coordinates are in meters, with X pointing east, Y up, and Z south. Adjust the camera, lighting, and 3× vertical exaggeration in [bicol-map.ts](web/src/components/bicol-map.ts).

The overview fits Bicol inside a wider terrain model. The Bicol mesh samples Mapzen elevation tiles about every 660 m, with about 2.8 km spacing in the surrounding terrain. SRTM and GMTED2010 elevation data are courtesy of the U.S. Geological Survey, and ETOPO1 is courtesy of NOAA NCEI. [Mapzen source credits](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)

[Place records](web/src/data/places.json) and the [municipality catalog](web/src/data/municipalities.json) cover all seven Bicol cities, 107 municipalities, and three volcanoes. Municipality markers use GeoNames town or seat coordinates matched against the PSA geographic codes. Castilla uses coordinates from DILG Sorsogon. Elevations are estimates at the marker coordinates, sampled from Mapzen's zoom-12 tiles at roughly 37 m pixel spacing. Population covers the full city or municipality and comes from the 2024 census. Volcano cards show Smithsonian summit elevations. The six climate series are keyed to the original synthetic reference sites and display their own site coordinates. [GeoNames](https://www.geonames.org/about.html) · [PSA cities](https://psa.gov.ph/classification/psgc/cities/0500000000) · [PSA municipalities](https://psa.gov.ph/classification/psgc/municipalities/0500000000) · [Smithsonian Global Volcanism Program](https://volcano.si.edu/)

Change the extent and resolution in [bicol-map.json](web/src/data/bicol-map.json) or the elevation colors in [the generation script](web/scripts/generate-bicol-terrain.mjs). Regenerate the model with the following command, which downloads the source elevation tiles during generation.

```powershell
npm.cmd --prefix web run generate:terrain
```

### Roads and water labels

The map draws highways across Bicol. Connecting roads, local streets, and mapped paths appear as the view gets closer. Street and path coverage extends roughly 5–6 km from the center of every city and municipality, depending on what OpenStreetMap contributors have mapped. The **Roads** switch controls the entire overlay. Labels for seas, gulfs, and bays are based on the Bicol Regional Development Plan and GeoNames. [Bicol regional maps](https://dro5.depdev.gov.ph/wp-content/uploads/2024/04/Bicol-Regional-Development-Plan-2023-2028_NRO5Web_revApril24-1_compressed.pdf) · [GeoNames](https://www.geonames.org/about.html)

[Road geometry](web/public/maps/bicol-roads.bin) is stored separately from the terrain under the Open Database License. Its [manifest](web/public/maps/bicol-roads.json) records the source snapshot and indexes the 25 km street and path sections. Each segment stores two X/Y/Z endpoints as little-endian 32-bit integers in meters, using the same origin as the terrain. The app loads the overview and nearby detail from local files. [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright) · [Protomaps basemap](https://docs.protomaps.com/basemaps/downloads)

Rebuild the roads after changing the terrain or the place coordinates. The generator downloads a pinned source snapshot. To update the roads, pass a new Protomaps PMTiles URL after `--`.

```powershell
npm.cmd --prefix web run generate:roads
```

## Weather importer

The data importer accepts a registered site ID and NASA POWER daily CSV:

```powershell
node data/import-power.mjs --site albay-01 data/raw/albay-01-2024.csv data/processed/albay-01-2024.json
```
