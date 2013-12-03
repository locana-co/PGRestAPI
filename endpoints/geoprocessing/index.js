//////////Geoprocessing Module////////////

//Express, Common and settings should be used by all sub-modules
var express = require('express'),
    common = require("../../common"),
    settings = require('../../settings');

//The next requires are specific to this module only
var gp = require('./operations');
var nodetiles = require('../../endpoints/nodetiles');
//End module specific requires

var app = module.exports = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

//Show dynamic list of GP options
app.all('/services/geoprocessing', function (req, res) {

    var args = {};
    args.view = "geoprocessing_operations";
    args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services", name: "Services" }, { link: "", name: "Geoprocessing Operations" }];
    args.url = req.url;
    args.opslist = [];

    if (gp && gp.names) {
        for (i = 0; i < gp.names.length; i++) {
            args.opslist.push({ name: gp.names[i], link: "geoprocessing_operation?name=" + gp.names[i] });
        }
    }

    //Render HTML page with results at bottom
    common.respond(req, res, args);

});

//Show specific GP operation
app.all('/services/geoprocessing/geoprocessing_operation', function (req, res) {
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

    args.view = "geoprocessing_operation";
    args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services", name: "Services" }, { link: "/services/geoprocessing", name: "Geoprocessing Operations" }, { link: "", name: "Geoprocessing Operation" }];
    args.featureCollection = [];

    if (JSON.stringify(args) != '{}') {

        if (args.name) {
            //Dynamically load the page
            var gpOperation = gp.operations[args.name.toLowerCase()]; //always lower names.
            if (!gpOperation) {
                //No such operation
                var args = {};
                args.view = "geoprocessing_operation";
                args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services", name: "Services" }, { link: "/services/geoprocessing", name: "Geoprocessing Operations" }];
                args.errorMessage = "No such operation.";
                args.path = req.path;
                args.host = req.headers.host;
                common.respond(req, res, args);
                return;
            }

            //Write out page based on dynamic inputs
            args.formfields = [];
            args._input_arguments = [];
            args._input_values = [];
            args.description = gpOperation.description;
            args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services", name: "Services" }, { link: "/services/geoprocessing", name: "Geoprocessing Operations" }, { link: "", name: gpOperation.name }];
            args.path = req.path;
            args.host = req.headers.host;

            //See what the inputs are
            //Also see if any of the inputs were provided as args.
            for (var key in gpOperation.inputs) {
                if (gpOperation.inputs.hasOwnProperty(key)) {
                    args.formfields.push(key);
                    if (args[key]) {
                        args._input_arguments.push(key);
                        args._input_values.push({ name: key, value: args[key] });
                    }
                }
            }


            //Now get other args (if any) and process them
            if (args.formfields.length == args._input_arguments.length) {
                //We've got all of the required arguments


                gpOperation.execute(args, function (result) {
                    //TODO: check for errors here and handle.
                    
                    //Write out results to page
                    var features = "";

                    //Check which format was specified
                    if (!args.format || args.format.toLowerCase() == "html") {
                        //Render HTML page with results at bottom
                        features = common.formatters.geoJSONFormatter(result.rows, args.geom_fields_array); //The page will parse the geoJson to make the HTMl
                    }
                    else if (args.format && args.format.toLowerCase() == "geojson") {
                        //Respond with JSON
                        features = common.formatters.geoJSONFormatter(result.rows, args.geom_fields_array);
                    }
                    else if (args.format && args.format.toLowerCase() == "esrijson") {
                        //Respond with esriJSON
                        features = common.formatters.ESRIFeatureSetJSONFormatter(result.rows, args.geom_fields_array);
                    }

                    //if GP operation specifies output image service, then spin one up
                    if (gpOperation.outputImage && gpOperation.outputImage == true) {
                        //nodetiles.createDynamicGeoJSONEndpoint(features, gpOperation.name, "4326", "style.mss"); //Use a dyanmic GP ID here to append to the name.
                    }

                    args.view = "geoprocessing_operation";
                    args.featureCollection = features;

                    common.respond(req, res, args);
                    return;
                });

            } else if (args._input_arguments.length > 0) {
                //they provided some of the arguments, but not all.
                //Render HTML page with results at bottom
                common.respond(req, res, args);
            }
            else {
                //They provided no arguments, so just load the empty page
                //Render HTML page with results at bottom
                common.respond(req, res, args);
            }

        }
        else {
            //Render HTML page with results at bottom
            common.respond(req, res, args);
        }

    }
    else {
        //Render HTML page with results at bottom
        common.respond(req, res, args);
    }
});
