//////////Services

//Express, Common and settings should be used by all sub-modules
var express = require('express'),
    common = require("../../common"),
    settings = require('../../settings');


var app = module.exports = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

//Root Request
app.get('/', function (req, res) { res.redirect('/services') });

//Add a route and define response
app.all('/services', function (req, res) {
    var args = {};

    args.view = "services";
    args.breadcrumbs = [{ link: "/services", name: "Home" }];
    args.path = req.path;
    args.host = req.headers.host;

    //object with available services
    var opslist = [
        { link: 'tables', name: 'Table List' },
        { link: 'geoprocessing', name: 'Geoprocessing Operations' },
        { link: 'utilities', name: 'Utilities' }


    ];

    if (settings.tilestream && settings.tilestream.host && settings.tilestream.path) {
        //Add tilestream url if it's in settings file
        opslist.push({ link: 'tiles', name: 'Tilestream Layers' });
    }



    //send to view
    res.render('services', { opslist: opslist, breadcrumbs: [{ link: "", name: "Services" }] });
});