//////////Nodetiles

//Express, Common and settings should be used by all sub-modules
var express = require('express'),
    common = require("../../common"),
    settings = require('../../settings');

//Module-specific requires:
var mapnik = require('mapnik'),
    mercator = require('./utils/sphericalmercator.js'),
    parseXYZ = require('./utils/tile.js').parseXYZ,
    path = require('path'),
    fs = require("fs"),
    flow = require('flow');

var TMS_SCHEME = false;

var app = exports.app = express();

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

exports.createPGTileRenderer = flow.define(

    function (table, geom_field, epsgSRID, cartoFile) {

        this.table = table;

        var name;
        var stylepath = __dirname + '/cartocss/';
        var fullpath = "";

        //Set the path to the style file
        if (cartoFile) {
            //Passed in
            fullpath = stylepath + cartoFile;
        }
        else {
            //default
            fullpath = stylepath + table + ".xml";
        }

        var flo = this;

        //See if there is a <tablename>.mss/xml file for this table.
        //See if file exists on disk.  If so, then use it, otherwise, render it and respond.
        fs.stat(fullpath, function (err, stat) {
            if (err) {
                //No file.  Use defaults.
                fullpath = stylepath + "style.xml"; //Default
            }

            flo(fullpath); //flow to next function
        });
    },
    function (fullpath) {
        //Flow from after getting full path to Style file

        //Vacuum Analyze needs to be run on every table in the DB.
        //Also, data should be in 3857 SRID
        var postgis_settings = {
            'host': settings.pg.server,
            'port': settings.pg.port = '5432',
            'dbname': settings.pg.database,
            'table': this.table,
            'user': settings.pg.username,
            'password': settings.pg.password,
            'type': 'postgis',
            'estimate_extent': 'true'
        };

        var _self = this;

        //Create Route for this table
        app.use('/services/tables/' + _self.table + '/dynamicMap', function (req, res) {

            parseXYZ(req, TMS_SCHEME, function (err, params) {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end(err.message);
                } else {
                    try {
                        //create map and layer
                        var map = new mapnik.Map(256, 256, mercator.proj4);
                        var layer = new mapnik.Layer(_self.table, mercator.proj4);
                        var postgis = new mapnik.Datasource(postgis_settings);
                        var bbox = mercator.xyz_to_envelope(parseInt(params.x),
                                                               parseInt(params.y),
                                                               parseInt(params.z), false);

                        layer.datasource = postgis;
                        layer.styles = ['style'];

                        map.bufferSize = 64;
                        map.load(path.join(fullpath), { strict: true }, function (err, map) {
                            if (err) throw err;
                            map.add_layer(layer);

                            // console.log(map.toXML()); // Debug settings

                            map.extent = bbox;
                            var im = new mapnik.Image(map.width, map.height);
                            map.render(im, function (err, im) {
                                if (err) {
                                    throw err;
                                } else {
                                    res.writeHead(200, { 'Content-Type': 'image/png' });
                                    res.end(im.encodeSync('png'));
                                }
                            });
                        });
                    }
                    catch (err) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end(err.message);
                    }
                }
            });
        });

        console.log("Created dynamic service: " + '/services/tables/' + _self.table + '/dynamicMap');
    }
)

//exports.createPGTileRenderer = function (table, geom_field, epsgSRID, cartoCssFile) {
//    var name;

//    if (!cartoCssFile) {
//        //If not passed in, see if there is a <tablename>.mss file for this table.
//        //See if file exists on disk.  If so, then use it, otherwise, render it and respond.
//        fs.stat(__dirname + '/cartocss/' + table + ".mss", function (err, stat) {
//            if (!err) {
//                //Style file exists.
//                cartoCssFile = table + ".mss";
//            } else {
//                //No file.  Use defaults.
//                //otherwise, use the default style.mss
//                cartoCssFile = "style.mss"; //Default
//                name = "default"; //A default class for this table, only used if a style file isn't passed in
//            }

//            /* Create your map context */
//            var map = new nodetiles.Map();

//            map.assetsPath = path.join(__dirname, "cartocss"); //This is the cartoCSS path


//            /* Add some data from PostGIS! */
//            map.addData(new nodetilespostGIS({
//                connectionString: global.conString,
//                tableName: table,
//                geomField: geom_field,
//                projection: "EPSG:" + epsgSRID,
//                name: name //if this is empty, the table name will be used as the class selector
//            }));

//            map.addStyle(fs.readFileSync(__dirname + '/cartocss/' + cartoCssFile, 'utf8'));

//            app.use('/services/tables/' + table + '/dynamicMap', nodetiles.route.tilePng2Disk({ map: map, cachePath: "./public/cached_nodetiles/" + table })); //tilePng2Disk will try to read from cached files on disk. Otherwise, makes the tile.  originally was tilePng
//            console.log("Created dynamic service: " + '/services/tables/' + table + '/dynamicMap');


//        });
//    }
//}

    //This should take in a geoJSON object and create a new route on the fly - return the URL?
exports.createDynamicGeoJSONEndpoint = function (geoJSON, name, epsgSRID, cartoCssFile) {
    //var map = new nodetiles.Map();

    //map.assetsPath = path.join(__dirname, "cartocss"); //This is the cartoCSS path

    ////Adding a static GeoJSON file
    //map.addData(new DynamicGeoJsonSource({
    //    name: "world", //same name used in cartoCSS class (#world)
    //    geoJSONObject: geoJSON,
    //    projection: "EPSG:" + epsgSRID
    //}));

    //map.addStyle(fs.readFileSync(__dirname + '/cartocss/' + cartoCssFile, 'utf8'));

    //app.use('/services/nodetiles/' + name + '/tiles', nodetiles.route.tilePng({ map: map })); // tile.png
    //console.log("Created dynamic service: " + '/services/nodetiles/' + name + '/tiles');
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
