const fs = require('fs');
const fetch = require('node-fetch');


const location = process.argv[2];
console.log('Analysing ' + location);


if (/https?:\/\//.test(location)) {
    fetch(location).then(response => {
        return response.json();
    }).then(json => printResult(json.data)).catch(console.error)
} else {
    const file = fs.readFileSync(location, 'utf8');
    const testResult = JSON.parse(file);
    printResult(testResult);
}


function printResult(testResult) {
    let first = true;

    const result = Object.keys(testResult.runs).map(run => {
        return createRun(testResult.runs[run].firstView);
    });

    console.log(JSON.stringify(result, null, '  '));

    /*.forEach(runResult => {
        const props = Object.keys(runResult);

        if (first) {
            console.log(props.join(","));
            first = false;
        }

        console.log('"' + props.map(prop => runResult[prop]).join('","') + '"')

    })*/
}

function createRun(json) {
    const run = {};
    run.loadTime = json.loadTime;
    run.ttfb = json.TTFB;
    run.domLoaded = json.domContentLoadedEventStart;
    run.load = json.loadEventStart;
    run.fullyLoaded = json.fullyLoaded;
    run.firstPaint = json.firstPaint;
    run.startRender = json.render;
    run.lastVisualChange = json.lastVisualChange;
    run.speedIndex = json.SpeedIndex;
    run.requests = json.requests.length;
    run.domains = Object.keys(json.domains).length;
    run.bytes = json.bytesIn;
//run.hits = new db.Hits(countHits(json));
    run.domElements = json.domElements;
    run.basePageCDN = json.base_page_cdn;
    return run;
}
