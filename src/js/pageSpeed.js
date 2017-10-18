import { db } from 'baqend/realtime';

/**
 * @deprecated
 * @param {string} url The URL to run the Page Speed tests on.
 * @param {boolean} mobile Execute the test as a mobile client.
 * @return {Promise<{ domains: number, requests: number, bytes: number, screenshot: string }>}
 */
export async function callPageSpeedInsightsAPI(url, mobile) {
  return db.modules.get('callPageSpeed', { url, mobile });
}
