"""Sample DOST–PAGASA's published climate map at Bicol locations and map pins."""

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from shapely import contains_xy, make_valid, union_all
from shapely.geometry import shape


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'data'
RAW = DATA / 'raw' / 'field-planning'
WEB = ROOT / 'web' / 'src' / 'data'
SOURCE = 'https://pubfiles.pagasa.dost.gov.ph/pagasaweb/files/climate/climate-final-3.jpg'
MAP_SHA256 = 'd3eaebbbeb45946e8b5c8ac6bd62ae125313f9d0a55f06506f70e1c8045e8c2e'
TYPES = ('I', 'II', 'III', 'IV')
PROVINCES = {'Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'}


def load_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def map_pixels(longitude, latitude):
    # Grid intersections read from the full-size 7268 × 10864 map, in pixels.
    # Register the map locally using 122°E and 124°E at 14°N and 12°N.
    x = (longitude - 122) / 2
    y = (14 - latitude) / 2
    return (
        np.rint(3739 + 988 * x - 11 * y + 7 * x * y).astype(int),
        np.rint(4612 + 7 * x + 1010 * y + 2 * x * y).astype(int),
    )


def color_masks(image):
    red, green, blue = np.asarray(image, dtype=np.int16).transpose(2, 0, 1)
    # Use the legend's four fills and ignore the pastel water, grid, labels and borders.
    return (
        (red > 125) & (red > 1.24 * green) & (red > 1.23 * blue),
        (red < 165) & (green - red >= 18) & (blue - green >= 15) & (blue < 235) & (green < 188),
        (red >= 140) & (green >= 155) & (red >= 0.7 * green) & (blue <= 0.76 * np.minimum(red, green)),
        (green >= 110) & (red <= 0.77 * green) & (blue <= 0.72 * green),
    )


def sample(masks, x, y):
    # Sample a disk about 3.5 km in radius. Strong fills of two types signal a boundary.
    offsets = np.arange(-16, 17)
    dy, dx = np.meshgrid(offsets, offsets, indexing='ij')
    disk = dx * dx + dy * dy <= 16 * 16
    rows, columns = y + dy[disk], x + dx[disk]
    counts = [np.count_nonzero(mask[rows, columns]) for mask in masks]
    if max(counts) < 70:
        return 0
    return sum(1 << index for index, count in enumerate(counts) if count >= max(60, 0.12 * max(counts)))


def main():
    source = RAW / 'pagasa-climate-map-1951-2010.jpg'
    if hashlib.sha256(source.read_bytes()).hexdigest() != MAP_SHA256:
        raise ValueError('PAGASA map changed. Recheck the grid intersections and legend colors.')
    geography = load_json(WEB / 'bicol-map.json')['detailBounds']
    step = 0.01
    west, north = geography['west'], geography['north']
    longitudes = west + np.arange(round((geography['east'] - west) / step) + 1) * step
    latitudes = north - np.arange(round((north - geography['south']) / step) + 1) * step
    longitude, latitude = np.meshgrid(longitudes, latitudes)
    x, y = map_pixels(longitude, latitude)
    left, top = int(x.min()) - 17, int(y.min()) - 17
    right, bottom = int(x.max()) + 18, int(y.max()) + 18
    with Image.open(source) as image:
        masks = color_masks(image.crop((left, top, right, bottom)).convert('RGB'))

    features = load_json(DATA / 'raw' / 'geoboundaries-phl-adm2.geojson')['features']
    bicol = union_all([make_valid(shape(feature['geometry'])) for feature in features
                       if feature['properties']['shapeName'] in PROVINCES])
    land = contains_xy(bicol, longitude, latitude)
    grid = np.zeros(x.shape, dtype=np.uint8)
    for row, col in zip(*np.where(land)):
        grid[row, col] = sample(masks, x[row, col] - left, y[row, col] - top)

    places = load_json(WEB / 'municipalities.json') + [place for place in load_json(WEB / 'places.json')
                                                       if place['kind'] == 'City']
    markers = {}
    for place in sorted(places, key=lambda place: place['id']):
        px, py = map_pixels(*place['coordinates'])
        code = sample(masks, px - left, py - top)
        markers[place['id']] = [climate_type for index, climate_type in enumerate(TYPES) if code & (1 << index)]

    release = {
        'source': SOURCE,
        'publisher': 'DOST–PAGASA',
        'baseline': '1951–2010',
        'sourceSha256': MAP_SHA256,
        'types': TYPES,
        'markers': markers,
        'grid': {'west': west, 'north': north, 'step': step,
                 'rows': [''.join(format(code, 'x') for code in row) for row in grid]},
    }
    (WEB / 'pagasa-climate-types.json').write_text(json.dumps(release, ensure_ascii=False, separators=(',', ':')) + '\n',
                                                 encoding='utf-8')
    print(f'{len(markers)} markers: {sum(len(types) == 1 for types in markers.values())} single type, '
          f'{sum(len(types) > 1 for types in markers.values())} boundary, {sum(not types for types in markers.values())} unclear')


if __name__ == '__main__':
    main()
