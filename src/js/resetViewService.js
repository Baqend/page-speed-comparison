class ResetVariablesService {

    resetViewFromError() {
        $('#competitor').empty();
        $('#speedKit').empty();
        $('#info').removeClass('hidden');
        $('#testStatus').addClass('hidden');
        $('#runningInfo').addClass('hidden');
        $('#configInfo').removeClass('hidden');
        $('#compareContent').addClass('hidden');
        $('#wListConfig').removeClass('hidden');
        $('#servedRequestsInfo').addClass('hidden');
        $('#modalButton').click();
    }

    resetViewFromSuccess() {
        $('#compareContent').addClass('hidden');
        $('.testResults').addClass('invisible');
        $('#info').addClass('hidden');
        $('#runningInfo').addClass('hidden');
        $('#printButton').addClass('hidden');
        $('#testStatus').removeClass('hidden');
        $('#configInfo').removeClass('hidden');
        $('#statusQueue').html('Initializing test');
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

    resetViewAfterTest() {
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
}
module.exports = ResetVariablesService;
