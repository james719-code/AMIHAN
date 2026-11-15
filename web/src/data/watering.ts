import type { Crop } from './crops';
import type { FieldPlot } from './field-plots';

const fao = { label: 'FAO irrigation guidance', url: 'https://www.fao.org/4/x0490e/x0490e0e.htm' };
const mungbean = { label: 'DA mungbean production guide', url: 'https://hvcdp.da.gov.ph/wp-content/uploads/2022/05/Mungbean-Production-Guide.pdf' };
const rice = { label: 'IRRI water management for irrigated rice', url: 'https://knowledgebank.irri.org/ewatermgt/courses/course1/resources/books/WaterCourse1.pdf' };
type WateringInputs = Pick<FieldPlot, 'water' | 'drainage' | 'wateringStage' | 'wateringSoil'>;
type WateringAction = 'check' | 'hold' | 'water';

export function wateringAdvice(crop: Crop, { water, drainage, wateringStage, wateringSoil }: WateringInputs) {
  if (crop.name === 'Rice (Palay)') {
    return {
      kind: 'check' as const,
      action: water === 'paddy' ? 'Check the paddy water level' : 'Confirm the rice water plan',
      detail: water === 'paddy'
        ? 'Check the water level in the field and follow the irrigation schedule for your variety and growth stage.'
        : 'Ask your local agriculture office about water management for your rice system and check whether irrigation is available.',
      cropNote: wateringStage === 'producing' ? 'Protect the crop from water stress around flowering.' : undefined,
      source: rice
    };
  }

  const cropNote = crop.name === 'Mungbean (Monggo)'
    ? 'Check moisture at germination, during early growth, and again at flowering and pod filling. Monggo is sensitive to standing water.'
    : undefined;
  const source = cropNote ? mungbean : fao;
  const result = (action: string, detail: string, kind: WateringAction = 'check') => ({ kind, action, detail, cropNote, source });

  if (wateringSoil === 'wet') return result('Hold off watering', 'Let the plot drain and check the soil again before adding water.', 'hold');
  if (wateringSoil === 'moist') return result('Recheck before watering', 'Check the moisture around the roots again after hot weather or rain.');
  if (!wateringSoil) return result('Check the soil around the roots', 'Check several spots in the plot and update the soil condition above.');
  if (wateringStage === 'harvest') return result('Check the crop’s harvest guidance', 'Water needs near harvest vary by crop and variety. Check the crop guide and local forecast before irrigating.');
  if (water === 'rainfed') return result('Check for rain or a backup water source',
    wateringStage === 'planting' ? 'If the soil stays dry and you have no backup water, wait for enough moisture to establish the crop.'
      : 'Check the farm forecast and ask your local agriculture office about options if the soil stays dry.');
  if (!water) return result('Confirm whether you can water this plot', 'Check the farm forecast and update Water source under Field conditions.');
  if (drainage === 'slow' || drainage === 'waterlogged') return result('Check drainage before watering',
    'Check for wet spots and standing water across the plot. Where roots are dry and water can drain, apply water slowly and stop if it pools.');
  if (!drainage) return result('Confirm that the plot drains', 'Check for standing water and update Drainage after rain under Field conditions.');
  return result('Water the dry root zone if rain is unlikely', 'Check the farm forecast, apply water slowly to the soil, and recheck moisture before watering again.', 'water');
}
