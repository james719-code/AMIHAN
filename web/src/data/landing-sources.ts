export const nasaDatasets = [
  {
    name: 'GPM IMERG',
    use: 'Rainfall',
    detail: 'How often it rained and how much rain fell in past seasons.',
    url: 'https://gpm.nasa.gov/data/imerg'
  },
  {
    name: 'NASA POWER',
    use: 'Weather history',
    detail: 'Past temperature, rainfall, and sunlight for the climate archive.',
    url: 'https://power.larc.nasa.gov/docs/methodology/'
  },
  {
    name: 'SMAP',
    use: 'Soil moisture',
    detail: 'How wet the soil around crop roots was compared with past seasons.',
    url: 'https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/#smap'
  },
  {
    name: 'Harmonized Landsat and Sentinel-2 (HLS)',
    use: 'Vegetation',
    detail: 'How green the land around a field pin has been over time.',
    url: 'https://hls.gsfc.nasa.gov/data-products/'
  }
] as const;

export const sourceLogos = [
  {
    name: 'DOST–PAGASA',
    detail: 'Climate types, station records, and farm weather outlooks',
    logo: 'pagasa.png',
    url: 'https://www.pagasa.dost.gov.ph/climate/climate-data'
  },
  {
    name: 'Department of Agriculture',
    detail: 'Planting and harvest guides for Bicol crops',
    logo: 'department-of-agriculture.png',
    url: 'https://hvcdp.da.gov.ph/wp-content/uploads/2022/05/Guiya-sa-Gulay-2021.pdf'
  },
  {
    name: 'PhilRice',
    detail: 'Rice and crop rotation research',
    logo: 'philrice.png',
    url: 'https://www.philrice.gov.ph/wp-content/uploads/2016/04/Bicol.pdf'
  },
  {
    name: 'DA–BSWM',
    detail: 'Philippine Soil Series and local drainage surveys',
    logo: 'bswm.png',
    url: 'https://www.bswm.da.gov.ph/download/philippine-soil-series/'
  },
  {
    name: 'ISRIC',
    detail: 'SoilGrids estimates of soil properties',
    logo: 'isric.png',
    url: 'https://isric.org/explore/soilgrids'
  }
] as const;

