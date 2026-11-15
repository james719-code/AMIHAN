import { cropArtwork } from '../data/crop-artwork';
import type { Crop } from '../data/crops';

export function CropArt({ crop }: { crop: Crop }) {
  const { url, column, row } = cropArtwork(crop.artwork);
  return <span className="crop-art" aria-hidden="true" style={{
    backgroundImage: `url(${url})`,
    backgroundPosition: `${column / 3 * 100}% ${row / 3 * 100}%`
  }} />;
}
