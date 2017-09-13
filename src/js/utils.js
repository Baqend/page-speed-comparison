/**
 * @param {number} bytes The file size in bytes to format.
 * @param {number} [decimals] The number of decimals
 * @return {string}
 */
export function formatFileSize(bytes, decimals) {
    if (bytes === 0) return '0 Bytes';
    const k = 1000;
    const dm = decimals || 2;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Lets the VM sleep for a given time.
 *
 * @param {number} millis The time to sleep in milliseconds.
 * @return {Promise<void>} A promise which resolves when we wake up.
 */
export function sleep(millis) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}

/**
 * Verify whether the device is IOS or not
 */
export function isDeviceIOS() {
    return navigator.userAgent.match(/iPhone|iPod/i);
}
