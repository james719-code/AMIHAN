const bicolMungbean = {
  label: 'DA Region V trials · DOST–PCAARRD',
  url: 'https://www.pcaarrd.dost.gov.ph/index.php/quick-information-dispatch-qid-articles/wise-farming-options-enhance-bicol-region-s-mungbean-production'
};
const mungbeanGuide = {
  label: 'DA mungbean production guide',
  url: 'https://hvcdp.da.gov.ph/wp-content/uploads/2022/05/Mungbean-Production-Guide.pdf'
};

export const rotationGuides = [
  {
    id: 'rice-mungbean',
    previous: 'rice',
    crops: ['Rice', 'Mungbean'],
    placeIds: ['0501726000'],
    location: 'Pamplona, Camarines Sur',
    detail: 'DA Region V tested short-duration mungbean after rainfed rice.',
    fieldCheck: 'Check that the paddy has drained after harvest and that there is enough soil moisture for establishment.',
    sources: [bicolMungbean, mungbeanGuide]
  },
  {
    id: 'corn-mungbean',
    previous: 'corn',
    crops: ['Corn', 'Mungbean'],
    placeIds: ['0504101000', '0504105000'],
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

export type RotationGuide = typeof rotationGuides[number];

export function findRotationGuide(previous: string, next: string) {
  return rotationGuides.find(({ crops }) => crops.length === 2 && crops[0] === previous && crops[1] === next);
}
