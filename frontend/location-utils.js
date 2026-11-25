const DIGIPIN_GRID = [
  ['F', 'C', '9', '8'],
  ['J', '3', '2', '7'],
  ['K', '4', '5', '6'],
  ['L', 'M', 'P', 'T']
];
const DIGIPIN_BOUNDS = { minLat: 2.5, maxLat: 38.5, minLon: 63.5, maxLon: 99.5 };
export function validCoordinates(lat, lng) {
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 && typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
export function formatDigiPin(raw) {
  const clean = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (!/^[23456789CFJKLMPT]{10}$/.test(clean)) return '';
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 10)}`;
}
export function encodeDigiPin(lat, lng) {
  if (!validCoordinates(lat, lng)) return '';
  let { minLat, maxLat, minLon, maxLon } = DIGIPIN_BOUNDS;
  if (lat < minLat || lat > maxLat || lng < minLon || lng > maxLon) return '';
  let code = '';
  for (let lvl = 1; lvl <= 10; lvl++) {
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;
    let row = 3 - Math.floor((lat - minLat) / latDiv);
    let col = Math.floor((lng - minLon) / lonDiv);
    row = Math.max(0, Math.min(3, row));
    col = Math.max(0, Math.min(3, col));
    code += DIGIPIN_GRID[row][col];
    if (lvl === 3 || lvl === 6) code += '-';
    const nextMinLat = minLat + latDiv * (3 - row);
    const nextMaxLat = minLat + latDiv * (4 - row);
    const nextMinLon = minLon + lonDiv * col;
    const nextMaxLon = minLon + lonDiv * (col + 1);
    minLat = nextMinLat;
    maxLat = nextMaxLat;
    minLon = nextMinLon;
    maxLon = nextMaxLon;
  }
  return code;
}
export function decodeDigiPin(raw) {
  const formatted = formatDigiPin(raw);
  if (!formatted) return null;
  const clean = formatted.replace(/-/g, '');
  let { minLat, maxLat, minLon, maxLon } = DIGIPIN_BOUNDS;
  for (const ch of clean) {
    let row = -1, col = -1;
    for (let r = 0; r < 4; r++) {
      const c = DIGIPIN_GRID[r].indexOf(ch);
      if (c !== -1) { row = r; col = c; break; }
    }
    if (row === -1) return null;
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;
    const nextMinLat = minLat + latDiv * (3 - row);
    const nextMaxLat = minLat + latDiv * (4 - row);
    const nextMinLon = minLon + lonDiv * col;
    const nextMaxLon = minLon + lonDiv * (col + 1);
    minLat = nextMinLat;
    maxLat = nextMaxLat;
    minLon = nextMinLon;
    maxLon = nextMaxLon;
  }
  return {
    latitude: Number(((minLat + maxLat) / 2).toFixed(6)),
    longitude: Number(((minLon + maxLon) / 2).toFixed(6))
  };
}
export function validLocation(point) {
  return !!point && validCoordinates(point.latitude,point.longitude) && point.confirmed === true && ['search','pin','device'].includes(point.source) && typeof point.formattedAddress === 'string' && point.formattedAddress.length <= 1000 && Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 1000000 && (point.digipin === undefined || typeof point.digipin === 'string');
}
export function customerDigiPin(customer) {
  if (!customer || typeof customer !== 'object') return '';
  return formatDigiPin(customer.digipin)
    || formatDigiPin(customer.location?.digipin)
    || (validLocation(customer.location) ? encodeDigiPin(customer.location.latitude, customer.location.longitude) : '');
}
export function parseLocationQuery(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const digipin = formatDigiPin(text);
  if (digipin) {
    const pos = decodeDigiPin(digipin);
    return pos ? { type: 'digipin', digipin, latitude: pos.latitude, longitude: pos.longitude } : null;
  }
  const patterns = [
    /@(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|query|destination|center)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,2}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})\s*$/
  ];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (!m) continue;
    const lat = Number(m[1]), lng = Number(m[2]);
    if (validCoordinates(lat, lng)) {
      return { type: 'coords', latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)), digipin: encodeDigiPin(lat, lng) };
    }
  }
  return null;
}
export function featureAddress(feature) {
  const p = feature?.properties || {};
  const address = [p.housenumber,p.street || p.name].filter(Boolean).join(' ');
  const city = p.city || p.town || p.village || p.district || '';
  return {address:address.slice(0,300),city:city.slice(0,100),state:String(p.state || '').slice(0,100),postalCode:/^[1-9]\d{5}$/.test(p.postcode || '')?p.postcode:'',country:p.countrycode?.toUpperCase()==='IN'?'India':''};
}
export function featureLabel(feature) {
  const p = feature?.properties || {};
  return [...new Set([[p.housenumber,p.street].filter(Boolean).join(' '),p.name,p.district,p.city,p.state,p.postcode,p.country].filter(Boolean))].join(', ').slice(0,1000);
}
export function addressText(customer) {
  return [customer.address,customer.apartment,customer.city,customer.state,customer.postalCode,customer.country].filter(Boolean).join(', ');
}
export function locationLink(customer) {
  const p = customer.location;
  const query=validLocation(p)?`${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`:addressText(customer);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
