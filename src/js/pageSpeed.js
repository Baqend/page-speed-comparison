import { db } from 'baqend/realtime';

/**
 * @deprecated
 * @param {string} url The URL to run the Page Speed tests on.
 * @return {Promise<{ domains: number, requests: number, bytes: number, screenshot: string }>}
 */
export async function callPageSpeedInsightsAPI(url) {
  return db.modules.get('callPageSpeed', { url });
}
