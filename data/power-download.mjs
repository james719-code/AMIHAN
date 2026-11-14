import { setTimeout as delay } from 'node:timers/promises';

export async function download(url) {
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) }).catch((error) => {
      if (attempt === 3) throw error.cause ?? error;
    });
    if (response?.ok) return await response.text();
    if (response && (attempt === 3 || (response.status < 500 && response.status !== 429))) {
      throw new Error(`NASA POWER returned HTTP ${response.status}: ${await response.text()}`);
    }
    await response?.body?.cancel();
    await delay(attempt * 2_000);
  }
}
