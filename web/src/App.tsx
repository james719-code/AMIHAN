import { lazy, Suspense, useCallback, useEffect, useState, type MouseEvent } from 'react';
import { TownSelect } from './components/TownSelect';
import { WorkspaceMenu, type WorkspaceView } from './components/WorkspaceMenu';
import type { FieldSelection } from './components/field-terrain';
import { fieldCoordinates } from './data/field-location';
import { loadPlots, newPlot, savePlots, type FieldPlot } from './data/field-plots';
import { climateSiteFor } from './data/historical-climate';
import { farmingPlaces, places, type MapPlace } from './data/places';
import { mapPath, overviewPath, plannerPath } from './workspace-routes';

const MapWorkspace = lazy(() => import('./components/MapWorkspace').then(({ MapWorkspace }) => ({ default: MapWorkspace })));
const ClimateHistory = lazy(() => import('./components/ClimateHistory').then(({ ClimateHistory }) => ({ default: ClimateHistory })));
const RotationPlanner = lazy(() => import('./components/RotationPlanner').then(({ RotationPlanner }) => ({ default: RotationPlanner })));
const Overview = lazy(async () => {
  await import('./landing.css');
  const { LandingPage } = await import('./components/LandingPage');
  return { default: LandingPage };
});

const home = import.meta.env.BASE_URL;
const workspaceLinks = [
  { view: 'overview', label: 'Overview', href: overviewPath },
  { view: 'planner', label: 'Crop Planner', href: plannerPath },
  { view: 'map', label: 'Field Map', href: mapPath }
] as const;
const emptyField: FieldSelection = { start: null, profile: null };
const initialUrl = window.location.href;

function getRoute(url: URL) {
  const panel = url.searchParams.get('panel');
  const place = url.searchParams.get('place');
  const path = url.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '');
  const plannerAnchors = /^#(?:field-setup|crop-options|soil-conditions|watering|crop-resources|planner-location|previous-crop|previous-harvest|water-source|field-drainage|establishment-moisture|next-rice-planting|planting-date)$/;
  const legacyPlanner = (Boolean(place) && url.hash !== '#sources') || plannerAnchors.test(url.hash);
  const view: WorkspaceView = path === `${home}overview`
    ? 'overview'
    : panel === 'planner' ? 'planner'
    : panel === 'readings' ? 'readings'
    : path === mapPath.slice(0, -1) ? 'map'
    : legacyPlanner ? 'planner' : 'overview';
  return { view, placeId: places.find(({ id }) => id === place)?.id ?? '', hash: url.hash, url: url.href };
}

