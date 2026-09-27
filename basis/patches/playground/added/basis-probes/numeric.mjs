// Reject lossy JSON values before numeric conversion. In particular,
// JSON.stringify(NaN/Infinity) produces null, and Number(null) would become 0.
const integerText = /^[+-]?\d+$/;
const decimalText = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function flatNumeric(typed) {
  if (!typed || typeof typed !== 'object') return null;
  if (typed.type === 'array') {
    if (!Array.isArray(typed.elements)) return null;
    const result = [];
    for (const element of typed.elements) {
      const numbers = flatNumeric(element);
      if (numbers === null) return null;
      result.push(...numbers);
    }
    return result;
  }
  if (typed.type !== 'float' && typed.type !== 'int') return null;
  const value = typed.value;
  // The worker serializes BigInts as decimal strings. Float64 values must
  // already be numbers; strings, booleans, null, and undefined are invalid.
  const validIntegerString = typed.type === 'int' && typeof value === 'string' && integerText.test(value);
  if (typeof value !== 'number' && !validIntegerString) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || (typed.type === 'int' && !Number.isInteger(number))) return null;
  return [number];
}

export function parseNativeValues(text) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  const fields = text.split(',');
  const result = [];
  for (const field of fields) {
    const value = field.trim();
    // Number(''), Number(' '), and Number(null) all produce zero. A missing
    // native result or a blank field must fail instead of becoming an answer.
    if (!decimalText.test(value)) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    result.push(number);
  }
  return result;
}

