import { useEffect, useId, useRef, useState } from 'react';
import { farmingPlaces } from '../data/places';
import { provinces } from '../data/sites';
import { MapControlIcon } from './MapControlIcon';

const locations = farmingPlaces.map((place) => ({
  ...place,
  province: provinces.find(({ code }) => code === place.provinceCode)?.name ?? ''
}));
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function LocationSearch({ onSelect }: { onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [locating, setLocating] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = locations.filter(({ name, province }) => terms.every((term) => normalize(`${name} ${province}`).includes(term)))
    .sort((a, b) => Number(normalize(b.name).startsWith(normalize(query))) - Number(normalize(a.name).startsWith(normalize(query))))
    .slice(0, 10);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const [lon, lat] = [pos.coords.longitude, pos.coords.latitude];
        let closest = locations[0];
        let minDist = Infinity;
        for (const loc of locations) {
          const d = Math.hypot(loc.coordinates[0] - lon, loc.coordinates[1] - lat);
          if (d < minDist) {
            minDist = d;
            closest = loc;
          }
        }
        if (closest) select(closest.id);
      },
      () => {
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      setOpen(false);
      setActive(-1);
      if (document.activeElement === input.current) input.current?.blur();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  useEffect(() => {
    if (active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  const close = () => {
    input.current?.focus({ preventScroll: true });
    setOpen(false);
    setActive(-1);
  };
  const select = (id: string) => {
    onSelect(id);
    setQuery('');
    close();
  };

  return (
    <div ref={root} className="location-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setActive(-1);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}>
      <div className="location-search-panel">
        <div className="location-search-field">
          <SearchIcon />
          <input ref={input} type="search" role="combobox" aria-label="Search Bicol towns and cities"
            placeholder="Search a town or city…" autoComplete="off" spellCheck={false}
            aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            value={query} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true);
                setActive((current) => {
                  if (!matches.length) return -1;
                  if (event.key === 'ArrowDown') return (current + 1) % matches.length;
                  return current <= 0 ? matches.length - 1 : current - 1;
                });
              }
              if (event.key === 'Enter' && open && matches.length) {
                event.preventDefault();
                select(matches[active >= 0 ? active : 0].id);
              }
            }} />
          {(open || query) && <button type="button" className="location-search-close" aria-label={query ? 'Clear location search' : 'Close location search'}
            onClick={() => {
              if (!query) return close();
              setQuery('');
              setActive(-1);
              setOpen(true);
              input.current?.focus();
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
              strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>}
        </div>
        <div className="location-search-results" hidden={!open}>
          <p className="location-search-caption" role="status">{query.trim() ? matches.length ? 'Matching locations' : 'No matching towns or cities. Try another name or province.' : 'Find a town or city in Bicol'}</p>
          <ul id={listId} role="listbox" aria-label="Locations">
            {!query.trim() && typeof navigator !== 'undefined' && 'geolocation' in navigator && (
              <li role="option" aria-selected={false} className="location-search-gps-item"
                onPointerDown={(event) => event.preventDefault()} onClick={handleUseMyLocation}>
                <span><MapControlIcon name="location" /> Nearest town to my location</span>
                <small>{locating ? 'Locating via GPS…' : 'Uses device location'}</small>
              </li>
            )}
            {matches.map((place, index) => (
              <li key={place.id} id={`${listId}-${index}`} role="option" aria-selected={active === index}
                onPointerDown={(event) => event.preventDefault()} onClick={() => select(place.id)}>
                <span>{place.name}</span><small>{place.province} · {place.kind}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>;
}
