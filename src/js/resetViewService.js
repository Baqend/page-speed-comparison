class ResetVariablesService {

    resetViewFromError() {
        $('#competitor').empty();
        $('#speedKit').empty();
        $('#info').removeClass('hidden');
        $('#testStatus').addClass('hidden');
        $('#runningInfo').addClass('hidden');
        $('#configInfo').removeClass('hidden');
        $('#numberOfHostsCol').addClass('invisible');
        $('#numberOfRequestsCol').addClass('invisible');
        $('#numberOfBytesCol').addClass('invisible');
        $('#compareContent').addClass('invisible');
        $('#wListConfig').removeClass('invisible');
        $('#modalButton').click();
    }

    resetViewFromSuccess() {
        $('#numberOfHostsCol').addClass('invisible');
        $('#numberOfRequestsCol').addClass('invisible');
        $('#numberOfBytesCol').addClass('invisible');
        $('#compareContent').addClass('invisible');
        $('.testResults').addClass('invisible');
        $('#info').addClass('hidden');
        $('#runningInfo').addClass('hidden');
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
    }
}
module.exports = ResetVariablesService;