import type { DemoSite, Province } from '../types';

export const provinces: Province[] = [
  { code: '0500500000', name: 'Albay' },
  { code: '0501600000', name: 'Camarines Norte' },
  { code: '0501700000', name: 'Camarines Sur' },
  { code: '0502000000', name: 'Catanduanes' },
  { code: '0504100000', name: 'Masbate' },
  { code: '0506200000', name: 'Sorsogon' }
];

export const demoSites: DemoSite[] = [
  { id: 'albay-01', name: 'Legazpi reference point', provinceCode: '0500500000', provinceName: 'Albay', coordinates: [123.7364, 13.1391], rationale: 'Named provincial capital reference point for the starter demo; not a station observation.' },
  { id: 'camarines-norte-01', name: 'Daet reference point', provinceCode: '0501600000', provinceName: 'Camarines Norte', coordinates: [122.9553, 14.1122], rationale: 'Named provincial capital reference point for the starter demo; not a station observation.' },
  { id: 'camarines-sur-01', name: 'Naga reference point', provinceCode: '0501700000', provinceName: 'Camarines Sur', coordinates: [123.1814, 13.6218], rationale: 'Named city reference point for the starter demo; not a station observation.' },
  { id: 'catanduanes-01', name: 'Virac reference point', provinceCode: '0502000000', provinceName: 'Catanduanes', coordinates: [124.2422, 13.5845], rationale: 'Named provincial capital reference point for the starter demo; not a station observation.' },
  { id: 'masbate-01', name: 'Masbate City reference point', provinceCode: '0504100000', provinceName: 'Masbate', coordinates: [123.4086, 12.3699], rationale: 'Named provincial capital reference point for the starter demo; not a station observation.' },
  { id: 'sorsogon-01', name: 'Sorsogon City reference point', provinceCode: '0506200000', provinceName: 'Sorsogon', coordinates: [124.0055, 12.9741], rationale: 'Named provincial capital reference point for the starter demo; not a station observation.' }
];
