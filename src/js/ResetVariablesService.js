export function showInfoBox() {
    $('.infoBox').fadeIn(1000);
}

export function startTest() {
    showInfoBox();
    $('.hideOnError').removeClass('hidden');
    $('.hideOnDefault').addClass('hidden');
    $('.hideContact').addClass('hidden');
    $('#currentVendorUrlInvalid').addClass('hidden');
    $('#info').addClass('hidden');
    $('#statusQueue').html('Initializing test');
    $('#testStatus').removeClass('hidden');
    $('#configInfo').addClass('hidden');
    $('#runningInfo').removeClass('hidden');
}

export function resetView() {
    $('#confirmContact').addClass('hidden');
    $('#compareContent').addClass('hidden');
    $('.testResults').addClass('invisible');
    $('#info').removeClass('hidden');
    $('#runningInfo').addClass('hidden');
    $('#printButton').addClass('hidden');
    $('#testStatus').addClass('hidden');
    $('#warningMessage').addClass('hidden');
    $('#configInfo').removeClass('hidden');
    $('#competitor').empty();
    $('#speedKit').empty();
    $('#competitor-speedIndex').html('');
    $('#competitor-ttfb').html('');
    $('#competitor-dom').html('');
    $('#competitor-lastVisualChange').html('');
    $('#competitor-fullyLoaded').html('');
    $('#speedKit-speedIndex').html('');
    $('#speedKit-ttfb').html('');
    $('#speedKit-dom').html('');
    $('#speedKit-lastVisualChange').html('');
    $('#speedKit-fullyLoaded').html('');
    $('#speedIndex-factor').html('');
    $('#ttfb-factor').html('');
    $('#dom-factor').html('');
    $('#lastVisualChange-factor').html('');
    $('#fullyLoaded-factor').html('');
    $('#servedRequestsInfo').addClass('hidden');
}

export function resetViewAfterTest() {
    $('.infoBox').fadeOut(1000);
    $('#info').removeClass('hidden');
    $('#informationContent').removeClass('hidden');
    $('#testStatus').addClass('hidden');
    $('#runningInfo').addClass('hidden');
    $('#configInfo').removeClass('hidden');
    $('#printButton').removeClass('hidden');
    $('#wListConfig').removeClass('hidden');
    $('#servedRequestsInfo').removeClass('hidden');
}

export function resetViewAfterBadTestResult() {
    $('#compareContent').removeClass('hidden');
    $('.infoBox').fadeOut(1000);
    $('.hideOnError').addClass('hidden');
    $('.hideOnDefault').removeClass('hidden');
    $('.hideContact').removeClass('hidden');
    $('#warningMessage').removeClass('hidden');
    $('#info').removeClass('hidden');
    $('#informationContent').removeClass('hidden');
    $('#testStatus').addClass('hidden');
    $('#runningInfo').addClass('hidden');
    $('#configInfo').removeClass('hidden');
    $('#competitor').empty();
    $('#speedKit').empty();
    $('#printButton').addClass('hidden');
    $('#wListConfig').addClass('hidden');
}
