//////////Services

//Express, Common and settings should be used by all sub-modules
var express = require('express'),
    common = require("../../common"),
    settings = require('../../settings');


var app = module.exports = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

//Add a route and define response - get list of utilities
app.all('/services/utilities', function (req, res) {
    var args = {};

    args.view = "services";
    args.breadcrumbs = [{ link: "/services", name: "Home" }];
    args.path = req.path;
    args.host = req.headers.host;

    //object with available services
    var opslist = [
        { link: 'wktpreview', name: 'WKT Previewer' }
    ];

    //send to view
    res.render('utilities', { opslist: opslist, breadcrumbs: [{ link: "", name: "Services" }] });
});

//Add a route and define response - get list of utilities
app.all('/services/wktpreview', function (req, res) {
    var args = {};



    //Grab POST or QueryString args depending on type
    if (req.method.toLowerCase() == "post") {
        //If a post, then arguments will be members of the this.req.body property
        args = req.body;
    }
    else if (req.method.toLowerCase() == "get") {
        //If request is a get, then args will be members of the this.req.query property
        args = req.query;
    }

    args.view = "wktpreview";
    args.breadcrumbs = [{ link: "/services", name: "Services" }, { link: "/services/utilities", name: "Utilities" }, { link: "", name: "WKT Preview" }];
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
            wkt = "ST_Transform(" + wkt + "," + args.outputsrid +")";
        }
        
        //Whatever it is, wrap it as ST_GeoJSON
        wkt = "ST_AsGeoJSON(" + wkt + ")";
        
        wkt += " as geom"; //alias


        var query = {
            text: "SELECT " + wkt, values: []
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
                    features = common.formatters.geoJSONFormatter(result.rows, ["geom"]); //The page will parse the geoJson to make the HTMl

                    //For now - hard coded.  Create new dynamic endpoint for this GeoJSON
                    //nodetiles.createDynamicGeoJSONEndpoint(features, args.table, "4326", "style.mss");
                }
                else if (args.format && args.format.toLowerCase() == "geojson") {
                    //Respond with JSON
                    features = common.formatters.geoJSONFormatter(result.rows, ["geom"]);

                    //For now - hard coded.  Create new dynamic endpoint for this GeoJSON
                    //nodetiles.createDynamicGeoJSONEndpoint(features, args.table, "4326", "style.mss");
                }
                else if (args.format && args.format.toLowerCase() == "esrijson") {
                    //Respond with esriJSON
                    features = common.formatters.ESRIFeatureSetJSONFormatter(result.rows,["geom"]);
                }

                args.featureCollection = features;
                args.scripts = ['http://cdn.leafletjs.com/leaflet-0.6.4/leaflet.js', 'http://codeorigin.jquery.com/jquery-1.10.2.min.js']; //Load external scripts for map preview
                args.css = ['http://cdn.leafletjs.com/leaflet-0.6.4/leaflet.css'];
            }

            common.respond(req, res, args);
        });

    }
    else {
        //send to view
        common.respond(req, res, args);
    }
});