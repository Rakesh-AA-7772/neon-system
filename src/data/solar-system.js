/**
 * Planetary values are rounded from NASA's published mean Sun distances and
 * planetary data. distAU is the orbital semi-major axis (mean orbital distance).
 * https://science.nasa.gov/learn/basics-of-space-flight/chapter1-2/
 * https://science.nasa.gov/solar-system/planets/planet-sizes-and-locations-in-our-solar-system/
 *
 * Visual radii are deliberately enlarged. Orbit radii use a shared linear AU scale.
 * The Moon's on-screen separation is enlarged; its real Earth distance is shown.
 */
export const CELESTIAL_BODIES = Object.freeze([
  {
    id: 'sun', name: 'Sun', kind: 'star', distAU: 0, distanceKm: 0,
    visualRadius: 0.22, color: '#ffcc66', speed: 0, orbitalPeriodDays: 0,
    orbitalEccentricity: 0, orbitalInclinationDeg: 0, axialTiltDeg: 7.25,
    rotationPeriodHours: 609.12, texture: '/textures/sun.jpg',
    description: 'The Sun is the star at the center of our Solar System. Its gravity holds the system together, and its light and heat make life on Earth possible.',
    nasaUrl: 'https://science.nasa.gov/sun/'
  },
  {
    id: 'mercury', name: 'Mercury', kind: 'planet', distAU: 0.387, distanceKm: 57900000,
    visualRadius: 0.075, color: '#cfcfcf', orbitalPeriodDays: 87.969,
    orbitalEccentricity: 0.2056, orbitalInclinationDeg: 7.005, axialTiltDeg: 0.034,
    rotationPeriodHours: 1407.6, texture: '/textures/mercury.jpg',
    description: 'Mercury is the smallest planet and the closest planet to the Sun. Its heavily cratered surface experiences extreme temperature changes.',
    nasaUrl: 'https://science.nasa.gov/mercury/'
  },
  {
    id: 'venus', name: 'Venus', kind: 'planet', distAU: 0.723, distanceKm: 108200000,
    visualRadius: 0.105, color: '#f1c40f', orbitalPeriodDays: 224.701,
    orbitalEccentricity: 0.0068, orbitalInclinationDeg: 3.395, axialTiltDeg: 177.4,
    rotationPeriodHours: -5832.5, atmosphereColor: '#f3c27c', atmosphereOpacity: 0.24,
    texture: '/textures/venus.jpg',
    description: 'Venus has a thick carbon-dioxide atmosphere and an intense greenhouse effect, making it the hottest planet in our Solar System.',
    nasaUrl: 'https://science.nasa.gov/venus/'
  },
  {
    id: 'earth', name: 'Earth', kind: 'planet', distAU: 1.000, distanceKm: 149600000,
    visualRadius: 0.115, color: '#3fa9ff', orbitalPeriodDays: 365.256,
    orbitalEccentricity: 0.0167, orbitalInclinationDeg: 0, axialTiltDeg: 23.44,
    rotationPeriodHours: 23.934, atmosphereColor: '#4e9cff', atmosphereOpacity: 0.22,
    texture: '/textures/earth.jpg',
    description: 'Earth is our home planet. It has abundant liquid water on its surface and is the only world currently known to support life.',
    nasaUrl: 'https://science.nasa.gov/earth/'
  },
  {
    id: 'mars', name: 'Mars', kind: 'planet', distAU: 1.524, distanceKm: 227900000,
    visualRadius: 0.085, color: '#ff6b3d', orbitalPeriodDays: 686.98,
    orbitalEccentricity: 0.0934, orbitalInclinationDeg: 1.85, axialTiltDeg: 25.19,
    rotationPeriodHours: 24.623, atmosphereColor: '#d66d55', atmosphereOpacity: 0.11,
    texture: '/textures/mars.jpg',
    description: 'Mars is the Red Planet. Its surface preserves evidence of ancient rivers and lakes, and it is home to enormous volcanoes and canyons.',
    nasaUrl: 'https://science.nasa.gov/mars/'
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'planet', distAU: 5.20, distanceKm: 778600000,
    visualRadius: 0.235, color: '#d8cba8', orbitalPeriodDays: 4332.59,
    orbitalEccentricity: 0.0489, orbitalInclinationDeg: 1.303, axialTiltDeg: 3.13,
    rotationPeriodHours: 9.925, texture: '/textures/jupiter.jpg',
    description: 'Jupiter is the largest planet. This gas giant has powerful storms, including the Great Red Spot, and a large family of moons.',
    nasaUrl: 'https://science.nasa.gov/jupiter/'
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'planet', distAU: 9.58, distanceKm: 1434000000,
    visualRadius: 0.205, color: '#f5d7a3', orbitalPeriodDays: 10759.22,
    orbitalEccentricity: 0.0565, orbitalInclinationDeg: 2.485, axialTiltDeg: 26.73,
    rotationPeriodHours: 10.7, texture: '/textures/saturn.jpg',
    description: 'Saturn is a gas giant best known for its bright and extensive rings, made mostly of countless particles of ice and rock.',
    nasaUrl: 'https://science.nasa.gov/saturn/'
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'planet', distAU: 19.20, distanceKm: 2872000000,
    visualRadius: 0.15, color: '#8cf0e0', orbitalPeriodDays: 30688.5,
    orbitalEccentricity: 0.0463, orbitalInclinationDeg: 0.773, axialTiltDeg: 97.77,
    rotationPeriodHours: -17.24, atmosphereColor: '#79e9dc', atmosphereOpacity: 0.14,
    texture: '/textures/uranus.jpg',
    description: 'Uranus is an ice giant that rotates on its side. Its pale blue-green color comes from methane in its atmosphere.',
    nasaUrl: 'https://science.nasa.gov/uranus/'
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'planet', distAU: 30.05, distanceKm: 4495000000,
    visualRadius: 0.15, color: '#547aff', orbitalPeriodDays: 60182,
    orbitalEccentricity: 0.0095, orbitalInclinationDeg: 1.77, axialTiltDeg: 28.32,
    rotationPeriodHours: 16.11, atmosphereColor: '#477dff', atmosphereOpacity: 0.16,
    texture: '/textures/neptune.jpg',
    description: 'Neptune is a distant ice giant with a deep blue atmosphere and some of the fastest winds measured in the Solar System.',
    nasaUrl: 'https://science.nasa.gov/neptune/'
  },
  {
    id: 'moon', name: 'Moon', kind: 'moon', parentId: 'earth',
    distAU: 0.00257, distanceKm: 384400, visualRadius: 0.045,
    visualOrbitRadius: 0.42, visualDistanceAU: 0.42 / 1.15,
    color: '#cccccc', orbitalPeriodDays: 27.322,
    orbitalEccentricity: 0.0549, orbitalInclinationDeg: 5.145, axialTiltDeg: 6.68,
    rotationPeriodHours: 655.7, texture: '/textures/moon.jpg',
    description: 'The Moon is Earth’s only natural satellite. Its average distance from Earth is about 384,400 km. Its on-screen separation is enlarged so it remains visible beside Earth.',
    nasaUrl: 'https://science.nasa.gov/moon/'
  }
]);

export const PLANETS = Object.freeze(CELESTIAL_BODIES.filter((body) => body.kind === 'star' || body.kind === 'planet'));
export const MOON = CELESTIAL_BODIES.find((body) => body.id === 'moon');
export const BODY_BY_ID = Object.freeze(Object.fromEntries(CELESTIAL_BODIES.map((body) => [body.id, body])));

export function formatAU(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number < 1 ? number.toFixed(3) : number.toFixed(2);
}

export function formatAverageDistance(body) {
  if (!body) return 'Distance unavailable';
  if (body.kind === 'star') return 'At the center of the Solar System';
  if (body.kind === 'moon') return '384,400 km from Earth';
  const km = body.distanceKm;
  if (!Number.isFinite(km)) return 'Distance unavailable';
  if (km >= 1000000000) return `${(km / 1000000000).toFixed(3)} billion km`;
  return `${(km / 1000000).toFixed(1)} million km`;
}
