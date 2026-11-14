import geography from './bicol-map.json';
import records from './places.json';
import elevations from './place-elevations.json';
import municipalities from './municipalities.json';

type PlaceKind = 'City' | 'Municipality' | 'Volcano';

export type MapPlace = {
  id: string;
  name: string;
  kind: PlaceKind;
  provinceCode: string;
  coordinates: number[];
  climateSite?: boolean;
  population?: number;
  summitMeters?: number;
  volcanoNumber?: number;
  elevationMeters: number | null;
  geonamesId?: string;
  coordinateUrl?: string;
  psgc?: string;
};

export const places: MapPlace[] = [
  ...records.filter(({ kind }) => kind !== 'Municipality').map((place) => ({
    ...place,
    kind: place.kind as PlaceKind,
    elevationMeters: elevations[place.id as keyof typeof elevations] ?? null
  })),
  ...municipalities.map((place): MapPlace => ({
    ...place,
    kind: 'Municipality',
    climateSite: records.some((record) => record.id === place.id && record.climateSite),
    elevationMeters: elevations[place.id as keyof typeof elevations] ?? null
  }))
];

export const waterLabels = [
  { name: 'Philippine Sea', coordinates: [124.68, 14.05], maxSpan: Infinity },
  { name: 'Sibuyan Sea', coordinates: [122.61, 12.27], maxSpan: Infinity },
  { name: 'Visayan Sea', coordinates: [123.91, 11.59], maxSpan: Infinity },
  { name: 'Ragay Gulf', coordinates: [122.74, 13.46], maxSpan: Infinity },
  { name: 'Lagonoy Gulf', coordinates: [124.04, 13.74], maxSpan: Infinity },
  { name: 'San Miguel Bay', coordinates: [123.1605, 13.9847], maxSpan: Infinity },
  { name: 'Albay Gulf', coordinates: [123.93, 13.13], maxSpan: 285 },
  { name: 'Burias Pass', coordinates: [123.355, 12.88583], maxSpan: 285 },
  { name: 'Ticao Pass', coordinates: [123.75, 12.63], maxSpan: 220 },
  { name: 'Sorsogon Bay', coordinates: [123.96, 12.9], maxSpan: 115 },
  { name: 'San Bernardino Strait', coordinates: [124.22, 12.52], maxSpan: 155 }
];

export const coordinateSource = 'https://www.geonames.org/advanced-search.html?country=PH&q=Bicol';
export const citySource = 'https://psa.gov.ph/classification/psgc/cities/0500000000';
export const municipalitySource = 'https://psa.gov.ph/classification/psgc/municipalities/0500000000';
export const elevationSource = geography.attributionUrl;
