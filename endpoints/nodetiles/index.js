//////////Nodetiles

//Express, Common and settings should be used by all sub-modules
var express = require('express'),
    common = require("../../common"),
    settings = require('../../settings');

//Module-specific requires:
var nodetiles = require('nodetiles-core-cache'),
    nodetilespostGIS = require('../../lib/nodetiles-postgis'),
    GeoJsonSource = nodetiles.datasources.GeoJson,
    DynamicGeoJsonSource = nodetiles.datasources.DynamicGeoJson,
    ShpSource = nodetiles.datasources.Shp,
    Projector = nodetiles.projector,
    path = require('path'),
    fs = require("fs");

var app = exports.app = express();

//This is static.  TODO - make this dynamic
//var tileJson = require(__dirname + '/map/tile');

//var map = new nodetiles.Map();
//map.assetsPath = path.join(__dirname, "cartocss"); //This is the cartoCSS path

////Adding a static GeoJSON file
//map.addData(new GeoJsonSource({
//    name: "world", //same name used in cartoCSS class (#world)
//    path: __dirname + '/map/data/nigeria_hexbins.json',
//    projection: "EPSG:4326"
//}));

//map.addStyle(fs.readFileSync(__dirname + '/cartocss/style.mss', 'utf8'));

//app.set('views', __dirname + '/views');
//app.set('view engine', 'jade');

exports.createCachedFolder = function (table) {
    var folder = './public/cached_nodetiles/' + table;
    //create a folder for this table in public/cached_nodetiles if it doesn't exist
    fs.exists(folder, function (exists) {
        if (exists === false) {
            //make it
            console.log("Didn't find cache folder.  Tyring to make folder: " + folder);
            fs.mkdir(folder, function () {
                console.log("Made " + folder);
            }); //Synch
        }
    });
}


exports.createPGTileRenderer = function (table, geom_field, epsgSRID, cartoCssFile) {
    var name;

    if (!cartoCssFile) {
        //If not passed in, see if there is a <tablename>.mss file for this table.
        //See if file exists on disk.  If so, then use it, otherwise, render it and respond.
        fs.stat(__dirname + '/cartocss/' + table + ".mss", function (err, stat) {
            if (!err) {
                //Style file exists.
                cartoCssFile = table + ".mss";
            } else {
                //No file.  Use defaults.
                //otherwise, use the default style.mss
                cartoCssFile = "style.mss"; //Default
                name = "default"; //A default class for this table, only used if a style file isn't passed in
            }

            /* Create your map context */
            var map = new nodetiles.Map();

            map.assetsPath = path.join(__dirname, "cartocss"); //This is the cartoCSS path


            /* Add some data from PostGIS! */
            map.addData(new nodetilespostGIS({
                connectionString: global.conString,
                tableName: table,
                geomField: geom_field,
                projection: "EPSG:" + epsgSRID,
                name: name //if this is empty, the table name will be used as the class selector
            }));

            map.addStyle(fs.readFileSync(__dirname + '/cartocss/' + cartoCssFile, 'utf8'));

            app.use('/services/tables/' + table + '/dynamicMap', nodetiles.route.tilePng2Disk({ map: map, cachePath: "./public/cached_nodetiles/" + table })); //tilePng2Disk will try to read from cached files on disk. Otherwise, makes the tile.  originally was tilePng
            console.log("Created dynamic service: " + '/services/tables/' + table + '/dynamicMap');


        });
    }
}

    //This should take in a geoJSON object and create a new route on the fly - return the URL?
exports.createDynamicGeoJSONEndpoint = function (geoJSON, name, epsgSRID, cartoCssFile) {
    var map = new nodetiles.Map();

    map.assetsPath = path.join(__dirname, "cartocss"); //This is the cartoCSS path

    //Adding a static GeoJSON file
    map.addData(new DynamicGeoJsonSource({
        name: "world", //same name used in cartoCSS class (#world)
        geoJSONObject: geoJSON,
        projection: "EPSG:" + epsgSRID
    }));

    map.addStyle(fs.readFileSync(__dirname + '/cartocss/' + cartoCssFile, 'utf8'));

    app.use('/services/nodetiles/' + name + '/tiles', nodetiles.route.tilePng({ map: map })); // tile.png
    console.log("Created dynamic service: " + '/services/nodetiles/' + name + '/tiles');
};

    //// Wire up the URL routing
    //app.use('/services/nodetiles/tiles', nodetiles.route.tilePng({ map: map })); // tile.png
    //app.use('/services/nodetiles/utfgrids', nodetiles.route.utfGrid({ map: map })); // utfgrids
    // tile.json: use app.get for the tile.json since we're serving a file, not a directory
    //app.get('/services/nodetiles/tile.json', nodetiles.route.tileJson({ path: __dirname + '/map/tile.json' }));


    //
    // Configure Express routes
    // 
    //app.configure('development', function () {
    //    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

    //    // Backbone routing
    //    app.use('/services/nodetiles/assets', express.static(__dirname + '/assets'));
    //});

    //app.configure('production', function () {
    //    app.use(express.errorHandler());
    //    io.set('log level', 1); // reduce logging

    //    // Backbone routing: compilation step is included in `npm install` script
    //    app.use('/services/nodetiles/app', express.static(__dirname + '/dist/release'));
    //    app.use('/services/nodetiles/assets/js/libs', express.static(__dirname + '/dist/release'));
    //    app.use('/services/nodetiles/assets/css', express.static(__dirname + '/dist/release'));
    //    app.use(express.static(__dirname + '/public'));
    //});


    //// 1. Serve Index.html
    //app.get('/', function (req, res) {
    //    res.sendfile(__dirname + '/index.html');
    //});