function App() {
  const [route, setRoute] = useState(() => getRoute(new URL(window.location.href)));
  const [plannerOpened, setPlannerOpened] = useState(route.view === 'planner');
  const [fieldPlots, setFieldPlots] = useState(() => loadPlots(route.view === 'planner'
    ? farmingPlaces.find(({ id }) => id === route.placeId)?.id ?? '' : ''));
  const [plotsSaved, setPlotsSaved] = useState(true);
  const [overviewTownId, setOverviewTownId] = useState<string>();
  const [readingTownId, setReadingTownId] = useState<string | undefined>(() => route.view === 'readings'
    ? farmingPlaces.find(({ id }) => id === route.placeId)?.id
    : undefined);
  const [mapPlaceId, setMapPlaceId] = useState('');
  const [fieldSelection, setFieldSelection] = useState<FieldSelection>(emptyField);
  const plot = fieldPlots.plots.find(({ id }) => id === fieldPlots.activeId) ?? fieldPlots.plots[0];
  const townId = plot.townId;
  const town = farmingPlaces.find(({ id }) => id === townId);
  const readingTown = farmingPlaces.find(({ id }) => id === (readingTownId ?? townId));
  const { view } = route;
  const pageTitle = view === 'readings' ? 'Climate archive' : workspaceLinks.find((link) => link.view === view)?.label;

  function updatePlot(changes: Partial<Omit<FieldPlot, 'id'>>) {
    setFieldPlots((current) => ({
      ...current, plots: current.plots.map((plot) => plot.id === current.activeId ? { ...plot, ...changes } : plot)
    }));
  }

  function clearPlannerPlace() {
    const url = new URL(window.location.href);
    if (url.searchParams.has('place') && getRoute(url).view === 'planner') {
      url.searchParams.set('panel', 'planner');
      url.searchParams.delete('place');
      window.history.replaceState(null, '', url);
    }
  }

  function selectTown(id: string) {
    updatePlot({ townId: id, pin: null, wateringSoil: '' });
    setReadingTownId(undefined);
  }

  function selectPlot(id: number) {
    clearPlannerPlace();
    setReadingTownId(undefined);
    setFieldPlots((current) => current.plots.some((plot) => plot.id === id) ? { ...current, activeId: id } : current);
  }

  function addPlot() {
    clearPlannerPlace();
    setReadingTownId(undefined);
    setFieldPlots((current) => {
      const id = Math.max(...current.plots.map((plot) => plot.id)) + 1;
      const active = current.plots.find((plot) => plot.id === current.activeId);
      return { activeId: id, plots: [...current.plots, newPlot(id, active?.townId)] };
    });
  }

  function removePlot() {
    clearPlannerPlace();
    setReadingTownId(undefined);
    setFieldPlots((current) => {
      if (current.plots.length === 1) return current;
      const index = current.plots.findIndex((plot) => plot.id === current.activeId);
      const plots = current.plots.filter((plot) => plot.id !== current.activeId);
      return { plots, activeId: plots[Math.min(index, plots.length - 1)].id };
    });
  }

  useEffect(() => { setPlotsSaved(savePlots(fieldPlots)); }, [fieldPlots]);

  const updateFieldSelection = useCallback((selection: FieldSelection) => {
    setFieldSelection(selection);
  }, []);

  const changeRoute = (url: URL) => {
    const next = getRoute(url);
    if (next.placeId) {
      if (next.view === 'map') setMapPlaceId(next.placeId);
      if (farmingPlaces.some(({ id }) => id === next.placeId)) {
        if (next.view === 'planner') selectTown(next.placeId);
        if (next.view === 'readings') setReadingTownId(next.placeId);
      }
    }
    if (next.view === 'planner') setPlannerOpened(true);
    setRoute(next);
  };

  function navigate(href: string) {
    const url = new URL(href, window.location.href);
    if (url.href === window.location.href) return;
    window.history.pushState(null, '', url);
    changeRoute(url);
  }

  useEffect(() => {
    const onPopState = () => changeRoute(new URL(window.location.href));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.title = `${pageTitle} · AMIHAN`;
    if (!route.hash) {
      window.scrollTo(0, 0);
      if (document.activeElement === document.body && route.url !== initialUrl) {
        document.getElementById('main-content')?.focus({ preventScroll: true });
      }
    }
  }, [route.url, route.hash, pageTitle]);

  function followAppLink(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-app-link]');
    if (!link) return;
    event.preventDefault();
    navigate(link.href);
    if (link.closest('.app-header')) document.getElementById('main-content')?.focus({ preventScroll: true });
  }

  function openPlanner(place: MapPlace) {
    navigate(`${plannerPath}&place=${encodeURIComponent(place.id)}`);
  }

  return (
    <div className={view === 'map' ? 'app-layout map-layout' : 'app-layout'} onClick={followAppLink}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header">
        <div className="app-header-inner">
          <a className="app-brand" href={overviewPath} aria-label="AMIHAN" data-app-link>
            <picture>
              <source media="(max-width: 445px)" srcSet={`${home}amihan-logo-light.svg`} width={444} height={443} />
              <img src={`${home}amihan-full-light.svg`} alt="" width={1670} height={443} />
            </picture>
          </a>
          <WorkspaceMenu active={view} links={workspaceLinks} />
        </div>
      </header>

      <main id="main-content" className={`app-main ${view}-page`} tabIndex={-1} aria-label={pageTitle}>
        {plannerOpened && <div className="planner-width planner-content" hidden={view !== 'planner'}>
          <Suspense fallback={<p role="status">Loading crop planner…</p>}>
            <RotationPlanner town={town} plot={plot} plots={fieldPlots.plots} plotsSaved={plotsSaved}
              onUpdatePlot={updatePlot} onSelectPlot={selectPlot} onAddPlot={addPlot} onRemovePlot={removePlot}
              onSelectTown={(id) => { clearPlannerPlace(); selectTown(id); }}
              onUseTown={() => updatePlot({ pin: null, wateringSoil: '' })} />
          </Suspense>
        </div>}

        {view === 'readings' && <div className="planner-width">
          <header className="planner-title">
            <h1>Climate archive</h1>
            <p>Compare daily weather, monthly climate, and regional rainfall across Bicol.</p>
          </header>
          <div className="readings-location field-inputs">
            <div>
              <label htmlFor="readings-town">Town or city</label>
              <TownSelect id="readings-town" value={readingTown?.id ?? ''} onChange={setReadingTownId} />
            </div>
          </div>
          {readingTown
            ? <Suspense fallback={<p role="status">Loading climate readings…</p>}>
                <ClimateHistory site={climateSiteFor(readingTown)} place={readingTown} />
              </Suspense>
            : <p className="readings-empty">Choose a town or city to see its climate readings.</p>}
        </div>}

        {view === 'map' && <Suspense fallback={<p className="page-loading" role="status">Loading Field Map…</p>}>
          <MapWorkspace selectedPlaceId={mapPlaceId || route.placeId || townId} onPlaceSelect={setMapPlaceId} fieldSelection={fieldSelection}
            onFieldSelection={updateFieldSelection} onUseField={() => {
              if (!fieldSelection.start) return;
              updatePlot({ pin: fieldCoordinates(fieldSelection.start), wateringSoil: '' });
              navigate(plannerPath);
            }} onPlanner={openPlanner} />
        </Suspense>}

        {view === 'overview' && <Suspense fallback={<p className="page-loading" role="status">Loading Overview…</p>}>
          <Overview hash={route.hash} townId={overviewTownId ?? townId} onSelectTown={setOverviewTownId} />
        </Suspense>}
      </main>
    </div>
  );
}

export default App;