export const sourceGroups = [
  {
    title: 'Weather & rainfall',
    detail: 'NASA POWER supplies daily rainfall at six provincial reference points and monthly climate at seven points for 2015–2024 (Local Solar Time). NASA Giovanni supplies the separate GPM IMERG V07 monthly rainfall average for the study area over the same years.',
    method: 'The 2024 daily release uses the nearest grid cell to each of Bicol’s 114 town and city markers for all 366 days (UTC). It combines MERRA-2 weather and land fluxes (0.5° × 0.625°), CERES SYN1deg solar radiation (1°), GPM IMERG rain (0.1°), and SMAP moisture (about 9 km).',
    links: [
      ['NASA POWER Daily API', 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/'],
      ['POWER data products', 'https://power.larc.nasa.gov/docs/methodology/'],
      ['GPM IMERG V07', 'https://gpm.nasa.gov/resources/documents/imerg-v07-technical-documentation'],
      ['NASA Giovanni', 'https://giovanni.gsfc.nasa.gov/giovanni/']
    ]
  },
  {
    title: 'Seasonal field conditions',
    detail: 'The rainfall summary counts days with at least 1 mm on a 0.1° NASA GPM IMERG grid during the same calendar month in 2021–2025. It uses complete months and divides rain days by the total number of days in those months. The Planner uses a POWER reference point when the IMERG rainfall average is unavailable.',
    method: 'The Planner compares 2025 SMAP root-zone moisture in roughly the upper metre of soil with the same month in 2016–2024. At a field pin, the Vegetation timeline uses NASA HLS v2.0 Landsat and Sentinel-2 imagery to show 30 m NDVI, a measure of greenness.',
    links: [
      ['POWER rainfall methodology', 'https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/#imerg'],
      ['POWER SMAP methodology', 'https://power.larc.nasa.gov/docs/methodology/data/sources_hydrology/'],
      ['NASA HLS products', 'https://hls.gsfc.nasa.gov/data-products/'],
      ['Planetary Computer imagery catalog', 'https://planetarycomputer.microsoft.com/docs/']
    ]
  },
  {
    title: 'Terrain, roads & places',
    detail: 'Mapzen Terrain Tiles combine USGS SRTM and GMTED2010 elevation with NOAA NCEI ETOPO1. The Bicol terrain mesh samples elevation about every 660 m. OpenStreetMap contributors provide roads and paths through a Protomaps snapshot, under the Open Database License.',
    method: 'GeoNames supplies place coordinates, with DILG Sorsogon used for Castilla. The PSA supplies geographic codes and 2024 census counts. The Smithsonian Global Volcanism Program supplies summit elevations. Regional plan maps and GeoNames inform water labels.',
    links: [
      ['Mapzen terrain credits', 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md'],
      ['OpenStreetMap attribution', 'https://www.openstreetmap.org/copyright'],
      ['Protomaps downloads', 'https://docs.protomaps.com/basemaps/downloads'],
      ['GeoNames', 'https://www.geonames.org/about.html'],
      ['DILG Sorsogon', 'https://region5.dilg.gov.ph/sorsogon/wp-content/uploads/2023/09/PAGBUGKOS-2nd-Edition-2.pdf'],
      ['PSA Bicol census', 'https://psa.gov.ph/content/highlights-region-v-bicol-region-population-2024-census-population-2024-popcen'],
      ['Smithsonian volcano records', 'https://volcano.si.edu/'],
      ['Bicol Regional Development Plan', 'https://dro5.depdev.gov.ph/wp-content/uploads/2024/04/Bicol-Regional-Development-Plan-2023-2028_NRO5Web_revApril24-1_compressed.pdf']
    ]
  },
  {
    title: 'Climate types & crop calendars',
    detail: 'The Planner estimates climate type from DOST–PAGASA’s Modified Coronas map, based on 1951–2010 records and published in 2014. The map is an approximate lookup near shores and climate boundaries, and the Planner lets you set the type manually.',
    method: 'The crop library draws from a supplied 48-crop workbook, Department of Agriculture production guides, and regional calendars. Individual crop cards link to their production references. The rotation examples cite DA Region V trials, DOST–PCAARRD, and PhilRice research.',
    links: [
      ['PAGASA climate type map', 'https://pubfiles.pagasa.dost.gov.ph/pagasaweb/files/climate/climate-final-3.jpg'],
      ['DA Bicol vegetable guide', 'https://hvcdp.da.gov.ph/wp-content/uploads/2022/05/Guiya-sa-Gulay-2021.pdf'],
      ['Bicol rice calendar', 'https://acap-bicol.github.io/cropping-calendar-v2/'],
      ['FAO rainfed calendar', 'https://www.fao.org/4/ap562e/ap562e.pdf'],
      ['DA–BPI production guides', 'https://buplant.da.gov.ph/production-guide/'],
      ['Bicol mungbean trials', 'https://www.pcaarrd.dost.gov.ph/index.php/quick-information-dispatch-qid-articles/wise-farming-options-enhance-bicol-region-s-mungbean-production'],
      ['PhilRice Bicol field research', 'https://www.philrice.gov.ph/wp-content/uploads/2016/04/Bicol.pdf']
    ]
  },
  {
    title: 'Soil & local reference data',
    detail: 'The project’s reference collection includes the DA–BSWM Philippine Soil Series, 250 m ISRIC SoilGrids predictions for 5–15 cm depth, and PAGASA’s 1991–2020 station normals for Daet, Legazpi, Masbate, and Virac Synop.',
    method: 'The Pamplona pilot also draws on the DA–BSWM Camarines Sur soil survey and rice suitability map for local drainage and floodplain context.',
    links: [
      ['Philippine Soil Series', 'https://www.bswm.da.gov.ph/download/philippine-soil-series/'],
      ['ISRIC SoilGrids', 'https://docs.isric.org/globaldata/soilgrids/index.html'],
      ['PAGASA station normals', 'https://www.pagasa.dost.gov.ph/climate/climate-data'],
      ['Camarines Sur soil survey', 'https://bswm.da.gov.ph/wp-content/uploads/Camarines-Sur.pdf'],
      ['Camarines Sur rice suitability', 'https://bswm.da.gov.ph/wp-content/uploads/Camarines-Sur_Suitability-rice.pdf']
    ]
  }
] as const;
