//////////Utilities

//Common and settings should be used by all sub-modules
var express = require('express'), common = require("../../common"), settings = require('../../settings');

var mapnik;
try {
    mapnik = require('../../endpoints/mapnik');
} catch (e) {
    mapnik = null;
}



exports.app = function (passport) {
    var app = express();

    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');

    //Add a route and define response - get list of utilities
    app.all('/services/utilities', function (req, res) {
        var args = {};

        args.view = "services";
        args.breadcrumbs = [{
            link: "/services/tables",
            name: "Table Listing"
        }, {
            link: "",
            name: "Utilities"
        }];
        args.path = req.path;
        args.host = req.headers.host;

        //object with available services
        var opslist = [{
            link: 'wktpreview',
            name: 'WKT Previewer'
        }];

        args.opslist = opslist;

        //send to view
        res.render('utilities', args);
    });

    //Add a route and define response - get list of utilities
    app.all('/services/wktpreview', function (req, res) {
        var args = {};

        //Grab POST or QueryString args depending on type
        if (req.method.toLowerCase() == "post") {
            //If a post, then arguments will be members of the this.req.body property
            args = req.body;
        } else if (req.method.toLowerCase() == "get") {
            //If request is a get, then args will be members of the this.req.query property
            args = req.query;
        }

        args.view = "wktpreview";
        args.breadcrumbs = [{
            link: "/services/tables",
            name: "Table Listing"
        }, {
            link: "/services/utilities",
            name: "Utilities"
        }, {
            link: "",
            name: "WKT Preview"
        }];
        args.path = req.path;
        args.host = req.headers.host;

        if (args.wkt) {
            //If user passes WKT, wrap it in a PostGIS select clause.

            var wkt = "ST_GeomFromText('" + args.wkt + "', " + (args.inputsrid || 4326) + ")";

            if (args.outputsrid) {
                if (common.IsNumeric(args.outputsrid) == false) {
                    //warn user and abort.
                    args.errorMessage = "Error: Output SRID must be numeric.";
                    common.respond(req, res, args);
                    return;
                }
                //wrap wkt in a transform
                wkt = "ST_Transform(" + wkt + "," + args.outputsrid + ")";
            }

            //Whatever it is, wrap it as ST_GeoJSON
            wkt = "ST_AsGeoJSON(" + wkt + ")";

            wkt += " as geom";
            //alias

            var query = {
                text: "SELECT " + wkt,
                values: []
            };

            common.executePgQuery(query, function (result) {
                var features = [];

                //check for error
                if (result.status == "error") {
                    //Report error and exit.
                    args.errorMessage = result.message;
                } else {
                    //a-ok
                    //Check which format was specified
                    if (!args.format || args.format.toLowerCase() == "html") {
                        //Render HTML page with results at bottom
                        features = common.formatters.geoJSONFormatter(result.rows, ["geom"]);
                        //The page will parse the geoJson to make the HTMl

                        //For now - hard coded.  Create new dynamic endpoint for this GeoJSON
                        //nodetiles.createDynamicGeoJSONEndpoint(features, args.table, "4326", "style.mss");
                    } else if (args.format && args.format.toLowerCase() == "geojson") {
                        //Respond with JSON
                        features = common.formatters.geoJSONFormatter(result.rows, ["geom"]);

                        //For now - hard coded.  Create new dynamic endpoint for this GeoJSON
                        //nodetiles.createDynamicGeoJSONEndpoint(features, args.table, "4326", "style.mss");
                    } else if (args.format && args.format.toLowerCase() == "esrijson") {
                        //Respond with esriJSON
                        features = common.formatters.ESRIFeatureSetJSONFormatter(result.rows, ["geom"]);
                    }

                    args.featureCollection = features;
                    args.scripts = ['http://cdn.leafletjs.com/leaflet-0.6.4/leaflet.js', 'http://codeorigin.jquery.com/jquery-1.10.2.min.js'];
                    //Load external scripts for map preview
                    args.css = ['http://cdn.leafletjs.com/leaflet-0.6.4/leaflet.css'];
                }

                common.respond(req, res, args);
            });

        } else {
            //send to view
            common.respond(req, res, args);
        }
    });

    //Add a route for posting WKT, cutting an image and auto-refreshing to see latest.
    app.all('/services/wkttoimage', function (req, res) {
        var args = {};

        //Grab POST or QueryString args depending on type
        if (req.method.toLowerCase() == "post") {
            //If a post, then arguments will be members of the this.req.body property
            args = req.body;
        } else if (req.method.toLowerCase() == "get") {
            //If request is a get, then args will be members of the this.req.query property
            args = req.query;
        }

        args.path = req.path;
        args.host = req.headers.host;

        if (args.wkt) {
            //If user passes WKT, wrap it in a PostGIS select clause.

            var wkt = "ST_GeomFromText('" + args.wkt + "', " + (args.inputsrid || 4326) + ")";

            if (args.outputsrid) {
                if (common.IsNumeric(args.outputsrid) == false) {
                    //warn user and abort.
                    args.errorMessage = "Error: Output SRID must be numeric.";
                    common.respond(req, res, args);
                    return;
                }
                //wrap wkt in a transform
                wkt = "ST_Transform(" + wkt + "," + args.outputsrid + ")";
            }

            //Whatever it is, wrap it as ST_GeoJSON
            wkt = "ST_AsGeoJSON(" + wkt + ") as geom, ST_Extent(" + wkt + ") as extent";

            //alias

            var query = {
                text: "SELECT " + wkt,
                values: []
            };

            common.executePgQuery(query, function (result) {
                var features = [];

                //check for error
                if (result.status == "error") {
                    //Report error and exit.
                    res.jsonp({ error: result.message });
                } else {
                    //a-ok
                    //Check which format was specified

                    //Cut a map image
                    features = common.formatters.geoJSONFormatter(result.rows, ["geom"]);
                    var extentBox = result.rows[0].extent; //"BOX(33.9101806180002 -4.67820978199995,41.9101189990001 5.47010586055859)" - "xmin, ymin, xmax, ymax"
                    var extentArr = extentBox.replace("BOX(", "").replace(")", "").split(",");
                    var xmin = extentArr[0].split(" ")[0];
                    var ymin = extentArr[0].split(" ")[1];
                    var xmax = extentArr[1].split(" ")[0];
                    var ymax = extentArr[1].split(" ")[1];

                    //if GP operation specifies output image service, then spin one up
                    if (mapnik && features) {
                        mapnik.createImageFromGeoJSON(JSON.parse(JSON.stringify(features)), { xmin: xmin, ymin: ymin, xmax: xmax, ymax: ymax }, "4326", "style.xml", function (err, im) {

                            if (err) {
                                res.writeHead(500, {
                                    'Content-Type': 'text/plain'
                                });
                                res.end(err.message);
                            } else {
                                res.writeHead(200, {
                                    'Content-Type': 'image/png'
                                });
                                res.end(im.encodeSync('png'));
                            }
                        });
                    } else {
                        //Return message
                        res.jsonp({ error: "Mapnik not installed or no features returned." });
                    }
                }
            });

        } else {
            //send to view
            res.jsonp({ error: "No WKT specified." });
        }
    });

    return app;
}

