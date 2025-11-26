// utils/geojson.js
// CommonJS để phù hợp với codebase hiện tại

// ---- primitives ----
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

function isPosition(p) {
  return Array.isArray(p)
    && p.length === 2
    && isNumber(p[0]) && isNumber(p[1])
    && p[0] >= -180 && p[0] <= 180
    && p[1] >= -90 && p[1] <= 90;
}

function ensureClosedRing(ring) {
  if (!Array.isArray(ring) || ring.length < 4) return ring;
  const [fx, fy] = ring[0] || [];
  const [lx, ly] = ring[ring.length - 1] || [];
  if (fx !== lx || fy !== ly) return [...ring, ring[0]];
  return ring;
}

// ---- validators ----
function validatePolygonCoordinates(coords) {
  if (!Array.isArray(coords) || coords.length === 0) {
    return { ok: false, msg: 'Polygon.coordinates phải là mảng >= 1 ring' };
  }
  for (let i = 0; i < coords.length; i++) {
    const ring = coords[i];
    if (!Array.isArray(ring) || ring.length < 4) {
      return { ok: false, msg: `Polygon ring ${i} phải có >= 4 điểm` };
    }
    for (let j = 0; j < ring.length; j++) {
      if (!isPosition(ring[j])) {
        return { ok: false, msg: `Polygon ring ${i} điểm ${j} không hợp lệ [lng, lat]` };
      }
    }
    // vòng phải đóng
    const closed = ensureClosedRing(ring);
    if (closed.length !== ring.length) {
      // không ép đóng ở bước validate - chỉ báo để caller biết
      return { ok: false, msg: `Polygon ring ${i} chưa đóng (điểm đầu != điểm cuối)` };
    }
  }
  return { ok: true };
}

function validateMultiPolygonCoordinates(coords) {
  if (!Array.isArray(coords) || coords.length === 0) {
    return { ok: false, msg: 'MultiPolygon.coordinates phải là mảng >= 1 polygon' };
  }
  for (let i = 0; i < coords.length; i++) {
    const r = validatePolygonCoordinates(coords[i]);
    if (!r.ok) return { ok: false, msg: `MultiPolygon polygon ${i} lỗi: ${r.msg}` };
  }
  return { ok: true };
}

// ---- normalizers ----
function normalizeCoordinates(type, coordinates) {
  if (type === 'Polygon') {
    return coordinates.map(ensureClosedRing);
  }
  // MultiPolygon
  return coordinates.map(poly => poly.map(ensureClosedRing));
}

// ---- entry points dùng lại ở mọi nơi ----
function validateGeoJSONGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object') {
    return { ok: false, msg: 'boundaries phải là object GeoJSON' };
  }
  const { type, coordinates } = geometry;
  if (!['Polygon', 'MultiPolygon'].includes(type)) {
    return { ok: false, msg: 'boundaries.type phải là Polygon hoặc MultiPolygon' };
  }
  const r = type === 'Polygon'
    ? validatePolygonCoordinates(coordinates)
    : validateMultiPolygonCoordinates(coordinates);
  if (!r.ok) return r;

  return { ok: true };
}

function normalizeGeoJSONGeometry(geometry) {
  const { type, coordinates } = geometry;
  return {
    type,
    coordinates: normalizeCoordinates(type, coordinates),
  };
}

module.exports = {
  // primitives (nếu cần xài riêng)
  isNumber,
  isPosition,
  ensureClosedRing,

  // validators
  validatePolygonCoordinates,
  validateMultiPolygonCoordinates,
  validateGeoJSONGeometry,

  // normalizers
  normalizeCoordinates,
  normalizeGeoJSONGeometry,
};
