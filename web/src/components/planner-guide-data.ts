import type { Rotation } from '../data/planting-plan';

export type Guide = {
  location: string;
  date: string;
  fields: [string, string][];
  rainfall: (number | null)[];
  rainSource: string;
  rainDays?: { wetDays: number; totalDays: number; thresholdMm: number };
  moisture?: { value: number; year: number };
  watering?: { heading: string; action: string; detail: string; cropNote?: string; source: string };
  rotations: { rotation: Rotation; status: string }[];
  excluded: Rotation[];
};

export function shareMissingFieldDetails(rotations: Guide['rotations']) {
  if (rotations.length !== 3 || rotations.some(({ rotation }) => rotation.status !== 'insufficient')) return false;
  const missingDetails = rotations.map(({ rotation }) => {
    const missing = rotation.findings.filter(({ status }) => status === 'insufficient');
    // Climate and calendar gaps must keep their individual status labels.
    if (!missing.length || missing.some(({ fieldInput }) => !fieldInput)) return null;
    return [...new Set(missing.map(({ fieldInput, message }) => JSON.stringify([fieldInput, message])))].sort().join('\n');
  });
  return missingDetails[0] !== null && missingDetails.every((details) => details === missingDetails[0]);
}
