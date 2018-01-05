/* eslint-disable comma-dangle */
/* global Abort */
const { parse } = require('url');
const credentials = require('./credentials');

const DEFAULT_TIMEOUT = 30;
const DEFAULT_ACTIVITY_TIMEOUT = 75;

/**
 * @param {string} url             The competitor's URL to test.
 * @param {number} activityTimeout The activity timeout.
 * @param {number} timeout         The timeout.
 * @return {string}                The created Web Page Test script.
 */
function createCompetitorTestScript(url, {
  activityTimeout = DEFAULT_ACTIVITY_TIMEOUT,
  timeout = DEFAULT_TIMEOUT,
}) {
  return `
    block /sw.js /sw.php
    setActivityTimeout ${activityTimeout}
    setTimeout ${timeout}
    navigate ${url}
  `;
}

/**
 * @param {string} url                    The competitor's URL to test.
 * @param {boolean} isSpeedKitComparison  Whether the competitor is running Speed Kit.
 * @param {string} speedKitConfig         The serialized speedkit config string.
 * @param {number} activityTimeout        The activity timeout.
 * @param {number} timeout                The timeout.
 * @return {string}                       The created Web Page Test script.
 */
function createSpeedKitTestScript(url, isSpeedKitComparison, speedKitConfig, {
  activityTimeout = DEFAULT_ACTIVITY_TIMEOUT,
  timeout = DEFAULT_TIMEOUT,
}) {
  let hostname;
  let protocol;
  try {
    ({ hostname, protocol } = parse(url));
  } catch (e) {
    throw new Abort(`Invalid Url specified: ${e.message}`);
  }

  // The URL to call to install the SW
  const installSpeedKitUrl = `${protocol}//${hostname}/install-speed-kit?config=${encodeURIComponent(speedKitConfig)}`;

  // SW always needs to be installed
  return `
    setActivityTimeout ${activityTimeout}
    
    logData 0
    setTimeout ${timeout}
    ${!isSpeedKitComparison ? `setDns ${hostname} ${credentials.makefast_ip}` : ''}
    ${isSpeedKitComparison ? `blockDomainsExcept ${hostname}` : ''}
    navigate ${installSpeedKitUrl}
    ${isSpeedKitComparison ? 'blockDomainsExcept' : ''}
    
    navigate about:blank
    logData 1
    setTimeout ${timeout}
    navigate ${url}
  `;
}

/**
 * Creates a Web Page Test script to execute.
 *
 * @param {string} url                    The URL to create the test script for.
 * @param {boolean} isTestWithSpeedKit    Whether to test with Speed Kit enabled.
 * @param {boolean} isSpeedKitComparison  Whether the competitor is running Speed Kit.
 * @param {string} speedKitConfig         The serialized speedkit config string.
 * @param {number} activityTimeout        The activity timeout.
 * @param {number} timeout                The timeout.
 * @return {string}                       The created Web Page Test script.
 */
function createTestScript(
  url,
  isTestWithSpeedKit,
  isSpeedKitComparison,
  speedKitConfig,
  activityTimeout = DEFAULT_ACTIVITY_TIMEOUT,
  timeout = DEFAULT_TIMEOUT
) {
  if (isTestWithSpeedKit) {
    return createSpeedKitTestScript(url, isSpeedKitComparison, speedKitConfig, { activityTimeout, timeout });
  }

  return createCompetitorTestScript(url, { activityTimeout, timeout });
}

exports.createTestScript = createTestScript;
