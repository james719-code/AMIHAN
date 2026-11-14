const bicolMungbean = {
  label: 'DA Region V trials · DOST–PCAARRD',
  url: 'https://www.pcaarrd.dost.gov.ph/index.php/quick-information-dispatch-qid-articles/wise-farming-options-enhance-bicol-region-s-mungbean-production'
};
const mungbeanGuide = {
  label: 'DA–BPI mungbean guide',
  url: 'https://library.buplant.da.gov.ph/images/1640929884The%20Mungbean%20Plant.pdf'
};

export const previousCrops = [
  { id: '', label: 'Unknown' },
  { id: 'rice', label: 'Rice (palay)' },
  { id: 'corn', label: 'Corn (mais)' },
  { id: 'legume', label: 'Mungbean, peanut, or other legume' },
  { id: 'other', label: 'Other crop or fallow' }
] as const;
export type PreviousCrop = typeof previousCrops[number]['id'];

export const rotationGuides = [
  {
    id: 'rice-mungbean',
    previous: 'rice',
    crops: ['Rice', 'Mungbean'],
    location: 'Pamplona, Camarines Sur',
    detail: 'DA Region V tested short-duration mungbean after rainfed rice.',
    fieldCheck: 'Check that the paddy has drained after harvest and that there is enough soil moisture for establishment.',
    sources: [bicolMungbean, mungbeanGuide]
  },
  {
    id: 'corn-mungbean',
    previous: 'corn',
    crops: ['Corn', 'Mungbean'],
    location: 'Aroroy and Cataingan, Masbate',
    detail: 'DA Region V evaluated mungbean in corn-based rotations in both municipalities.',
    fieldCheck: 'Check drainage and soil moisture after corn harvest. Ask the local agriculture office about varieties and timing.',
    sources: [bicolMungbean, mungbeanGuide]
  },
  {
    id: 'rice-rice-peanut',
    previous: 'rice',
    crops: ['Rice', 'Rice', 'Peanut'],
    location: 'PhilRice Bicol research station',
    detail: 'PhilRice Bicol studied peanut as the third crop in a rice-based system.',
    fieldCheck: 'Check for loose, well-drained soil and enough time to harvest peanut before the next rice crop.',
    sources: [
      { label: 'PhilRice Bicol field research', url: 'https://www.philrice.gov.ph/wp-content/uploads/2016/04/Bicol.pdf' },
      { label: 'DA–BPI peanut guide', url: 'https://library.buplant.da.gov.ph/images/1641970554PEANUT%20production%20guide.pdf' }
    ]
  }
] as const;

export const planningSources = [
  { id: 'soil', name: 'Soil', provider: 'DA–BSWM', description: 'Soil series or soil tests for the selected area.', url: 'https://www.bswm.da.gov.ph/download/philippine-soil-series/' },
  { id: 'rain', name: 'Rainfall', provider: 'NASA GPM IMERG', description: 'Gridded precipitation for historical rainfall replay.', url: 'https://gpm.nasa.gov/resources/documents/imerg-v07-technical-documentation' },
  { id: 'climate', name: 'Climate', provider: 'NASA POWER', description: 'Daily temperature, humidity, and solar radiation.', url: 'https://power.larc.nasa.gov/docs/services/api/temporal/daily/' }
] as const;

export const cropResearch = [
  { title: 'Rice and corn', detail: 'PSA tracks palay and corn production across Bicol.', source: 'PSA regional crop production', url: 'https://psa.gov.ph/system/files/aad/Full%20Report%2C%202023%20to%202025%20Regional%20Value%20of%20Production%20in%20Agriculture%20and%20Fisheries.pdf' },
  { title: 'Peanut', detail: 'PhilRice Bicol trialed a rice → rice → peanut sequence at its research station.', source: 'PhilRice Bicol field research', url: 'https://www.philrice.gov.ph/wp-content/uploads/2016/04/Bicol.pdf' },
  { title: 'Sweet potato, squash, and sitao', detail: 'PSA records these crops in Albay. Their planting windows and field requirements still need review.', source: 'PSA Albay crop production', url: 'https://rsso05.psa.gov.ph/content/2025-crops-production-vegetable-root-crops-non-food-and-industrial-crops-albay' }
];
