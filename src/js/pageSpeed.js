import { db } from 'baqend/realtime';

/**
 * @deprecated
 * @param {string} url The URL to run the Page Speed tests on.
 * @return {Promise<{ domains: number | null, requests: number | null, bytes: number | null, screenshot: string | null }>}
 */
export async function callPageSpeedInsightsAPI(url) {
  return db.modules.get('callPageSpeed', { url });
}
