// Responses of the requests index.html starts before the bundle loads.
// Each one is used once; on any failure the caller makes its normal request.
declare global {
  interface Window {
    __prefetch?: Record<string, Promise<Response>>;
  }
}

export async function takePrefetched<T>(key: string): Promise<T | undefined> {
  const pending = window.__prefetch?.[key];
  if (!pending) return undefined;
  delete window.__prefetch[key];
  try {
    const res = await pending;
    if (!res.ok) return undefined;
    const body = await res.json();
    return body?.data as T;
  } catch {
    return undefined;
  }
}
