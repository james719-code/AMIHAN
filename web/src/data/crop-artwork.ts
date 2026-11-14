export const cropArtworkCredit = 'Crop illustrations are AI-generated.';

export function cropArtwork(artwork: number) {
  const cell = artwork % 16;
  return {
    url: `${import.meta.env.BASE_URL}crops/botanical-${Math.floor(artwork / 16) + 1}.jpg`,
    column: cell % 4,
    row: Math.floor(cell / 4)
  };
}
