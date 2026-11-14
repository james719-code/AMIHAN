export const bicolVegetableGuide = 'https://hvcdp.da.gov.ph/wp-content/uploads/2022/05/Guiya-sa-Gulay-2021.pdf';
export const bicolRainfedCalendar = 'https://www.fao.org/4/ap562e/ap562e.pdf';
export const pagasaClimateTypes = 'https://pubfiles.pagasa.dost.gov.ph/pagasaweb/files/climate/climate-final-3.jpg';
export const pagasaFarmWeather = 'https://bagong.pagasa.dost.gov.ph/ten-day-regional-agri-weather';
export const bicolRiceCalendar = 'https://acap-bicol.github.io/cropping-calendar-v2/';

const bpi = 'https://buplant.da.gov.ph/production-guide/';
const hvcdp = 'https://hvcdp.da.gov.ph/wp-content/uploads/2022/05/';
const ati = 'https://ati2.da.gov.ph/ati-7/content/iec-list';
const mimaropa = 'https://mimaropa.da.gov.ph/media-resources/publication/high-value-crop';
const rootCrops = 'https://philrootcrops.vsu.edu.ph/feature/42-experiences/36-let-it-rain';

export type ClimateType = 'I' | 'II' | 'III' | 'IV';
export type Days = readonly [number, number];
type Milestone = 'Harvest' | 'First harvest' | 'First bearing' | 'First flowering';
export type Crop = {
  name: string;
  family: string;
  days: Days;
  milestone: Milestone;
  note: string;
  source: string;
  artwork: number;
  alternative?: string;
  calendar?: Partial<Record<ClimateType, readonly number[]>>;
  repeatPick?: boolean;
  longCycle?: boolean;
  timing?: string;
};

const allYear = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const regionalWindow = (months: readonly number[]) => ({ II: months, III: months, IV: months });
const crop = (name: string, family: string, days: Days, milestone: Milestone, note: string, source: string,
  options: Pick<Crop, 'calendar' | 'alternative' | 'repeatPick' | 'longCycle' | 'timing'> = {}) =>
  ({ name, family, days, milestone, note, source, ...options });

