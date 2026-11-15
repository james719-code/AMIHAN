# AMIHAN - Adaptive Multi-season Insights for Harvest and Agricultural Needs

AMIHAN is an agricultural planning project for Bicol Region V, Philippines. Overview opens first, followed by Crop Planner and Field Map. Overview shows how often it rained during the current calendar month in 2021–2025 and links to PAGASA’s current outlook.

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

Open the Vite URL printed by the dev server. The map and 2015–2024 climate history load from files served by AMIHAN.

## Crop rotation planning

Use **Add plot** under **Field setup** to keep separate plans. Each named plot keeps its town or map pin, crop history, dates, and field answers in this browser. Open **Watering guide**, select a crop and growth stage, and enter the soil condition from a field check. The guide uses those answers with the plot’s water source and drainage. Monthly rainfall history provides seasonal context for comparing planting dates.

Choose a town or city and a planting date in **Crop Planner**. Enter the previous crop and harvest date, water source, and drainage. Crop cards show planting and expected harvest windows and link to any field answers needed. Open **Planting calendar settings** to review the local PAGASA climate type or override it. Use **Download PNG guide** to save the top crop options, rainfall chart, and field notes for offline use.

To check the rice–mungbean pilot, select Pamplona, Camarines Sur and enter rice as the previous crop with rainfed as the water source. Enter the available soil moisture or water and the next rice planting date. The planner checks that the mungbean planting window fits and that final picking and field preparation can finish before the next rice planting. The crop library includes all 48 crops from the supplied workbook, with illustrations, growth milestones, and production references.

Open **Rain and soil** to compare historical rainfall, review your drainage answer, and see how area soil moisture in 2025 compared with the 2016–2024 range for the same month. Use **Planting month** to try another month. The climate archive and source credits are available under data sources on **Overview**.

Use **Expected Rain** on the map to compare towns for a selected month. It estimates the chance of at least 1 mm of rain on a day from that month’s 2021–2025 NASA IMERG records. The median and middle 50% summarize historical monthly totals. The panel links to PAGASA for a current farm forecast. The climate archive preserves daily and monthly historical readings.

Open **Field Map** to view terrain and roads. Search by town, city, or province under **Places**, or choose a marker directly. **Reset view** in map settings returns to the regional view. Use **Field check** to shade the terrain by slope and select two land points for an elevation profile. Measurements use the original terrain heights. The display mesh has roughly 660 m spacing across Bicol, so the profile describes regional terrain and leaves gaps over water. After selecting point A, choose **Use this field in Planner**. Open **Vegetation timeline** for NASA HLS observations at the pin, which require an internet connection and may have gaps.

The web app builds with the [bundled 2015–2024 climate readings](web/src/data/historical-climate.json). Original NASA POWER and Giovanni exports are kept locally.

## Local Bicol map

Three.js loads [bicol.glb](web/public/maps/bicol.glb), a glTF model with separate **Terrain** and **Water** meshes. Import the file into Blender to edit the geometry and export it as glTF Binary with Y Up enabled. Keep the **Terrain** mesh name and the model's origin and scale so the markers stay aligned. The glTF coordinates are in meters, with X pointing east, Y up, and Z south. Adjust the camera, lighting, and 3× vertical exaggeration in [bicol-map.ts](web/src/components/bicol-map.ts).

Browsers without accelerated WebGL open the interactive 2D map automatically. Field Check still uses the original terrain heights. After replacing the terrain model, run `npm.cmd --prefix web run generate:flat-map` to regenerate its 2D terrain, hillshade, and slope images locally.

The overview fits Bicol inside a wider terrain model. The Bicol mesh samples Mapzen elevation tiles about every 660 m, with about 2.8 km spacing in the surrounding terrain. SRTM and GMTED2010 elevation data are courtesy of the U.S. Geological Survey, and ETOPO1 is courtesy of NOAA NCEI. [Mapzen source credits](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)

[Place records](web/src/data/places.json) and the [municipality catalog](web/src/data/municipalities.json) cover all seven Bicol cities, 107 municipalities, and three volcanoes. Municipality markers use GeoNames town or seat coordinates matched against the PSA geographic codes. Castilla uses coordinates from DILG Sorsogon. Elevations are estimates at the marker coordinates, sampled from Mapzen's zoom-12 tiles at roughly 37 m pixel spacing. Population covers the full city or municipality and comes from the 2024 census. Volcano cards show Smithsonian summit elevations. [GeoNames](https://www.geonames.org/about.html) · [PSA cities](https://psa.gov.ph/classification/psgc/cities/0500000000) · [PSA municipalities](https://psa.gov.ph/classification/psgc/municipalities/0500000000) · [Smithsonian Global Volcanism Program](https://volcano.si.edu/)

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

## NASA POWER downloads

Build the 2024 municipal weather files from the public NASA POWER API. The first run downloads the source files. Later runs reuse the local downloads.

```powershell
npm.cmd --prefix data run fetch:municipal-power
```

See the [data notes](data/README.md#2024-municipal-weather) for the source resolutions, download locations, and the earlier six-site verification files.
