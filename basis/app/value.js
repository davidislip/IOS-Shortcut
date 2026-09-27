// Preserve Maps and typed array data returned by wasm-bindgen. No display-text parsing.
export function normalize(value) {
  if (value instanceof Map) return Object.fromEntries([...value].map(([key, child]) => [String(key), normalize(child)]));
  if (ArrayBuffer.isView(value)) return Array.from(value, normalize);
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'bigint') return value.toString();
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalize(child)]));
  return value;
}

export function arrayRows(value) {
  if (!value || value.type !== 'array' || !Array.isArray(value.shape) || !Array.isArray(value.elements)) return null;
  if (value.shape.length < 1 || value.shape.length > 2) return null;
  const [rows, columns = 1] = value.shape;
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 0 || columns < 0 || rows * columns !== value.elements.length || rows * columns > 2500) return null;
  // Julia arrays are column-major.
  return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => value.elements[column * rows + row]));
}

export function printable(value) {
  return value?.display ?? String(value?.value ?? value?.type ?? 'nothing');
}

export function jsonValue(value) {
  return JSON.stringify(value, (_, child) => typeof child === 'number' && !Number.isFinite(child) ? String(child) : child, 2);
}
