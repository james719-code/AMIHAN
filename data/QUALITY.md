# FieldWise dataset quality

The [combined CSV](processed/fieldwise.csv) supports historical climate summaries and a rule-based crop rotation pilot. A supervised crop-outcome model needs measured outcomes from farms and seasons that can be matched to the climate records.

## Audit results

The CSV contains 64,834 rows and 48 columns. Every row has the expected number of columns. There are zero exact duplicates and zero duplicate records when keyed by dataset, period, time standard, location ID, date or calendar month, and baseline years. A join on location and date alone would encounter 2,998 repeated keys counted beyond the first row, because some daily, monthly, annual, UTC, and Local Solar Time records share those fields.

| Data | Coverage and checks |
| --- | --- |
| Municipal NASA weather | All 114 mapped towns and cities have all 13 measurements for every UTC day of 2024. All 542,412 measurements match the published weather files. All 160,308 source-cell measurements in those files match the saved NASA API responses. |
| Historical NASA POWER | Complete 2015–2024 daily rainfall for six reference locations, and complete monthly and annual summaries for seven. Across 720 overlapping site-months, the largest difference between the sum of daily rainfall and the archived monthly total was 0.15 mm. |
| Regional IMERG | All 120 monthly estimates for 2015–2024. Each estimate covers the study area's bounding box. |
| PAGASA station normals | All 12 baseline months at each of four stations for 1991–2020. These are long-term averages. |
| BSWM and SoilGrids | BSWM soil series at 105 of 114 markers, all five SoilGrids measurements at 57, and both sources at 54. Six markers lack values from either source. SoilGrids texture totals range from 99.9% to 100.1%. |

The populated values passed basic checks for missing-value codes, temperature ordering, and numeric ranges for rainfall, humidity, soil moisture, and other measurements. Empty cells are expected when a measurement does not apply to a row. The soil coverage figures count town and city markers.

## Limits for crop decisions

- **Grid measurements are shared.** The 41,724 municipal rows draw on 17 MERRA-2 cells, 10 CERES cells, 91 IMERG cells, and 92 SMAP cells. The town marker selects a grid estimate. Nearby farms may experience different conditions. [NASA POWER hydrology](https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/)
- **Daily rainfall depends on the source.** Across 33,672 distinct MERRA-2 cell and IMERG cell pairs by date, the products differed by 6.05 mm/day on average in absolute terms. They fell on opposite sides of a 1 mm wet-day cutoff 34.9% of the time. The cutoff is for this audit only. A local accuracy comparison needs daily rain-gauge observations matched by location and accumulation window. Retain each rainfall series and its time standard. [PAGASA climate data](https://origin.pagasa.dost.gov.ph/climate/climate-data)
- **One year gives one set of municipal seasonal conditions.** Use the longer reference series for historical patterns. Keep UTC daily data, Local Solar Time daily data, and station normals distinguishable when calculating totals and comparing seasons.
- **Farm conditions are missing.** The CSV has no field-level drainage or irrigation records, measured harvest yields, or crop failures. The soil layer describes the sampled marker and has incomplete coverage. [ISRIC SoilGrids documentation](https://docs.isric.org/globaldata/soilgrids/index.html)

## Recommended pilot

Start with **mungbean after rainfed rice in Pamplona, Camarines Sur**, where DA Region V trialed the rotation. Use the previous crop and harvest date to identify the candidate. Ask for drainage and available water, then check the proposed planting window against locally reviewed crop guidance and multi-year rainfall. Return **Suitable under provided conditions**, **Conditional**, **Unsuitable**, or **Insufficient data**, with the reason and the input that would change the result. Have a local agriculture or extension reviewer confirm the thresholds and check pilot cases before use. [FieldWise project plan](../docs/PROJECT_PLAN.md) · [DOST–PCAARRD Bicol field trial](https://www.pcaarrd.dost.gov.ph/index.php/quick-information-dispatch-qid-articles/wise-farming-options-enhance-bicol-region-s-mungbean-production)

Extend the municipal daily rainfall history and compare it with overlapping PAGASA gauge records before adopting rainfall cutoffs. Use those records to check dry spells and heavy-rain events relevant to the pilot. A later water-balance feature can estimate reference evapotranspiration from daily temperature, humidity or dew point, wind, and solar radiation with site latitude and elevation. [FAO-56 reference evapotranspiration](https://www.fao.org/4/x0490e/x0490e08.htm)

## What to collect for training

Build one record per field and season with a field ID and location, crop and variety, previous crop, planting and harvest dates, drainage and irrigation, harvest area, and measured yield or crop failure. Collect several seasons across farms. Start with one target, such as yield for one crop. For a planting-time prediction, use only inputs available at the planting decision. Test on held-out later seasons and assess performance on farms and weather grid cells excluded from training.

Municipal agriculture offices are a candidate source for field records. PhilRice PRiSM provides rice planting, estimated yield, and damage products that can help prioritize areas to investigate. The availability of matching field observations still needs to be confirmed. [PhilRice PRiSM research report](https://www.philrice.gov.ph/wp-content/uploads/2025/11/2024-RandD-Highlights-ASPPD.pdf)
