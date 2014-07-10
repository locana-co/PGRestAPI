/**
 * Module dependencies.
 */

var settings
//if settings.js doesn't exist, let the user know and exit
try{
    settings = require('./settings.js');
}catch(e){
   console.log("No settings.js file detected in root.  Try copying the settings.js.example to settings.js and add in settings.");
    return;
}


var pg = require('pg');

var express = require('express'),
    http = require('http'),
    path = require('path'),
    settings = require('./settings'),
    common = require("./common"),
    cors = require('cors');

    var app = express();

    //PostGres Connection String
    global.conString = "postgres://" + settings.pg.username + ":" + settings.pg.password + "@" + settings.pg.server + ":" + settings.pg.port + "/" + settings.pg.database;

    // all environments
    app.set('ipaddr', settings.application.ip);
    app.set('port', process.env.PORT || settings.application.port);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    //app.set('trust proxy', true);
    app.enable("jsonp callback"); //TODO: Remove this if not needed because of CORS
    app.use(express.favicon(path.join(__dirname, 'public/img/favicon.png')));
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser('eobfgl-shoe'));
    app.use(express.session());

    //Set up a public folder.
    app.use(require('less-middleware')({
        src: __dirname + '/public'
    }));

    //Items in these folders will be served statically.
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.static(path.join(__dirname, 'GPModels')));

    //support for storing authentication credentials
    var passport = { authenticationFunctions: []};

    //This must be after app.use(passport.initialize())
    app.use(cors());
    app.use(app.router);



  //Load in all endpoint routes
  //Root Request - show table list
    app.get('/', passport.authenticationFunctions, function (req, res) {
        res.redirect('/services/tables');
    });

//Redirect /services to table list
    app.get('/services', function (req, res) {
        res.redirect('/services/tables');
    });

//TODO - Loop thru endpoints folder and require everything in there
    var tables = require('./endpoints/tables');
    app.use(tables.app(passport));

    var tilestream = require('./endpoints/tilestream');
    app.use(tilestream.app(passport));

    var geoprocessing = require('./endpoints/geoprocessing');
    app.use(geoprocessing.app(passport));

    var utilities = require('./endpoints/utilities');
    app.use(utilities.app(passport));

    var tiles, vectorTiles;
    try {
        tiles = require('./endpoints/tiles')
        vectorTiles = require('./endpoints/vectortiles');

    } catch (e) {
        tiles = null;
        console.log("Mapnik module has an error. Skipping this module. Reason: " + e);
    }

    if (tiles) {
        app.use(tiles.app(passport));
        app.use(vectorTiles.app(passport));
    }


    var datablaster;
    try {
        datablaster = require('./endpoints/datablaster');

    } catch (e) {
        datablaster = null;
        console.log("Datablaster not properly installed. Skipping. Reason: No blast_config.js file found in endpoints/datablaster");
    }

    if (datablaster)
        app.use(datablaster.app(passport));

//Create web server
    http.createServer(app).listen(app.get('port'), app.get('ipaddr'), function () {
        var startMessage = "Chubbs server listening";

        if (app.get('ipaddr')) {
            startMessage += ' on IP:' + app.get('ipaddr') + ', ';
        }

        startMessage += ' on port ' + app.get('port');

        console.log(startMessage);
    });

//Look for any errors (this signature is for error handling), this is generally defined after all other app.uses.
    app.use(function (err, req, res, next) {
        console.error(err.stack);
        common.log(err.message);
        res.send(500, 'There was an error with the web service. Please try your operation again.');
        common.log('There was an error with the web servcice. Please try your operation again.');
    });
