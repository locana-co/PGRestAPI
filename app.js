/**
 * Module dependencies.
 */
var pg = require('pg');

var express = require('express'),
    http = require('http'),
    path = require('path'),
    settings = require('./settings'),
    common = require("./common"),
    cors = require('cors'),
    fs = require("fs"),
    _ = require("underscore"),
    https = require('https');


var app = express();

var routes = [];

//PostGres Connection String
global.conString = "postgres://" + settings.pg.username + ":" + settings.pg.password + "@" + settings.pg.server + ":" + settings.pg.port + "/" + settings.pg.database;

// all environments
app.set('ipaddr', settings.application.ip);
app.set('port', process.env.PORT || settings.application.port);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('trust proxy', true);
app.enable("jsonp callback"); //TODO: Remove this if not needed because of CORS
app.use(express.favicon(path.join(__dirname, 'public/img/favicon_rc.jpg')));
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.methodOverride());


var passport = require('./endpoints/authentication').passport();

//express app.get can be passed an array of intermediate functions before rendering.
//If passport isn't installed or user hasn't enabled security, then leave the following array empty, otherwise load one or more middleware functions in there.
var authenticationFunctions = []; 

//Load up passport for security, if it's around, and if the settings ask for it
if (passport && settings.enableSecurity && settings.enableSecurity === true) {

  if (process.env.NODE_ENV.toLowerCase() == "production") {
    //Configure HTTPS
    var SSLoptions = {
      pfx: fs.readFileSync(settings.ssl.pfx),
      passphrase: settings.ssl.password
    };
  }

	app.use(express.session({
	    secret : settings.expressSessionSecret
	}));
	
	app.use(passport.initialize());
	app.use(passport.session()); //TODO:  I keep reading that express sessions aren't needed if using passport with authentication followed by token bearer strategy

    authenticationFunctions.push(passport.authenticate('forcedotcom'));
	
	//For now, just cram this object into the passport object as a stowaway so it can be passed into all of the external route definitions
	//passport.authenticationFunctions = authenticationFunctions;

    passport.authenticationFunctions = [];

    //Add a route to test OAUTH2
    app.get('/mapfolio/salesforcelogin', passport.authenticate('forcedotcom'));

    // this should match the callbackURL parameter defined in config:
    app.get('/oauth2/callback',
        passport.authenticate('forcedotcom',
        { failureRedirect: '/error' }),
        function(req, res){
            res.redirect('/mapfolio/index.html')
        }
    );

    app.get('/mapfolio/logout', function(req,res){
        req.session.destroy(function (err) {
            res.redirect('/');
        });
    });
}
else{
	//keep an empty authentication functions property here
	passport = { authenticationFunctions: []}; 
}

//Set up a public folder.
app.use(require('less-middleware')({
    src : __dirname + '/public'
}));

//Items in these folder will be served statically.
app.use(express.static(path.join(__dirname, 'public')));
app.use("/public/topojson", express.static(path.join(__dirname, 'public/topojson')));
app.use(ensureAuthenticated);
app.use('/mapfolio/', express.static('../GeoAngular/app/'));

//This must be after app.use(passport.initialize())
app.use(cors());
app.use(app.router);

//Load in all endpoint routes
//TODO - Loop thru endpoints folder and require everything in there
var tables = require('./endpoints/tables');
app.use(tables.app(passport));
//add passport reference

var tiles = require('./endpoints/tiles');
app.use(tiles.app(passport));

var geoprocessing = require('./endpoints/geoprocessing');
app.use(geoprocessing.app(passport));

var custom = require('./endpoints/custom');
app.use(custom.app(passport));

var utilities = require('./endpoints/utilities');
app.use(utilities.app(passport));

var mapnik;
try {
	mapnik = require('./endpoints/mapnik');

} catch (e) {
	mapnik = null;
	console.log("Mapnik not properly installed. Skipping. Reason: " + e);
}

if (mapnik)
	app.use(mapnik.app(passport));


var datablaster;
try {
	datablaster = require('./endpoints/datablaster');

} catch (e) {
	datablaster = null;
	console.log("Datablaster not properly installed. Skipping. Reason: No blast_config.js file found in endpoints/datablaster");
}

if (datablaster)
	app.use(datablaster.app(passport));


if(process.env.NODE_ENV.toLowerCase() == "production"){
    //Create web server (https)
    https.createServer(SSLoptions, app).listen(app.get('port'), app.get('ipaddr'), function() {
        var startMessage = "Express server listening (HTTPS)";

        if (app.get('ipaddr')) {
            startMessage += ' on IP:' + app.get('ipaddr') + ', ';
        }

        startMessage += ' on port ' + app.get('port');

        console.log(startMessage);
    });
}
else{
    //Create web server (http)
    http.createServer(app).listen(app.get('port'), app.get('ipaddr'), function() {
        var startMessage = "Express server listening";

        if (app.get('ipaddr')) {
            startMessage += ' on IP:' + app.get('ipaddr') + ', ';
        }

        startMessage += ' on port ' + app.get('port');

        console.log(startMessage);
    });
}


//Root Request - show application
app.get('/', function(req, res) {
    res.redirect('/mapfolio/index.html');
});

//Mapfolio Root Request - show application
//app.use('/mapfolio/', function(req, res) {
//    res.redirect('/mapfolio/index.html');
//});

//Redirect /services to table list
app.get('/services', function(req, res) {
	res.redirect('/services/tables')
});

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.

function ensureAuthenticated(req, res, next) {

    //If the request is for index.html, then lock it down.
    if (settings.enableSecurity && ( req.path.indexOf("index.html") > -1 || req.path == "/mapfolio/" )) {
        //All other requests to the mapfolio folder should be allowed.

        //check for authentication
        //req.isAuthenticated() - always returns false.
        if(req.session && req.session.passport && req.session.passport.user) {
            return next();
        }
        else{
            res.redirect('/mapfolio/login.html');
            return;
        }
    }

    return next();
}


//Look for any errors (this signature is for error handling), this is generally defined after all other app.uses.
app.use(function(err, req, res, next) {
    console.error(err.stack);
    common.log(err.message);
    res.send(500, 'There was an error with the web service. Please try your operation again.');
    common.log('There was an error with the web service. Please try your operation again.');
});

//look thru all tables in PostGres with a geometry column, spin up dynamic map tile services for each one
//on startup.  Probably move this to a 'startup' module
//common.vacuumAnalyzeAll();
tables.findSpatialTables(app, function(error, tables) {
	if (error) {
		console.log(error);
	} else {
		if (tables) {
			Object.keys(tables).forEach(function(key) {
				var item = tables[key];
				if (mapnik) {
					//Spin up a route to serve dynamic tiles for this table
					mapnik.createPGTileRenderer(app, item.table, item.geometry_column, item.srid, null);
					mapnik.createPGTileQueryRenderer(app, item.table, item.geometry_column, item.srid, null);

					//Create output folders for each service in public/cached_nodetiles to hold any cached tiles from dynamic service
					mapnik.createCachedFolder(item.table);
				}
                else{
                    common.log("Tables read, but no Mapnik.  Server ready.")
                }
			});
		}
	}
});
