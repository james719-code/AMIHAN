import { farmingPlaces } from '../data/places';
import { provinces } from '../data/sites';

export function TownSelect({ id, value, onChange, required = false }: { id: string; value: string; onChange: (id: string) => void; required?: boolean }) {
  return (
    <select id={id} value={value} required={required} onChange={(event) => onChange(event.target.value)}>
      <option value="" disabled={required}>Choose a town or city</option>
      {provinces.map(({ code, name }) => (
        <optgroup key={code} label={name}>
          {farmingPlaces.filter(({ provinceCode }) => provinceCode === code).map(({ id, name: town }) =>
            <option key={id} value={id}>{town}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
