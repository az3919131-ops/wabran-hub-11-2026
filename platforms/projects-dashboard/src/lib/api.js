// الاتصال بقاعدة بيانات Netlify الداخلية (Netlify Blobs عبر /api/reports)
const PIN_KEY = 'najran-admin-pin';
export const getPin = () => { try { return sessionStorage.getItem(PIN_KEY) || ''; } catch { return ''; } };
export const setPin = (p) => { try { p ? sessionStorage.setItem(PIN_KEY, p) : sessionStorage.removeItem(PIN_KEY); } catch { /* ignore */ } };

async function call(method, query = '', body, pin = getPin()) {
  const res = await fetch(`/api/reports${query}`, {
    method,
    headers: { 'content-type': 'application/json', ...(pin ? { 'x-admin-pin': pin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `خطأ ${res.status}`);
  return data;
}
export const api = {
  list: () => call('GET'),
  get: (id) => call('GET', `?id=${encodeURIComponent(id)}`),
  save: (report) => call('POST', '', report),
  remove: (id) => call('DELETE', `?id=${encodeURIComponent(id)}`),
  checkPin: (pin) => call('POST', '?check=1', {}, pin),
};
