const request = require('request-promise');

/**
 * Get the raw visual progress data of a given html string.
 *
 * @param {string} htmlString The html string to get the data from.
 * @return {array} An array of the raw visual progress data.
 */
function getDataFromHtml(htmlString) {
  const regex = /google\.visualization\.arrayToDataTable(((.|\n)*?));/gm;
  const matchArray = regex.exec(htmlString);
  const dataString = matchArray ? matchArray[1] : null;
  const data = dataString ? eval(dataString) : null;

  // Remove the first item of the data array because it has irrelevant data like "Time (ms)"
  data.shift();
  return data;
}

/**
 * Calculate first meaningful paint based on the given data.
 *
 * @param {array} data An Array of visual progress raw data.
 * @return {number} The first meaningful paint value.
 */
function calculateFMP(data) {
  let firstMeaningfulPaint = 0;
  let highestDiff = 0;

  if (!data) {
    return firstMeaningfulPaint;
  }

  if (data.length === 1) {
    return data[0][0];
  }

  for (let i = 1; i < data.length; i += 1) {
    const diff = data[i][1] - data[i - 1][1];

    if (diff > highestDiff) {
      highestDiff = diff;
      [firstMeaningfulPaint] = data[i - 1];
    }
  }

  return (parseFloat(firstMeaningfulPaint) * 1000).toString();
}

exports.call = (db, data) => {
  const { testId } = data;
  const url = `http://ec2-18-195-220-131.eu-central-1.compute.amazonaws.com/video/compare.php?tests=${testId}`;
  return request(url)
    .then((htmlString) => {
      const dataArray = getDataFromHtml(htmlString);

      return calculateFMP(dataArray);
    })
    .catch((err) => {
      throw new Abort(err.mesage);
    });
};
