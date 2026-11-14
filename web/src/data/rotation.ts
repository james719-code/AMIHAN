export const planningSources = [
  {
    id: 'soil',
    name: 'Soil',
    provider: 'DA–BSWM',
    description: 'Soil series or soil tests for the selected area.',
    url: 'https://www.bswm.da.gov.ph/download/philippine-soil-series/'
  },
  {
    id: 'rain',
    name: 'Rainfall',
    provider: 'NASA GPM IMERG',
    description: 'Gridded precipitation for historical rainfall replay.',
    url: 'https://gpm.nasa.gov/resources/documents/imerg-v07-technical-documentation'
  },
  {
    id: 'climate',
    name: 'Climate',
    provider: 'NASA POWER',
    description: 'Daily temperature, humidity, and solar radiation.',
    url: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/'
  }
] as const;

export const cropResearch = [
  {
    title: 'Rice and corn',
    detail: 'PSA tracks palay and corn production across Bicol.',
    source: 'PSA regional crop production',
    url: 'https://psa.gov.ph/system/files/aad/Full%20Report%2C%202023%20to%202025%20Regional%20Value%20of%20Production%20in%20Agriculture%20and%20Fisheries.pdf'
  },
  {
    title: 'Peanut',
    detail: 'PhilRice Bicol trialed a rice → rice → peanut sequence at its research station.',
    source: 'PhilRice Bicol field research',
    url: 'https://www.philrice.gov.ph/wp-content/uploads/2016/04/Bicol.pdf'
  },
  {
    title: 'Sweet potato, squash, and sitao',
    detail: 'PSA records these crops in Albay. Their planting windows and field requirements still need review.',
    source: 'PSA Albay crop production',
    url: 'https://rsso05.psa.gov.ph/content/2025-crops-production-vegetable-root-crops-non-food-and-industrial-crops-albay'
  }
];
