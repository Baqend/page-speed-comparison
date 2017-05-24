import '../styles/main.scss'
import * as hbs from '../templates'

const data = {};

document.addEventListener("DOMContentLoaded", function() {
    $("#main").html(hbs.main(data))
});
