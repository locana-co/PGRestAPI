
/**
 * Module dependencies.
 */
var pg = require('pg');

var express = require('express')
  , http = require('http')
  , path = require('path')
  , settings = require('./settings')
  , common = require("./common");

var app = express();

var routes = [];

//PostGres Connection String
global.conString = "postgres://" + settings.pg.username + ":" + settings.pg.password + "@" + settings.pg.server + ":" + settings.pg.port + "/" + settings.pg.database;

// all environments
app.set('ipaddr', settings.application.ip);
app.set('port', process.env.PORT || settings.application.port);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.enable("jsonp callback");
app.use(express.favicon(path.join(__dirname, 'public/img/favicon.png')));
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
//app.use(express.session());
app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'GPModels')));
app.use("/public/topojson", express.static(path.join(__dirname, 'public/topojson')));

app.use(function (err, req, res, next) {
    console.error(err.stack);
    common.log(err.message);
    res.send(500, 'There was an error with the web service. Please try your operation again.');
    common.log('There was an error with the web servcice. Please try your operation again.');
});

//pull in routes
//TODO - Loop thru endpoints folder and require everything in there
//var services = require('./endpoints/services');
//app.use(services);

var tables = require('./endpoints/tables');
app.use(tables.app);

var tiles = require('./endpoints/tiles');
app.use(tiles);

var geoprocessing = require('./endpoints/geoprocessing');
app.use(geoprocessing);

var utilities = require('./endpoints/utilities');
app.use(utilities);

var mapnik;
try{
    mapnik = require('./endpoints/mapnik');
} catch (e) {
    mapnik = null;
}

if(mapnik) app.use(mapnik.app);


//Create web server
http.createServer(app).listen(app.get('port'), app.get('ipaddr'), function () {
    var startMessage = "Express server listening";

    if (app.get('ipaddr')) {
        startMessage += ' on IP:' + app.get('ipaddr') + ', ';
    }

    startMessage += ' on port ' + app.get('port');

    console.log(startMessage);
});

//Root Request - show table list
app.get('/', function (req, res) { res.redirect('/services/tables') });


if (mapnik)
{
    //look thru all tables in PostGres with a geometry column, spin up dynamic map tile services for each one
    //on startup.  Probably move this to a 'startup' module
    tables.findSpatialTables(function (error, tables) {
        if (error) {

        }
        else {
            if (tables && tables.length > 0) {
                tables.forEach(function (item) {
                    //Spin up a route to serve dynamic tiles for this table
                    mapnik.createPGTileRenderer(item.table, item.geometry_column, item.srid, null);
                    mapnik.createPGTileQueryRenderer(item.table, item.geometry_column, item.srid, null);

                    //Create output folders for each service in public/cached_nodetiles to hold any cached tiles from dynamic service
                    mapnik.createCachedFolder(item.table);
                });
            }
        }
    });
}
