"""Extract Bicol soil and station reference data from the recorded source files."""

import json
import re
from calendar import month_abbr
from contextlib import ExitStack
from pathlib import Path
from zipfile import ZipFile

import rasterio
import shapefile
from pypdf import PdfReader
from pyproj import CRS, Transformer
from shapely import Point, STRtree, make_valid
from shapely.geometry import shape


DATA = Path(__file__).resolve().parent
RAW = DATA / 'raw' / 'field-planning'
OUTPUT = DATA / 'processed' / 'field-planning'
WEB = DATA.parent / 'web' / 'src' / 'data'
STATIONS = ('daet', 'legazpi', 'masbate', 'virac')
MONTHS = [name.upper() for name in month_abbr[1:]]
PROPERTIES = {
    'phh2o': ('predicted_ph', 10, 14),
    'soc': ('predicted_organic_carbon_g_kg', 10, 1000),
    'sand': ('predicted_sand_pct', 10, 100),
    'silt': ('predicted_silt_pct', 10, 100),
    'clay': ('predicted_clay_pct', 10, 100),
}


def station_normals():
    rows = []
    for station in STATIONS:
        filename = f'pagasa-normals-1991-2020-{station}.pdf'
        text = PdfReader(RAW / filename).pages[0].extract_text(extraction_mode='layout')
        if not re.search(r'PERIOD:\s*1991\s*-\s*2020', text):
            raise ValueError(f'Unexpected baseline period in {filename}')
        coordinates = {}
        for axis, directions in [('latitude', 'NS'), ('longitude', 'EW')]:
            match = re.search(rf'{axis.upper()}:\s*(\d+)[°o](\d+)\x27([\d.]+)[\x27"]+([{directions}])', text)
            if not match:
                raise ValueError(f'Missing station {axis} in {filename}')
            degrees, minutes, seconds, direction = match.groups()
            sign = -1 if direction in 'SW' else 1
            coordinates[axis] = round(sign * (int(degrees) + int(minutes) / 60 + float(seconds) / 3600), 6)
        table = {}
        for line in text.splitlines():
            fields = line.split()
            if not fields or fields[0] not in MONTHS:
                continue
            if len(fields) != 17 or fields[0] in table:
                raise ValueError(f'Unexpected monthly row in {filename}: {line}')
            table[fields[0]] = fields
        if list(table) != MONTHS:
            raise ValueError(f'Incomplete month coverage in {filename}')
        for month, fields in enumerate(table.values(), 1):
            rainfall, rainy_days, maximum, minimum, mean = map(float, fields[1:6])
            humidity = int(fields[10])
            if rainfall < 0 or not 0 <= rainy_days <= 31 or not minimum <= mean <= maximum or not 0 <= humidity <= 100:
                raise ValueError(f'Invalid station values in {filename} for month {month}')
            rows.append(dict(
                station=station, start_year=1991, end_year=2020, month=month, rainfall_mm=rainfall,
                rainy_days=int(rainy_days), max_temp_c=maximum, min_temp_c=minimum, mean_temp_c=mean,
                relative_humidity_pct=humidity, vapor_pressure_hpa=float(fields[9]), source_file=filename, **coordinates,
            ))
    return rows


def mapped_places():
    cities = json.loads((WEB / 'places.json').read_text(encoding='utf-8'))
    towns = json.loads((WEB / 'municipalities.json').read_text(encoding='utf-8'))
    places = [place for place in cities if place['kind'] == 'City'] + towns
    if len({place['id'] for place in places}) != len(places):
        raise ValueError('Duplicate place IDs')
    return places


def soil_units(points):
    archive = RAW / 'bswm-philippine-soil-series.zip'
    with ZipFile(archive) as files:
        projection = next(name for name in files.namelist() if name.endswith('.prj'))
        source_crs = CRS.from_wkt(files.read(projection).decode())
        if source_crs.to_epsg() != 4253:
            raise ValueError('Expected BSWM polygons in Luzon 1911 (EPSG:4253)')
    projection = Transformer.from_pipeline('urn:ogc:def:coordinateOperation:EPSG::1161')
    points_in_soil_crs = [
        Point(lon, lat)
        for lat, lon in (projection.transform(lat, lon, direction='INVERSE', errcheck=True) for lon, lat in points)
    ]
    with shapefile.Reader(str(archive)) as layer:
        features = list(layer.iterShapeRecords())
        geometries = [make_valid(shape(item.shape.__geo_interface__)) for item in features]
    tree = STRtree(geometries)
    for point in points_in_soil_crs:
        matches = [features[index].record.as_dict() for index in tree.query(point, predicate='covered_by')]
        yield (
            ' | '.join(sorted({row['SoilSeries'].strip() for row in matches if row['SoilSeries'].strip()})),
            ' | '.join(sorted({row['SOILDESC'].strip() for row in matches if row['SOILDESC'].strip()})),
        )


def soil_predictions(points):
    with ExitStack() as stack:
        rasters = {name: stack.enter_context(rasterio.open(RAW / f'soilgrids-{name}_5-15cm_mean.tif'))
                   for name in PROPERTIES}
        ph = rasters['phh2o']
        project = Transformer.from_crs('EPSG:4326', ph.crs.to_wkt(), always_xy=True)
        locations = [project.transform(*point, errcheck=True) for point in points]
        columns = {}
        for property_id, (field, divisor, limit) in PROPERTIES.items():
            raster = rasters[property_id]
            if (raster.crs, raster.transform, raster.shape) != (ph.crs, ph.transform, ph.shape):
                raise ValueError(f'Misaligned {property_id} raster')
            columns[field] = []
            for (x, y), sample in zip(locations, raster.sample(locations, masked=True), strict=True):
                if not (raster.bounds.left <= x < raster.bounds.right and raster.bounds.bottom < y <= raster.bounds.top):
                    raise ValueError(f'Point outside downloaded {property_id} coverage')
                if sample.mask.any() or (property_id == 'phh2o' and sample[0] == 0):
                    columns[field].append(None)
                    continue
                value = sample[0] / divisor
                if not 0 <= value <= limit:
                    raise ValueError(f'Invalid {property_id} prediction: {value}')
                columns[field].append(value)
    # The WCS export uses zeros for masked pixels without a NoData tag.
    for index, ph_value in enumerate(columns['predicted_ph']):
        if ph_value is None:
            for values in columns.values():
                values[index] = None
    return columns


def soil_rows():
    places = mapped_places()
    points = [place['coordinates'] for place in places]
    units = list(soil_units(points))
    predictions = soil_predictions(points)
    return [dict(
        place_id=place['id'], place=place['name'], province_code=place['provinceCode'],
        longitude=place['coordinates'][0], latitude=place['coordinates'][1],
        bswm_soil_series=units[index][0], bswm_soil_description=units[index][1],
        depth_top_cm=5, depth_bottom_cm=15,
        **{field: values[index] for field, values in predictions.items()},
    ) for index, place in enumerate(places)]


if __name__ == '__main__':
    stations = station_normals()
    soils = soil_rows()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / 'field-references.json').write_text(
        json.dumps({'stations': stations, 'soils': soils}, indent=2) + '\n', encoding='utf-8'
    )
    print(f'Prepared {len(stations)} PAGASA station-months and {len(soils)} Bicol soil records.')
    print(f'BSWM mapping units present for {sum(bool(row["bswm_soil_series"] or row["bswm_soil_description"]) for row in soils)} places.')
    print(f'All five SoilGrids predictions present for {sum(all(row[field] is not None for field, _, _ in PROPERTIES.values()) for row in soils)} places.')
