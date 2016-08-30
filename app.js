/**
 * Module dependencies.
 */

var settings
//if settings.js doesn't exist, let the user know and exit
try {
  settings = require('./settings/settings.js');
} catch (e) {
  console.log("No settings.js file detected in settings folder.  Try copying the settings/settings.js.example to settings/settings.js and add in settings.");
  return;
}

var pg = require('pg'),
  express = require('express'),
  http = require('http'),
  path = require('path'),
  settings = require('./settings/settings'),
  common = require("./common"),
  cors = require('cors'),
  fs = require("fs"),
  _ = require("underscore"),
  https = require('https');
  app = express();

//PostGres Connection String
global.conString = "postgres://" + settings.pg.username + ":" + settings.pg.password + "@" + settings.pg.server + ":" + settings.pg.port + "/" + settings.pg.database;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; //fixes stream.js:94 UNABLE_TO_VERIFY_LEAF_SIGNATURE problem when using SSL

// all environments
app.set('ipaddr', settings.application.ip);
app.set('port', process.env.PORT || settings.application.port);
if (process.env.PORT) {
  settings.application.port = process.env.PORT;
}
app.set('views', 'shared_views');
app.set('view engine', 'jade');
app.set('trust proxy', true);
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

var whitelist = settings.cors.whitelist
console.log(whitelist)
var corsOptions = {
    origin: function(origin, callback){
    if (origin){
        var originIsWhitelisted = whitelist.indexOf(origin) !== -1;
        console.log(originIsWhitelisted)
        callback(originIsWhitelisted ? null : 'Bad Request', originIsWhitelisted);
    } else {
        callback (null, { origin: false });
    }
  }
};

//This must be after app.use(passport.initialize())
app.use(cors(corsOptions));
app.use(app.router);


//Load in all endpoint routes
//Root Request - show table list
app.get('/', passport.authenticationFunctions, function (req, res) {
  res.redirect('/services');
});

//Keep a list of services that are active
var services = [];

//TODO - Loop thru endpoints folder and require everything in there
var tiles;
try {
  tiles = require('./endpoints/tiles');
  services.push({ name: "Static Vector Tile Services", link: "/services/vector-tiles" });
  services.push({ name: "Static Image Tile Services", link: "/services/image-tiles" });
} catch (e) {
  tiles = null;
  console.log("Mapnik module has an error. Skipping this module. Reason: " + e);
}

if (tiles) {
  app.use(tiles.app(passport));
}

// Disable ALL services endpoint except tiles

//var tables = require('./endpoints/tables');
//app.use(tables.app(passport));
//services.push({ name: "PostGres Table Endpoints", link: "/services/tables" })
//

//var geoprocessing = require('./endpoints/geoprocessing');
//app.use(geoprocessing.app(passport));
//services.push({ name: "Geoprocessing", link: "/services/geoprocessing" })
//
//var utilities = require('./endpoints/utilities');
//app.use(utilities.app(passport));
//services.push({ name: "Utilities", link: "/services/utilities" })

//var datablaster;
//try {
//  datablaster = require('./endpoints/datablaster');
//
//} catch (e) {
//  datablaster = null;
//  console.log("Datablaster not properly installed. Skipping. Reason: No blast_config.js file found in endpoints/datablaster");
//}
//
//if (datablaster)
//  app.use(datablaster.app(passport));


//Create default /services route
//app.all('/services', function (req, res) {
//  //Display default page with list of services
//  var args = common.getArguments(req);
//
//  args.view = "services_list";
//  args.path = req.path;
//  args.host = settings.application.publichost || req.headers.host;
//  args.link = (req.secure ? "https:" : "http:") + "//" + args.host + "/services";
//  args.services = services;
//
//  common.respond(req, res, args);
//});



//Configure HTTPS if present
if(settings.ssl && settings.ssl.pfx && settings.ssl.password){
  //Use HTTPS
  var SSLoptions = {
    pfx: fs.readFileSync(settings.ssl.pfx),
    passphrase: settings.ssl.password
  };

  //Create web server (https)
  https.createServer(SSLoptions, app).listen(app.get('port'), app.get('ipaddr'), function() {
    var startMessage = "SpatialServer listening (HTTPS)";

    if (app.get('ipaddr')) {
      startMessage += ' on IP:' + app.get('ipaddr') + ', ';
    }

    startMessage += ' on port ' + app.get('port');

    console.log(startMessage);
  });

}else{
  //Use HTTP
  //Create web server
  http.createServer(app).listen(app.get('port'), app.get('ipaddr'), function () {
    var startMessage = "SpatialServer listening";

    if (app.get('ipaddr')) {
      startMessage += ' on IP:' + app.get('ipaddr') + ', ';
    }

    startMessage += ' on port ' + app.get('port');
    console.log(startMessage);
  });
}

//Look for any errors (this signature is for error handling), this is generally defined after all other app.uses.
app.use(function (err, req, res, next) {
  console.error(err.stack);
  common.log(err.message);
  res.send(500, 'There was an error with the web service. Please try your operation again.');
  common.log('There was an error with the web service. Please try your operation again.');
});
