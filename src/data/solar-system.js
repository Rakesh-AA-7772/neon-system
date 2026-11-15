/**
 * Shared celestial-body data. Renderer state (angles, trails and camera values)
 * lives outside this module so this data can be reused by UI and other systems.
 */
export const CELESTIAL_BODIES = Object.freeze([
  {
    id: 'sun', name: 'Sun', kind: 'star', distAU: 0, size: 20,
    color: '#ffcc66', speed: 0, texture: '/textures/sun.jpg',
    description: 'The Sun is the star at the center of our Solar System. Its gravity holds the system together, and its light and heat make life on Earth possible.',
    nasaUrl: 'https://science.nasa.gov/sun/'
  },
  {
    id: 'mercury', name: 'Mercury', kind: 'planet', distAU: 0.9, size: 4.6,
    color: '#cfcfcf', speed: 4.2, texture: '/textures/mercury.jpg',
    description: 'Mercury is the smallest planet and the closest planet to the Sun. Its heavily cratered surface experiences extreme temperature changes.',
    nasaUrl: 'https://science.nasa.gov/mercury/'
  },
  {
    id: 'venus', name: 'Venus', kind: 'planet', distAU: 1.6, size: 6.8,
    color: '#f1c40f', speed: 1.6, texture: '/textures/venus.jpg',
    description: 'Venus has a thick carbon-dioxide atmosphere and an intense greenhouse effect, making it the hottest planet in our Solar System.',
    nasaUrl: 'https://science.nasa.gov/venus/'
  },
  {
    id: 'earth', name: 'Earth', kind: 'planet', distAU: 2.6, size: 8,
    color: '#3fa9ff', speed: 1, texture: '/textures/earth.jpg',
    description: 'Earth is our home planet. It has abundant liquid water on its surface and is the only world currently known to support life.',
    nasaUrl: 'https://science.nasa.gov/earth/'
  },
  {
    id: 'mars', name: 'Mars', kind: 'planet', distAU: 3.8, size: 5.6,
    color: '#ff6b3d', speed: 0.5, texture: '/textures/mars.jpg',
    description: 'Mars is the Red Planet. Its surface preserves evidence of ancient rivers and lakes, and it is home to enormous volcanoes and canyons.',
    nasaUrl: 'https://science.nasa.gov/mars/'
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'planet', distAU: 7, size: 9,
    color: '#d8cba8', speed: 0.08, texture: '/textures/jupiter.jpg',
    description: 'Jupiter is the largest planet. This gas giant has powerful storms, including the Great Red Spot, and a large family of moons.',
    nasaUrl: 'https://science.nasa.gov/jupiter/'
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'planet', distAU: 10.8, size: 14,
    color: '#f5d7a3', speed: 0.03, texture: '/textures/saturn.jpg',
    description: 'Saturn is a gas giant best known for its bright and extensive ring system, made mostly of countless particles of ice and rock.',
    nasaUrl: 'https://science.nasa.gov/saturn/'
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'planet', distAU: 16.5, size: 10.4,
    color: '#8cf0e0', speed: 0.012, texture: '/textures/uranus.jpg',
    description: 'Uranus is an ice giant that rotates on its side. Its pale blue-green color comes from methane in its atmosphere.',
    nasaUrl: 'https://science.nasa.gov/uranus/'
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'planet', distAU: 20.5, size: 10.4,
    color: '#547aff', speed: 0.006, texture: '/textures/neptune.jpg',
    description: 'Neptune is a distant ice giant with a deep blue atmosphere and some of the fastest winds measured in the Solar System.',
    nasaUrl: 'https://science.nasa.gov/neptune/'
  },
  {
    id: 'moon', name: 'Moon', kind: 'moon', parentId: 'earth', distAU: 0.35, size: 2.6,
    color: '#cccccc', speed: 3.6, texture: '/textures/moon.jpg',
    description: 'The Moon is Earth’s only natural satellite. Its surface is covered with impact craters and it has no thick atmosphere.',
    nasaUrl: 'https://science.nasa.gov/moon/'
  }
]);

export const PLANETS = Object.freeze(CELESTIAL_BODIES.filter((body) => body.kind === 'star' || body.kind === 'planet'));
export const MOON = CELESTIAL_BODIES.find((body) => body.id === 'moon');
export const BODY_BY_ID = Object.freeze(Object.fromEntries(CELESTIAL_BODIES.map((body) => [body.id, body])));
