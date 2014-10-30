//////////Geoprocessing Module////////////

//Common and settings should be used by all sub-modules
var express = require('express'), common = require("../../common"), flow = require('flow'), settings = require('../../settings');

//The next requires are specific to this module only
var gp = require('./operations');

var tiles;
try {
  tiles = require('../../endpoints/tiles');
} catch (e) {
  tiles = null;
}

//End module specific requires
exports.app = function(passport) {
	var app = express();

	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');

	//Show dynamic list of GP options
	app.all('/services/geoprocessing', function(req, res) {

		var args = {};
		args.view = "geoprocessing_operations";
		args.breadcrumbs = [
      {
        link: "/services",
        name: "Home"
      }, {
			link : "",
			name : "Geoprocessing Operations"
		}];
		args.url = req.url;
		args.opslist = [];

		if (gp && gp.names) {
			for ( i = 0; i < gp.names.length; i++) {
				args.opslist.push({
					name : gp.names[i],
					link : "geoprocessing_operation?name=" + gp.names[i]
				});
			}
		}

		//Render HTML page with results at bottom
		common.respond(req, res, args);

	});

	//Show specific GP operation
	app.all('/services/geoprocessing/geoprocessing_operation', flow.define(function(req, res) {
		this.args = {};
		this.req = req;
		this.res = res;

		//Grab POST or QueryString args depending on type
		if (req.method.toLowerCase() == "post") {
			//If a post, then arguments will be members of the this.req.body property
			this.args = req.body;
			this.args.files = req.files;
		} else if (req.method.toLowerCase() == "get") {
			//If request is a get, then args will be members of the this.req.query property
			this.args = req.query;
		}

		if (JSON.stringify(this.args) != '{}') {

			this.args.view = "geoprocessing_operation";
			this.args.breadcrumbs = [{
				link : "/services",
				name : "Home"
			}, {
				link : "/services/geoprocessing",
				name : "Geoprocessing Operations"
			}, {
				link : "",
				name : "Geoprocessing Operation"
			}];
			this.args.path = this.req.path;
			this.args.host = this.req.headers.host;

			if (this.args.name) {
				//Dynamically load the page
				this.gpOperation = gp.operations[this.args.name.toLowerCase()];
				//always lower names.

				if (!this.gpOperation) {
					//No such operation
					this.args.errorMessage = "No such operation.";
					common.respond(this.req, this.res, this.args);
					return;
				}

				//Setup return geom fields array based on GP object specification (if exists)
				if(this.gpOperation.geom_columns) this.args.geom_fields_array = this.gpOperation.geom_columns;

				//Write out page based on dynamic inputs
				this.args.formfields = [];
				this.args.formatlist = settings.application.formatList;
				this.args._input_arguments = [];
				this.args._input_values = [];
				this.args.description = this.gpOperation.description;
				this.args.breadcrumbs = [{
					link : "/services/tables",
					name : "Home"
				}, {
					link : "/services/geoprocessing",
					name : "Geoprocessing Operations"
				}, {
					link : "",
					name : this.gpOperation.name
				}];

				//See what the inputs are
				//Also see if any of the inputs were provided as args.
				for (var key in this.gpOperation.inputs) {
					if (this.gpOperation.inputs.hasOwnProperty(key)) {
						this.args.formfields.push(key);
						if (this.args[key]) {
							this.args._input_arguments.push(key);
							this.args._input_values.push({
								name : key,
								value : this.args[key]
							});
						}
					}
				}

				//Copy to use as an argument list for the page
				this.args.all_inputs = this.gpOperation.inputs;

				//Now get other args (if any) and process them
				//if (this.args.formfields.length == this.args._input_arguments.length) {
				//We've got all of the required arguments

				//TODO: Let the operation decide how to handle missing arguments.
				this.gpOperation.execute(this.args, this);
				//Flow to next bloc when done

				//} else if (this.args._input_arguments.length > 0) {
				//	//they provided some of the arguments, but not all.
				//	//Render HTML page with results at bottom
				//	this.args.errorMessage = "Missing some required arguments.";
				//	common.respond(this.req, this.res, this.args);
				//} else {
				//	//They provided no arguments, so just load the empty page
				//	//Render HTML page with results at bottom
				//	common.respond(this.req, this.res, this.args);
				//}

			} else {
				//Render HTML page with results at bottom
				common.respond(this.req, this.res, this.args);
			}

		} else {
			//Page initial load.  No results
			this.args.formatlist = settings.application.formatList;
			this.args.view = "geoprocessing_operation";
			this.args.breadcrumbs = [{
				link : "/services",
				name : "Home"
			}, {
				link : "/services/geoprocessing",
				name : "Geoprocessing Operations"
			}, {
				link : "",
				name : "Geoprocessing Operation"
			}];
			common.respond(this.req, this.res, this.args);

		}
	}, function(err, result) {
		//Flowing from gpOperation.execute
		//check for error
		if (err) {
			//Report error and exit.
			this.args.errorMessage = err.text;
			common.respond(this.req, this.res, this.args);
			return;
		} else {
			//success
			//Write out results to page
			var features = "";

			//Check which format was specified
			if (!this.args.format || this.args.format.toLowerCase() == "html") {
				//Render HTML page with results at bottom
				features = common.formatters.geoJSONFormatter(result.rows, this.args.geom_fields_array);
				//The page will parse the geoJson to make the HTMl
			} else if (this.args.format && this.args.format.toLowerCase() == "geojson") {
				//Respond with JSON
				features = common.formatters.geoJSONFormatter(result.rows, this.args.geom_fields_array);
			} else if (this.args.format && this.args.format.toLowerCase() == "esrijson") {
				//Respond with esriJSON
				features = common.formatters.ESRIFeatureSetJSONFormatter(result.rows, this.args.geom_fields_array);
			} else if (this.args.format && this.args.format.toLowerCase() == "csv") {
				//CSV
				features = common.formatters.CSVFormatter(result.rows, common.unEscapePostGresColumns(this.args.geom_fields_array));
			}

			this.args.featureCollection = features;
			//clone and assign output features to args variable

			//if GP operation specifies output image service, then spin one up
			if (tiles && this.gpOperation.outputImage && this.gpOperation.outputImage == true && features) {
        tiles.createGeoJSONQueryRenderer(app, JSON.parse(JSON.stringify(features)), "4326", "style.xml", this.gpOperation.id, this);
				//Use a dyanmic GP ID here to append to the name.
			} else {
				this();
				//Just flow
			}
		}
	}, function(result) {
		//Flowing from CreateGeoJSONQueryRenderer, or just responding back to request

		if (result && result.imageURL) {
			this.args.imageURL = "http://" + this.args.host + result.imageURL; //TODO - use correct dynamic protocol (http vs. https)
			if (this.args.featureCollection) {
				this.args.featureCollection.imageURL = this.args.imageURL;
				//Write an extra parameter back to the caller so they know how to fetch the result image.
			}
		}
		common.respond(this.req, this.res, this.args);
		//Write it out
		return;
	}));
	
	return app;
}
