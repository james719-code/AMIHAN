import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { DemoSite } from '../types';

type MapMode = '2d' | '3d';

type MapPanelProps = {
  sites: DemoSite[];
  selectedSiteId: string;
  selectedProvinceCode: string;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
  onSiteSelect: (siteId: string) => void;
};

const REGION_BOUNDS: [[number, number], [number, number]] = [
  [121.5, 11.5],
  [125.1, 15.1]
];
const TERRAIN_URL = import.meta.env.VITE_TERRAIN_TILEJSON_URL || 'https://tiles.mapterhorn.com/tilejson.json';

const style = {
  version: 8 as const,
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster' as const,
      source: 'osm'
    }
  ]
};

export function MapPanel({
  sites,
  selectedSiteId,
  selectedProvinceCode,
  mapMode,
  onMapModeChange,
  onSiteSelect
}: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);
  const [terrainState, setTerrainState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [hillshadeEnabled, setHillshadeEnabled] = useState(true);

  const removeTerrain = () => {
    const map = mapRef.current;
    if (!map || !map.getStyle()) return;
    if (map.getLayer('hillshade')) map.removeLayer('hillshade');
    if (map.getSource('terrain')) map.removeSource('terrain');
    map.setTerrain(null);
  };

  const enableTerrain = () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    setTerrainState('loading');
    try {
      if (!map.getSource('terrain')) {
        map.addSource('terrain', {
          type: 'raster-dem',
          url: TERRAIN_URL,
          tileSize: 256,
          maxzoom: 14
        });
      }
      if (!map.getLayer('hillshade')) {
        map.addLayer({
          id: 'hillshade',
          type: 'hillshade',
          source: 'terrain',
          layout: { visibility: hillshadeEnabled ? 'visible' : 'none' },
          paint: {
            'hillshade-shadow-color': '#354a40',
            'hillshade-highlight-color': '#f7f4df',
            'hillshade-accent-color': '#9a8e74',
            'hillshade-exaggeration': 0.35
          }
        });
      }
      map.setTerrain({ source: 'terrain', exaggeration: 1 });
      map.easeTo({ pitch: 55, duration: 650 });
      setTerrainState('ready');
    } catch {
      removeTerrain();
      setTerrainState('error');
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const webgl2 = document.createElement('canvas').getContext('webgl2');
    if (!webgl2) {
      setWebglSupported(false);
      return;
    }

    maplibregl.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [123.3, 13.3],
      zoom: 6.2,
      pitch: 0,
      bearing: 0,
      maxBounds: [[119.5, 9.5], [127.5, 17.5]]
    });
    mapRef.current = map;

    map.on('load', () => {
      map.fitBounds(REGION_BOUNDS, { padding: 48, duration: 0 });
      setMapReady(true);
    });
    map.on('error', (event: unknown) => {
      const sourceId = (event as unknown as { sourceId?: string }).sourceId;
      if (sourceId === 'terrain') {
        map.setTerrain(null);
        setTerrainState('error');
      }
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = sites.map((site) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = `site-marker${site.id === selectedSiteId ? ' is-selected' : ''}`;
      element.setAttribute('aria-label', `Select ${site.name}, ${site.provinceName}`);
      element.title = `${site.name} · ${site.provinceName}`;
      element.addEventListener('click', () => onSiteSelect(site.id));
      return new maplibregl.Marker({ element, anchor: 'center' })
        .setLngLat(site.coordinates)
        .addTo(map);
    });
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [mapReady, onSiteSelect, selectedSiteId, sites]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const selectedSite = sites.find((site) => site.id === selectedSiteId);
    const selectedProvinceSite = sites.find((site) => site.provinceCode === selectedProvinceCode);
    const target = selectedSite ?? selectedProvinceSite;
    if (target) {
      map.flyTo({ center: target.coordinates, zoom: 8.2, duration: 800 });
    }
  }, [mapReady, selectedProvinceCode, selectedSiteId, sites]);

  useEffect(() => {
    if (!mapReady) return;
    if (mapMode === '3d') {
      enableTerrain();
    } else {
      removeTerrain();
      mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    }
  }, [mapMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('hillshade')) return;
    map.setLayoutProperty('hillshade', 'visibility', hillshadeEnabled ? 'visible' : 'none');
  }, [hillshadeEnabled]);

  const resetView = () => {
    mapRef.current?.fitBounds(REGION_BOUNDS, { padding: 48, duration: 700 });
    onMapModeChange('2d');
  };

  if (!webglSupported) {
    return (
      <section className="map-card map-card-fallback" aria-label="Map unavailable">
        <div>
          <h2>Map unavailable on this device</h2>
          <p>You can still select a reference point and view its climate readings.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="map-card" aria-label="Bicol Region map">
      <div className="map-header">
        <h2>Bicol terrain map</h2>
        <button className="quiet-button" type="button" onClick={resetView}>Reset Bicol view</button>
      </div>
      <div className="map-viewport">
        <div ref={containerRef} className="map-container" />
        <div className="map-toolbar">
          <div className="segmented-control" role="group" aria-label="Map view">
            <button aria-pressed={mapMode === '2d'} type="button" onClick={() => onMapModeChange('2d')}>2D</button>
            <button aria-pressed={mapMode === '3d'} type="button" onClick={() => onMapModeChange('3d')}>3D terrain</button>
          </div>
          <label className="switch-label">
            <input
              type="checkbox"
              checked={hillshadeEnabled}
              onChange={(event) => setHillshadeEnabled(event.target.checked)}
            />
            Hillshade
          </label>
          {terrainState === 'error' && (
            <button className="retry-button" type="button" onClick={enableTerrain}>Retry terrain</button>
          )}
        </div>
      </div>
      <div className="map-legend" aria-label="Map legend">
        <span><i className="legend-dot" /> Reference point</span>
        <span><i className="legend-dot legend-dot-selected" /> Selected point</span>
        <span className="map-source">Elevation in meters · Mapterhorn</span>
      </div>
    </section>
  );
}
