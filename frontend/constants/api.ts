// Change this to your DS teammate's FastAPI local IP during demo
// e.g. "http://192.168.1.42:8000"
export const API_BASE_URL = 'http://localhost:8000';

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
