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
    nodecache = require( "node-cache" );


var app = express();

var routes = [];

//PostGres Connection String
global.conString = "postgres://" + settings.pg.username + ":" + settings.pg.password + "@" + settings.pg.server + ":" + settings.pg.port + "/" + settings.pg.database;

// all environments
app.set('ipaddr', settings.application.ip);
app.set('port', process.env.PORT || settings.application.port);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.enable("jsonp callback"); //TODO: Remove this if not needed because of CORS
app.use(express.favicon(path.join(__dirname, 'public/img/favicon_rc.jpg')));
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());

//Set up a public folder.  
app.use(require('less-middleware')({
	src : __dirname + '/public'
}));

//Items in these folder will be served statically.
app.use(express.static(path.join(__dirname, 'public')));
app.use("/public/topojson", express.static(path.join(__dirname, 'public/topojson')));
app.use('/geo-angular/', express.static('../GeoAngular/app/'));

//Mongoose support for storing authentication credentials
var mongoose, passport;
//try {
//	mongoose = require("mongoose"), passport = require("passport");
//} catch(e) {
//	mongoose = null;
//	passport = null;
//	console.log("Mongoose/MongoDB not properly installed. Skipping. Also not using Passport. Reason: " + e);
//}

//express app.get can be passed an array of intermediate functions before rendering.
//If passport isn't installed or user hasn't enabled security, then leave the following array empty, otherwise load one or more middleware functions in there.
var authenticationFunctions = []; 

//Load up passport for security, if it's around, and if the settings ask for it
if (mongoose && passport && settings.enableSecurity && settings.enableSecurity === true) {
	
	require('./endpoints/authentication/app/models/user.js');

	var env = process.env.NODE_ENV || 'development', mongo_config = require('./endpoints/authentication/config/config')[env];

	mongoose.connect(settings.mongodb.db);

	require('./endpoints/authentication/config/passport')(passport, mongo_config);

	app.use(express.session({
		secret : mongo_config.epxressSessionSecret
	}));
	
	app.use(passport.initialize());
	app.use(passport.session()); //TODO:  I keep reading that express sessions aren't needed if using passport with authentication followed by token bearer strategy
	
	//add the bearer authentication method into an object holding various types of authenticaion methods
	//use this in a route as middleware when a token is the preferred method of authorization
	authenticationFunctions.push(passport.authenticate('bearer', { session: false, failureRedirect: '/login'}));
	
	//For now, just cram this object into the passport object as a stowaway so it can be passed into all of the external route definitions
	passport.authenticationFunctions = authenticationFunctions;
	
	require('./endpoints/authentication/config/routes')(app, passport); //Adding the login routes
}
else{
	//keep an empty authentication functions property here
	passport = { authenticationFunctions: []}; 
}

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

//Create web server
http.createServer(app).listen(app.get('port'), app.get('ipaddr'), function() {
	var startMessage = "Express server listening";

	if (app.get('ipaddr')) {
		startMessage += ' on IP:' + app.get('ipaddr') + ', ';
	}

	startMessage += ' on port ' + app.get('port');

	console.log(startMessage);
});

//Root Request - show table list
app.get('/', passport.authenticationFunctions, function(req, res) {
	res.redirect('/geo-angular/')
});

//Redirect /services to table list
app.get('/services', function(req, res) {
	res.redirect('/services/tables')
});

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
