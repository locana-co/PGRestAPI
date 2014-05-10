//////////Nodetiles

//Common and settings should be used by all sub-modules
var express = require('express'), common = require("../../common"), settings = require('../../settings');

//Module-specific requires:
var mapnik = require('mapnik'),
mercator = require('../../utils/sphericalmercator.js'), // 3857
geographic = require('../../utils/geographic.js'), //4326
parseXYZ = require('../../utils/tile.js').parseXYZ,
path = require('path'),
fs = require("fs"),
flow = require('flow'),
carto = require('carto');

var TMS_SCHEME = false;
var styleExtension = '.xml';

exports.app = function (passport) {
    var app = express();
    //Not yet uesd    

    return app;
}

exports.createCachedFolder = function (table) {
    var folder = './public/cached_nodetiles/' + table;
    //create a folder for this table in public/cached_nodetiles if it doesn't exist
    fs.exists(folder, function (exists) {
        if (exists === false) {
            //make it
            console.log("Didn't find cache folder.  Tyring to make folder: " + folder);
            fs.mkdir(folder, function () {
                console.log("Made " + folder);
            });
            //Synch
        }
    });
}
//Create a static renderer that will always use the default styling
exports.createPGTileRenderer = flow.define(function (app, table, geom_field, epsgSRID, cartoFile) {

    this.app = app;
    this.table = table;
    this.epsg = epsgSRID;

    var name;
    var stylepath = __dirname + '/cartocss/';
    var fullpath = "";

    //Set the path to the style file
    if (cartoFile) {
        //Passed in
        fullpath = stylepath + cartoFile;
    } else {
        //default
        fullpath = stylepath + table + styleExtension;
    }

    var flo = this;

    //See if there is a <tablename>.mss/xml file for this table.
    //See if file exists on disk.  If so, then use it, otherwise, render it and respond.
    fs.stat(fullpath, function (err, stat) {
        if (err) {
            //No file.  Use defaults.
            fullpath = stylepath + "style.xml";
            //Default
        }

        flo(fullpath);
        //flow to next function
    });
}, function (fullpath) {
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
    this.app.use('/services/tables/' + _self.table + '/dynamicMap', function (req, res) {

        parseXYZ(req, TMS_SCHEME, function (err, params) {
            if (err) {
                res.writeHead(500, {
                    'Content-Type': 'text/plain'
                });
                res.end(err.message);
            } else {
                try {
                    //create map and layer
                    var map = new mapnik.Map(256, 256, mercator.proj4);
                    var layer = new mapnik.Layer(_self.table, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
                    //check to see if 3857.  If not, assume WGS84
                    var postgis = new mapnik.Datasource(postgis_settings);
                    var bbox = mercator.xyz_to_envelope(parseInt(params.x), parseInt(params.y), parseInt(params.z), false);

                    layer.datasource = postgis;
                    layer.styles = [_self.table, 'style'];

                    map.bufferSize = 64;
                    map.load(path.join(fullpath), {
                        strict: true
                    }, function (err, map) {
                        if (err)
                            throw err;
                        map.add_layer(layer);

                        console.log(map.toXML());
                        // Debug settings

                        map.extent = bbox;
                        var im = new mapnik.Image(map.width, map.height);
                        map.render(im, function (err, im) {
                            if (err) {
                                throw err;
                            } else {
                                res.writeHead(200, {
                                    'Content-Type': 'image/png'
                                });
                                res.end(im.encodeSync('png'));
                            }
                        });
                    });
                } catch (err) {
                    res.writeHead(500, {
                        'Content-Type': 'text/plain'
                    });
                    res.end(err.message);
                }
            }
        });
    });

    console.log("Created dynamic service: " + '/services/tables/' + _self.table + '/dynamicMap');
})
//Create a renderer that will accept dynamic queries and styling and bring back a single image to fit the map's extent.
exports.createPGTileQueryRenderer = flow.define(function (app, table, geom_field, epsgSRID, cartoFile) {

    this.app = app;
    this.table = table;
    this.geom_field = geom_field;
    this.epsg = epsgSRID;

    var name;
    var stylepath = __dirname + '/cartocss/';
    var fullpath = "";

    //Set the path to the style file
    if (cartoFile) {
        //Passed in
        fullpath = stylepath + cartoFile;
    } else {
        //default
        fullpath = stylepath + table + styleExtension;
    }

    var flo = this;

    //See if there is a <tablename>.mml file for this table.
    //See if file exists on disk.  If so, then use it, otherwise, render it and respond.
    fs.stat(fullpath, function (err, stat) {
        if (err) {
            //No file.  Use defaults.
            fullpath = stylepath + "style" + styleExtension;
            ; //Default
        }

        flo(fullpath);
        //flow to next function
    });
}, function (fullpath) {
    //Flow from after getting full path to Style file

    var _self = this;

    //Create Route for this table
    this.app.use('/services/tables/' + _self.table + '/dynamicQueryMap', function (req, res) {

        //Check for correct args
        //Needs: width (px), height (px), bbox (xmin, ymax, xmax, ymin), where, optional styling
        var args = {};

        //Grab POST or QueryString args depending on type
        if (req.method.toLowerCase() == "post") {
            //If a post, then arguments will be members of the this.req.body property
            args = req.body;
        } else if (req.method.toLowerCase() == "get") {
            //If request is a get, then args will be members of the this.req.query property
            args = req.query;
        }

        // check to see if args were provided
        if (JSON.stringify(args) != '{}') {
            //are all mandatory args provided?
            var missing = "Please provide"
            var missingArray = [];
            if (!args.width) {
                missingArray.push("width");
            }

            if (!args.height) {
                missingArray.push("height");
            }

            if (!args.bbox) {
                missingArray.push("bbox");
            }

            if (missingArray.length > 0) {
                missing += missingArray.join(", ");
                //respond with message.
                res.writeHead(500, {
                    'Content-Type': 'text/plain'
                });
                res.end(missing);
                return;
            }

            //If user passes in where clause, then build the query here and set it with the table property of postgis_settings
            if (args.where) {
                //Validate where - TODO
            }

            //Vacuum Analyze needs to be run on every table in the DB.
            //Also, data should be in 3857 SRID
            var postgis_settings = {
                'host': settings.pg.server,
                'port': settings.pg.port = '5432',
                'dbname': settings.pg.database,
                'table': (args.where ? "(SELECT " + _self.geom_field + " from " + _self.table + " WHERE " + args.where + ") as " + _self.table : _self.table),
                'user': settings.pg.username,
                'password': settings.pg.password,
                'type': 'postgis',
                'estimate_extent': 'true'
            };

            //We're all good. Make the picture.
            try {
                //create map and layer
                var map = new mapnik.Map(parseInt(args.width), parseInt(args.height), mercator.proj4);
                //width, height
                var layer = new mapnik.Layer(_self.table, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
                //check to see if 3857.  If not, assume WGS84
                var postgis = new mapnik.Datasource(postgis_settings);

                var floatbbox = args.bbox.split(",");

                var bbox = [floatbbox[0], floatbbox[1], floatbbox[2], floatbbox[3]];
                //ll lat, ll lon, ur lat, ur lon

                layer.datasource = postgis;
                layer.styles = [_self.table, 'style'];

                map.bufferSize = 64;

                map.load(path.join(fullpath), {
                    strict: true
                }, function (err, map) {
                    console.log(map.toXML());
                    // Debug settings

                    if (err)
                        throw err;
                    map.add_layer(layer);

                    map.extent = bbox;
                    var im = new mapnik.Image(map.width, map.height);
                    map.render(im, function (err, im) {

                        if (err) {
                            throw err;
                        } else {
                            res.writeHead(200, {
                                'Content-Type': 'image/png'
                            });
                            res.end(im.encodeSync('png'));
                        }
                    });
                });
            } catch (err) {
                res.writeHead(500, {
                    'Content-Type': 'text/plain'
                });
                res.end(err.message);
            }

        } else {
            //if no args, pass to regular tile renderer

        }
    });

    console.log("Created dynamic query service: " + '/services/tables/' + _self.table + '/dynamicQueryMap');
})
//Create a renderer that will accept dynamic GeoJSON Objects and styling and bring back a single image to fit the map's extent.
exports.createGeoJSONQueryRenderer = flow.define(function (app, geoJSON, epsgSRID, cartoFile, id, callback) {

    this.app = app;
    this.geoJSON = geoJSON;
    //this.geom_field = geom_field;
    this.epsg = epsgSRID;

    var _self = this;
    var dynamicURL = '/services/GeoJSONQueryMap/' + id;

    //Create Route for this table - TODO:  Figure out how/when to kill this endpoint
    this.app.use(dynamicURL, function (req, res) {

        //Check for correct args
        //Needs: width (px), height (px), bbox (xmin, ymax, xmax, ymin), where, optional styling
        var args = {};

        //Grab POST or QueryString args depending on type
        if (req.method.toLowerCase() == "post") {
            //If a post, then arguments will be members of the this.req.body property
            args = req.body;
        } else if (req.method.toLowerCase() == "get") {
            //If request is a get, then args will be members of the this.req.query property
            args = req.query;
        }

        // check to see if args were provided
        if (JSON.stringify(args) != '{}') {
            //are all mandatory args provided?
            var missing = "Please provide";
            var missingArray = [];
            if (!args.width) {
                missingArray.push("width");
            }

            if (!args.height) {
                missingArray.push("height");
            }

            if (!args.bbox) {
                missingArray.push("bbox");
            }

            if (missingArray.length > 0) {
                missing += missingArray.join(", ");
                //respond with message.
                res.writeHead(500, {
                    'Content-Type': 'text/plain'
                });
                res.end(missing);
                return;
            }

            //If user passes in geojson
            if (args.geojson) {
                //Validate where - TODO
            }

            //make a temporary geojson file for mapnik (until I figure out how to pass in an object)
            common.writeGeoJSONFile(geoJSON, id, function (err, filename, fullpath) {

                if (err) {
                    //TODO: Handle this.
                    return;
                }

                if (fullpath) {

                    var geojson_settings = {
                        type: 'geojson',
                        file: fullpath
                    };

                    //We're all good. Make the picture.
                    try {
                        //create map and layer
                        var map = new mapnik.Map(parseInt(args.width), parseInt(args.height), mercator.proj4);
                        //width, height
                        var layer = new mapnik.Layer(id, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
                        //check to see if 3857.  If not, assume WGS84
                        var geojson_ds = new mapnik.Datasource(geojson_settings);

                        var floatbbox = args.bbox.split(",");

                        var bbox = [floatbbox[0], floatbbox[1], floatbbox[2], floatbbox[3]];
                        //ll lat, ll lon, ur lat, ur lon

                        layer.datasource = geojson_ds;
                        layer.styles = [id, 'style'];

                        map.bufferSize = 64;

                        var stylepath = __dirname + '/cartocss/style.xml';

                        map.load(path.join(stylepath), {
                            strict: true
                        }, function (err, map) {

                            console.log(map.toXML());
                            // Debug settings

                            if (err)
                                throw err;
                            map.add_layer(layer);

                            map.extent = bbox;
                            var im = new mapnik.Image(map.width, map.height);
                            map.render(im, function (err, im) {

                                if (err) {
                                    throw err;
                                } else {
                                    res.writeHead(200, {
                                        'Content-Type': 'image/png'
                                    });
                                    res.end(im.encodeSync('png'));
                                }
                            });
                        });
                    } catch (err) {
                        res.writeHead(500, {
                            'Content-Type': 'text/plain'
                        });
                        res.end(err.message);
                    }
                }

            });

        } else {
            //if no args, pass to regular tile renderer

        }
    });

    console.log("Created dynamic query service: " + dynamicURL);
    callback({
        imageURL: dynamicURL
    });
})

//Create a renderer that will accept dynamic GeoJSON Objects and styling and bring back a single image to fit the map's extent.
exports.createImageFromGeoJSON = flow.define(function (geoJSON, bbox, epsgSRID, cartoFile, callback) {

    this.geoJSON = geoJSON;
    //this.geom_field = geom_field;
    this.epsg = epsgSRID;

    var _self = this;


    //Check for correct args
    //Needs: geojson, bbox (xmin, ymax, xmax, ymin)
    var args = { width: 500, height: 500 };

    //make a temporary geojson file for mapnik (until I figure out how to pass in an object)
    common.writeGeoJSONFile(geoJSON, "geojson", function (err, filename, fullpath) {

        if (err) {
            //TODO: Handle this.
            return;
        }

        if (fullpath) {

            var geojson_settings = {
                type: 'geojson',
                file: fullpath
            };

            //We're all good. Make the picture.
            try {
                //create map and layer
                var map = new mapnik.Map(parseInt(args.width), parseInt(args.height), geographic.proj4);
                //width, height
                var layer = new mapnik.Layer("geojson", ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
                //check to see if 3857.  If not, assume WGS84
                var geojson_ds = new mapnik.Datasource(geojson_settings);

                var bboxArray = [bbox.xmin, bbox.ymax, bbox.xmax, bbox.ymin];

                layer.datasource = geojson_ds;
                layer.styles = ["geojson", 'style'];

                map.bufferSize = 64;

                var stylepath = __dirname + '/cartocss/style.xml';

                map.load(path.join(stylepath), {
                    strict: true
                }, function (err, map) {

                    console.log(map.toXML());
                    // Debug settings

                    if (err)
                        throw err;
                    map.add_layer(layer);

                    map.extent = bboxArray;
                    var im = new mapnik.Image(map.width, map.height);
                    map.render(im, callback);
                });
            } catch (err) {
                callback(err, null);
            }
        }

    });
})

//This should take in a geoJSON object and create a new route on the fly - return the URL?
exports.createDynamicGeoJSONEndpoint = function (geoJSON, name, epsgSRID, cartoCssFile) {
    //var map = new nodetiles.Map();

    //map.assetsPath = path.join(__dirname, "cartocss"); //This is the cartoCSS path

    ////Adding a static GeoJSON file
    //map.addData(new DynamicGeoJsonSource({
    //	name: "world", //same name used in cartoCSS class (#world)
    //	geoJSONObject: geoJSON,
    //	projection: "EPSG:" + epsgSRID
    //}));

    //map.addStyle(fs.readFileSync(__dirname + '/cartocss/' + cartoCssFile, 'utf8'));

    //app.use('/services/nodetiles/' + name + '/tiles', nodetiles.route.tilePng({ map: map })); // tile.png
    //console.log("Created dynamic service: " + '/services/nodetiles/' + name + '/tiles');
};