// In workbook order, which also matches the three botanical illustration sheets.
// The duration is a planning estimate. Notes identify relevant variety and harvest differences.
export const crops = [
  crop('Abaca', 'Banana family', [480, 730], 'First harvest',
    'A perennial fiber crop. Give it a sheltered, well-drained site and keep productive stools for later cuts.', hvcdp + 'Giya-sa-Pagpananum-ug-Abacca-V2.pdf', { longCycle: true }),
  crop('Coconut', 'Palm family', [1825, 2555], 'First bearing',
    'Tall coconut typically takes several years to bear. Variety and planting material affect the timeline.', 'https://www.pca.gov.ph/images/cocotech/PNS_BAFS_238_2018_Code_of_Good_Agricultural_Practices_for_Coconut.pdf',
    { longCycle: true, alternative: 'Dwarf types may start bearing around 1,095 days.' }),
  crop('Pili', 'Pili family', [1825, 2190], 'First bearing',
    'Bicol nut tree. Check propagation method and orchard layout when selecting planting stock.', 'https://www.pcaarrd.dost.gov.ph/index.php/quick-information-dispatch-qid-articles/s-t-interventions-aid-pili-industry-in-the-bicol-region',
    { longCycle: true, alternative: 'Clonal trees may start bearing in about 1,095–1,460 days.' }),
  crop('Banana', 'Banana family', [180, 240], 'First harvest',
    'Workbook estimate for Cavendish. Timing varies with planting stock and variety. Use clean planting material.', 'https://ispweb.pcaarrd.dost.gov.ph/isp-commodities/banana/', { longCycle: true }),
  crop('Papaya', 'Papaya family', [210, 240], 'First harvest',
    'DA–BPI puts first picking around 7–8 months after planting. Fruit can show color at the tip when ready.', 'https://library.buplant.da.gov.ph/images/1641884692Papaya%20%20Production%20Guide.pdf', { longCycle: true }),
  crop('Ampalaya', 'Gourd family', [60, 75], 'First harvest',
    'Train the vine on a trellis. DA Bicol counts this estimate from emergence and picking can continue afterward.', bicolVegetableGuide,
    { repeatPick: true, timing: 'From emergence', calendar: { II: [6, 7, 8], III: [5, 6], IV: [5, 6] } }),
  crop('Sweet potato (Kamote)', 'Morning glory family', [110, 130], 'Harvest',
    'Plant healthy vine cuttings in loose ridges that drain well. Dig a sample root to check size before lifting the crop.', 'https://cagayanvalley.da.gov.ph/wp-content/uploads/2018/02/sweet_potato.pdf',
    { calendar: regionalWindow(allYear) }),
  crop('Rice (Palay)', 'Grass family', [105, 125], 'Harvest',
    'Lowland rice needs a managed paddy and reliable water. Check the local irrigation and variety schedule before sowing.', 'https://smartfarm.philrice.gov.ph/',
    { calendar: regionalWindow([6, 12]) }),
  crop('Corn (Mais)', 'Grass family', [90, 110], 'Harvest',
    'DA–ATI gives 90–95 days for early grain corn and 105–110 for full-season types. Confirm the hybrid on your seed label.', 'https://ati2.da.gov.ph/ati-5/content/sites/default/files/users/user17/Corn%20Production%20%289%20Basic%20Steps%20for%20Bountiful%20Harvest%29.pdf',
    { calendar: regionalWindow([5, 11]) }),
  crop('Ginger (Luya)', 'Ginger family', [150, 330], 'Harvest',
    'Young ginger can be lifted earlier than mature rhizomes. Keep beds well drained and use healthy planting pieces.', hvcdp + 'DA-CAR-TECHNOGUIDE-IN-PRODUCTION-_-MANAGEMENT-OF-GINGER.pdf'),
  crop('Pineapple (Pinya)', 'Bromeliad family', [540, 730], 'First harvest',
    'The first fruit can take 18–24 months. The planting material and timing of flowering affect the harvest.', mimaropa, { longCycle: true }),
  crop('Cacao', 'Mallow family', [480, 510], 'First flowering',
    'The workbook estimates first flowering. Protect young trees with suitable shade and allow additional time for pods to mature.', hvcdp + 'Cacao-Production-Guide.pdf', { longCycle: true }),
  crop('Arrowroot (Urard)', 'Arrowroot family', [240, 300], 'Harvest',
    'Grow for underground rhizomes. Plan the lifting date around crop maturity and the starch market.', hvcdp + 'Arrowroot-Production.pdf'),
  crop('Cassava (Kamoteng kahoy)', 'Spurge family', [180, 210], 'Harvest',
    'Workbook estimate for an early crop. Establish stem cuttings in moist, well-drained ground. Confirm maturity for the variety and intended market.', rootCrops,
    { calendar: regionalWindow(allYear) }),
  crop('Tomato (Kamatis)', 'Nightshade family', [60, 110], 'First harvest',
    'Allow time for nursery seedlings and repeated picking. Use the variety’s transplant-to-harvest estimate for a more precise date.', bicolVegetableGuide,
    { repeatPick: true, calendar: { II: [1, 2, 3, 4, 8, 9], III: [10, 11, 12, 1], IV: [5, 6, 10, 11, 12, 1] } }),
  crop('Mungbean (Monggo)', 'Legume family', [65, 72], 'First harvest',
    'DA Bicol reports two or three rounds of picking. Plan for the field to drain after rice and wait for the last picking before clearing.', bicolVegetableGuide,
    { repeatPick: true, calendar: { II: [2, 3, 4, 5, 6], III: [9, 10, 12, 1], IV: [5, 6, 11, 12, 1] } }),
  crop('Sweet corn', 'Grass family', [70, 80], 'Harvest',
    'Pick fresh ears at the milk stage. The corn planting months shown are a regional reference for maize.', 'https://www.susana.org/_resources/documents/default/2-1126-en-philippine-allotment-garden-manual-2008-6.pdf',
    { calendar: regionalWindow([5, 11]) }),
  crop('Peanut (Mani)', 'Legume family', [90, 110], 'Harvest',
    'Use loose soil that drains well. Check a sample of pods for maturity before lifting the crop.', 'https://ati2.da.gov.ph/ati-2/content/sites/default/files/2025-10/IEC%20Peanut.pdf',
    { calendar: regionalWindow([5, 11]) }),
  crop('Eggplant (Talong)', 'Nightshade family', [65, 80], 'First harvest',
    'Variety and transplant age affect first picking. Harvest glossy fruits while tender and allow for later pickings.', bicolVegetableGuide,
    { repeatPick: true, calendar: { II: [1, 2, 3, 4], III: [5, 6, 11, 12, 1], IV: [6, 7, 11, 12, 1] } }),
  crop('Okra', 'Mallow family', [60, 75], 'First harvest',
    'DA Bicol estimates 60–75 days from planting. Pick tender pods frequently once production starts.', bicolVegetableGuide,
    { repeatPick: true, calendar: { II: allYear, III: [5, 6, 7, 10, 11, 12], IV: [6, 7, 9, 10, 1, 2] } }),
  crop('Squash (Kalabasa)', 'Gourd family', [85, 100], 'Harvest',
    'Plan space for runners and harvest mature fruit with a firm rind. Timing varies with fruit set.', bicolVegetableGuide,
    { calendar: { II: allYear, III: [5, 6, 10, 11, 12], IV: [5, 6, 11, 12, 1] } }),
  crop('String beans (Sitaw)', 'Legume family', [50, 60], 'First harvest',
    'Trellis climbing varieties and keep moisture available at flowering and pod set. Pick young pods repeatedly.', bicolVegetableGuide,
    { repeatPick: true, calendar: { II: [5, 6], III: [1, 5, 6], IV: [10, 11, 12, 1, 5, 6] } }),
  crop('Bottle gourd (Upo)', 'Gourd family', [60, 100], 'First harvest',
    'Harvest young fruits for eating. Timing varies by variety. DA Bicol lists 90–100 days for Tambuli.', bicolVegetableGuide,
    { repeatPick: true, calendar: { II: [11, 12, 1, 2, 3], III: [4, 5, 10, 11, 12, 1], IV: [5, 6, 10, 11, 12, 1] } }),
  crop('Sponge gourd (Patola)', 'Gourd family', [55, 65], 'First harvest',
    'Train vines on a trellis. Pick young fruits for eating. DA Bicol lists 60–65 days for Hercules.', bicolVegetableGuide,
    { repeatPick: true, calendar: { II: [3, 4, 5, 6, 7, 8, 9], III: [5, 6, 11, 12], IV: [5, 6, 11, 12, 1] } }),
  crop('Chayote (Sayote)', 'Gourd family', [120, 150], 'First harvest',
    'A climbing perennial suited to cooler sites with a strong trellis. Mature vines can continue bearing beyond the first pick.', 'https://sites.google.com/ati.da.gov.ph/knowledge-resource-center/techno-guides/high-value-crops', { longCycle: true }),
  crop('Pechay', 'Mustard family', [30, 39], 'Harvest',
    'DA Bicol lists 10–14 days in the nursery and 20–25 days from transplanting to harvest. Use raised beds in wet conditions.', bicolVegetableGuide,
    { calendar: { II: [1, 2, 3], III: [5, 6, 10, 11, 12], IV: [5, 6, 11, 12, 1] } }),
  crop('Mustard (Mustasa)', 'Mustard family', [30, 39], 'Harvest',
    'DA Bicol groups mustard with pechay for nursery and transplant timing. Rotate away from the mustard family to help break pest cycles.', bicolVegetableGuide),
  crop('Water spinach (Kangkong)', 'Morning glory family', [25, 30], 'First harvest',
    'Harvest tender shoots. Choose a variety for your growing system and use clean water for edible greens.', mimaropa, { repeatPick: true }),
  crop('Sweet pepper (Atzal)', 'Nightshade family', [70, 85], 'First harvest',
    'Use raised beds in the wet season and plan for multiple pickings. Confirm maturity for your chosen variety.', bicolVegetableGuide,
    { repeatPick: true, calendar: { II: [2, 3, 8, 9], III: [5, 6, 10, 11, 12], IV: [5, 6, 9, 10, 11, 12, 1] } }),
  crop('Cabbage', 'Mustard family', [65, 85], 'Harvest',
    'Cooler conditions favor heading. Choose a variety adapted to your elevation and harvest firm heads.', bicolVegetableGuide,
    { calendar: { II: [1, 2, 3], III: [4, 5, 6, 10, 11, 12], IV: [6, 7, 8, 9, 10, 11, 12, 1] } }),
  crop('Malabar spinach (Alugbati)', 'Basella family', [35, 45], 'First harvest',
    'Support the climbing stems or grow as a low leafy planting. Cut tender shoots and allow the plant to regrow.', ati, { repeatPick: true }),
  crop('Malunggay', 'Moringa family', [180, 240], 'First harvest',
    'A perennial tree. Prune for reachable leaf harvests and check the variety and method used for establishment.', hvcdp + 'Production-Guide.pdf', { longCycle: true }),
  crop('Chili (Siling labuyo / haba)', 'Nightshade family', [75, 90], 'First harvest',
    'Use well-drained beds and allow for repeated picking. Long chili and labuyo may differ in maturity and fruit color at harvest.', mimaropa, { repeatPick: true }),
  crop('Turmeric (Luyang dilaw)', 'Ginger family', [240, 300], 'Harvest',
    'Lift mature rhizomes after the foliage starts yellowing. Maturity varies with planting stock and cultivar.', 'https://www.icar.gov.in/sites/default/files/2025-12/August_2025%20Indian%20Farming.pdf'),
  crop('Lemongrass (Tanglad)', 'Grass family', [180, 240], 'First harvest',
    'The first leaf cut can take six to eight months. Established clumps can regrow for later cuts.', 'https://prosea.prota4u.org/view.aspx?id=659', { longCycle: true }),
  crop('Spring onion', 'Amaryllis family', [45, 60], 'Harvest',
    'This estimate is for green bunching onions. Harvest the leaves and stems before the crop is grown out for bulbs.', 'https://saad.da.gov.ph/gandawan-fa-engages-in-spring-onion-production-as-climate-resilience-strategy/'),
  crop('Taro (Gabi)', 'Arum family', [180, 240], 'Harvest',
    'Choose a variety and production system suited to your site. Upland and wetland taro have different water needs.', hvcdp + 'TARO-Production-Guide.pdf'),
  crop('Purple yam (Ube)', 'Yam family', [300, 330], 'Harvest',
    'The DA guide puts mature harvest around 10–11 months as foliage dries. Earlier lifting is possible for some market uses.', 'https://cagayanvalley.da.gov.ph/wp-content/uploads/2018/02/ube_production_guide.pdf'),
  crop('Calamansi', 'Citrus family', [730, 1095], 'First bearing',
    'Select healthy planting stock for a well-drained orchard. Age at first bearing depends on propagation and care.', mimaropa, { longCycle: true }),
  crop('Jackfruit (Langka)', 'Mulberry family', [1095, 1460], 'First bearing',
    'Grafted planting material can bring a tree into production earlier. Allow space for the mature canopy.', 'https://hvcdp.da.gov.ph/production-manuals/', { longCycle: true }),
  crop('Mango', 'Cashew family', [1460, 1825], 'First bearing',
    'Propagation method affects bearing age. Plan for sun, orchard drainage, and room for the canopy.', mimaropa, { longCycle: true }),
  crop('Rambutan', 'Soapberry family', [1460, 1825], 'First bearing',
    'Use known planting stock and allow room for a permanent orchard. Seedling and grafted trees can bear at different ages.', hvcdp + 'DA-CAR-TECHNOGUIDE-IN-RAMBUTAN-PRODUCTION.pdf', { longCycle: true }),
  crop('Lanzones', 'Mahogany family', [1825, 2555], 'First bearing',
    'Young trees benefit from shelter while establishing. Bearing age depends on planting stock and site conditions.', 'https://eagri.e.gov.ph/commodities/lanzones', { longCycle: true }),
  crop('Dragon fruit', 'Cactus family', [365, 540], 'First bearing',
    'Use a strong support post and draining soil. Check pollination needs and time to bearing for your variety.', mimaropa, { longCycle: true }),
  crop('Watermelon / Melon', 'Gourd family', [70, 85], 'Harvest',
    'Allow space for vines and check maturity signs for the specific melon. Watermelon and honeydew have different harvest cues.', mimaropa),
  crop('Coffee (Robusta)', 'Coffee family', [730, 1095], 'First bearing',
    'A perennial crop. Plant suitable Robusta stock and pick ripe cherries selectively once the plants begin producing.', 'https://hvcdp.da.gov.ph/production-manuals/', { longCycle: true }),
  crop('Sugarcane', 'Grass family', [300, 365], 'Harvest',
    'A long-cycle crop. Coordinate harvest with the mill and decide whether to keep a ratoon crop after cutting.', 'https://ispweb.pcaarrd.dost.gov.ph/sugarcane/'),
  crop('Tiger grass (Tambo)', 'Grass family', [365, 450], 'First harvest',
    'A perennial grown for broom panicles. DENR recommends establishing suckers around the onset of rains.', 'https://fmb.denr.gov.ph/8hYRe4PgGbUWAG/wp-content/uploads/2024/12/ENT02.pdf', { longCycle: true })
].map((entry, artwork): Crop => ({ ...entry, artwork }));
