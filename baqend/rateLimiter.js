const NodeCache = require( "node-cache" );
const cache = new NodeCache( { stdTTL: 600, checkperiod: 600, useClones : false } );
const RateLimiter = require('limiter').RateLimiter;

/**
 * Checks if an IP address is rate-limited.
 *
 * @param req the request object containing the IP
 * @param reqPerMinute allowed requests per minute
 * @returns {boolean} true if the user is rate limited
 */
exports.isRateLimited = (req, reqPerMinute = 4) => {
    const ip = req.get('X-Forwarded-For');
    //Do not block Baqend
    if(ip.includes('134.100.11.49'))
        return false;
    let limiter = cache.get(ip);
    if(limiter === undefined) {
        limiter = new RateLimiter(reqPerMinute, 'minute', true);
        cache.set(ip, limiter);
    }
    return !limiter.tryRemoveTokens(1);
};