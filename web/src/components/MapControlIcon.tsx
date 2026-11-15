export const mapControlIconPaths = {
  info: 'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  legend: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  chevron: 'm6 9 6 6 6-6',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-4m-1-12a4 4 0 0 1 0 8',
  planner: 'M12 21v-9m0 3C5 15 3 11 3 6c6 0 9 3 9 9zm0-3c0-6 3-9 9-9 0 6-3 9-9 9z',
  book: 'M12 6a7 7 0 0 0-5-2H3v15h4a7 7 0 0 1 5 2 7 7 0 0 1 5-2h4V4h-4a7 7 0 0 0-5 2zm0 0v15',
  readings: 'M4 3v17h17M8 15l4-5 4 3 5-7',
  rain: 'M8 3c0 4-5 7-5 11a5 5 0 0 0 10 0c0-4-5-7-5-11M17 10l-2 4m6-1-2 4m-3 1-2 3',
  temperature: 'M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0M12 8v10m6-12h3m-3 4h2',
  humidity: 'M12 3C10 7 5 11 5 16a7 7 0 0 0 14 0c0-5-5-9-7-13M9 18l6-6M9 12h.01M15 18h.01',
  calendar: 'M4 5h16v16H4zM4 10h16M8 3v4m8-4v4',
  location: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  center: 'M12 3v4m0 10v4M3 12h4m10 0h4M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0',
  clear: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  play: 'M7 4l14 8-14 8V4',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  zoomIn: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6M7 10h6m-3-3v6',
  zoomOut: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6M7 10h6',
  settings: 'M9 2h6l.5 2.5 2 1.2 2.4-.8 3 5.2-1.9 1.7v.4l1.9 1.7-3 5.2-2.4-.8-2 1.2L15 22H9l-.5-2.5-2-1.2-2.4.8-3-5.2L3 12.2v-.4L1.1 10.1l3-5.2 2.4.8 2-1.2L9 2M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  tools: 'M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M10 17v4',
  expand: 'M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5',
  collapse: 'M3 8h5V3M21 8h-5V3M16 21v-5h5M8 21v-5H3',
  field: 'M4 9V5a1 1 0 0 1 1-1h4m6 0h4a1 1 0 0 1 1 1v4m0 6v4a1 1 0 0 1-1 1h-4m-6 0H5a1 1 0 0 1-1-1v-4M8 8h8v8H8zM8 12h8M12 8v8',
  climate: 'M6 15a4 4 0 0 1-.4-8 6 6 0 0 1 11.6 0A4 4 0 0 1 18 15M8 17l-1 3m6-3-1 3m6-3-1 3',
  north: 'M12 3 18 21l-6-5-6 5L12 3zm0 0v13',
  plus: 'M5 12h14M12 5v14',
  minus: 'M5 12h14',
  reset: 'M4 10a8 8 0 1 1 2 8M4 4v6h6',
  flat: 'M3 7h18v10H3zM7 11h10',
  terrain: 'M12 3l9 5v9l-9 5-9-5V8l9-5M3 8l9 5 9-5M12 13v9',
  hillshade: 'M3 19l7-12 7 12H3zm11-5 3-5 5 10h-5M8 11l2 2 2-2M4 4h.01',
  roads: 'M8 3 5 21M16 3l3 18M12 3v3m0 4v4m0 4v3',
};

export function MapControlIcon({ name }: { name: keyof typeof mapControlIconPaths }) {
  return <svg className="map-control-icon" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false"><path d={mapControlIconPaths[name]} /></svg>;
}
