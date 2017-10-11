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
    $('#runningInfo').addClass('hidden');
    $('#printButton').addClass('hidden');
    $('#testStatus').addClass('hidden');
    $('#warningAlert').addClass('hidden');
    $('#showTestPool').addClass('hidden');
    $('#boostWorthiness').addClass('hidden');
    $('#competitorLink').addClass('hidden');
    $('#competitorLink').empty();
    $('#speedKitLink').addClass('hidden');
    $('#speedKitLink').empty();
    $('#info').removeClass('hidden');
    $('#configInfo').removeClass('hidden');
    $('#competitor').empty();
    $('#speedKit').empty();
    $('#whitelistCandidates').empty();
    $('#whitelist').addClass('hidden');
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
}

export function resetViewAfterTest() {
    $('.infoBox').fadeOut(1000);
    $('#info').removeClass('hidden');
    $('#informationContent').removeClass('hidden');
    $('#boostWorthiness').removeClass('hidden');
    $('#configInfo').removeClass('hidden');
    $('#printButton').removeClass('hidden');
    $('#whitelist').removeClass('hidden');
    $('#testStatus').addClass('hidden');
    $('#runningInfo').addClass('hidden');
    $('#competitorLink').removeClass('hidden');
    $('#speedKitLink').removeClass('hidden');
}

export function resetViewAfterBadTestResult() {
    $('#compareContent').removeClass('hidden');
    $('.infoBox').fadeOut(1000);
    $('.hideOnError').addClass('hidden');
    $('.hideOnDefault').removeClass('hidden');
    $('.hideContact').removeClass('hidden');
    $('#info').removeClass('hidden');
    $('#informationContent').removeClass('hidden');
    $('#testStatus').addClass('hidden');
    $('#runningInfo').addClass('hidden');
    $('#configInfo').removeClass('hidden');
    $('#competitor').empty();
    $('#speedKit').empty();
    $('#boostWorthiness').addClass('hidden');
    $('#printButton').addClass('hidden');
}

export function showExamples() {
    resetView();
    $('#compareContent').removeClass('hidden');
    $('.hideOnError').addClass('hidden');
    $('#informationContent').removeClass('hidden');
}
