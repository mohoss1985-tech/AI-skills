/* HTTP method chip: GET/POST/PUT/PATCH/DELETE in mono 11/600, method colours (GET ok, POST warn, PUT/PATCH accent, DELETE bad).
   methodChip({method}) → <span class="method-chip method-get">. */
export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
export function methodChip({ method = 'GET' } = {}) {
  const s = document.createElement('span');
  const m = String(method).toUpperCase();
  s.className = 'method-chip method-' + m.toLowerCase();
  s.textContent = m;
  return s;
}
