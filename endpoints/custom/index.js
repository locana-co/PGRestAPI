//////////Custom Module - like Geoprocessing Module, but for custom routes, etc.////////////

//Common and settings should be used by all sub-modules
var express = require('express'), common = require("../../common"), flow = require('flow'), settings = require('../../settings');

//The next requires are specific to this module only
var custom = require('./operations');

var mapnik;
try {
	mapnik = require('../../endpoints/mapnik');
} catch (e) {
	mapnik = null;
}

//End module specific requires
exports.app = function(passport) {
	var app = express();

	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');

	//Show dynamic list of GP options
	app.all('/services/custom', function(req, res) {

		var args = {};
		args.view = "custom_operations";
		args.breadcrumbs = [{
			link : "/services/tables",
			name : "Table Listing"
		}, {
			link : "",
			name : "Custom Endpoints"
		}];
		args.url = req.url;
		args.opslist = [];

		if (custom && custom.names) {
			for ( i = 0; i < custom.names.length; i++) {
				args.opslist.push({
					name : custom.names[i],
					link : "custom_operation?name=" + custom.names[i]
				});
			}
		}

		//Render HTML page with results at bottom
		common.respond(req, res, args);

	});

	//Show specific GP operation
	app.all('/services/custom/custom_operation', flow.define(function(req, res) {
		this.args = {};
		this.req = req;
		this.res = res;

		//Grab POST or QueryString args depending on type
		if (req.method.toLowerCase() == "post") {
			//If a post, then arguments will be members of the this.req.body property
			this.args = req.body;
		} else if (req.method.toLowerCase() == "get") {
			//If request is a get, then args will be members of the this.req.query property
			this.args = req.query;
		}

		if (JSON.stringify(this.args) != '{}') {

			this.args.view = "custom_operation";
			this.args.breadcrumbs = [{
				link : "/services/tables",
				name : "Table Listing"
			}, {
				link : "/services/custom",
				name : "Custom Endpoints"
			}, {
				link : "",
				name : "Custom Endpoint"
			}];
			this.args.path = this.req.path;
			this.args.host = this.req.headers.host;

			if (this.args.name) {
				//Dynamically load the page
				this.customOperation = custom.operations[this.args.name.toLowerCase()];
				//always lower names.

				if (!this.customOperation) {
					//No such operation
					this.args.errorMessage = "No such operation.";
					common.respond(this.req, this.res, this.args);
					return;
				}

				//Write out page based on dynamic inputs
				this.args.formfields = [];
				this.args._input_arguments = [];
				this.args._input_values = [];
				this.args.description = this.customOperation.description;
				this.args.breadcrumbs = [{
					link : "/services/tables",
					name : "Home"
				}, {
					link : "/services/custom",
					name : "Custom Endpoints"
				}, {
					link : "",
					name : this.customOperation.name
				}];

				//See what the inputs are
				//Also see if any of the inputs were provided as args.
				for (var key in this.customOperation.inputs) {
					if (this.customOperation.inputs.hasOwnProperty(key)) {
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


        if (this.args._input_arguments.length > 0) {
          //We've got all of the required arguments
          this.customOperation.execute(this.args, this);
          //Flow to next bloc when done
        } else {
          //They provided no arguments, so just load the empty page
          //Render HTML page with results at bottom
          this.args.errorMessage = "No arguments were provided.";
          common.respond(this.req, this.res, this.args);
        }

				//Now get other args (if any) and process them
        //Commenting out for now.  Let the individual endpoints deal with whether the args were provided or not
        /*if (this.args.formfields.length == this.args._input_arguments.length) {
					//We've got all of the required arguments
					this.customOperation.execute(this.args, this);
					//Flow to next bloc when done
				} else if (this.args._input_arguments.length > 0) {
					//they provided some of the arguments, but not all.
					//Render HTML page with results at bottom
          this.args.infoMessage = "Not all required arguments were provided.";
					common.respond(this.req, this.res, this.args);
				} else {
					//They provided no arguments, so just load the empty page
					//Render HTML page with results at bottom
          this.args.infoMessage = "No arguments were provided.";
					common.respond(this.req, this.res, this.args);
				}*/

			} else {
				//Render HTML page with results at bottom
				common.respond(this.req, this.res, this.args);
			}

		} else {
			//Page initial load.  No results
			this.args.view = "custom_operation";
			this.args.breadcrumbs = [{
				link : "/services/tables",
				name : "Table Listing"
			}, {
				link : "/services/custom",
				name : "Custom Endpoints"
			}, {
				link : "",
				name : "Custom Endpoint"
			}];
			common.respond(this.req, this.res, this.args);

		}
	}, function(err, result) {
		//Flowing from gpOperation.execute
		//check for error
		if (err) {
			//Report error and exit.
			this.args.errorMessage = err;
      this();
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
			}else if (this.args.format && this.args.format.toLowerCase() == "json") {
        //Respond with JSON
        features = result.rows;
      }else if (this.args.format && this.args.format.toLowerCase() == "esrijson") {
				//Respond with esriJSON
				features = common.formatters.ESRIFeatureSetJSONFormatter(result.rows, this.args.geom_fields_array);
			}

			this.args.featureCollection = features;
			//clone and assign output features to args variable

			//if GP operation specifies output image service, then spin one up
			if (mapnik && this.customOperation.outputImage && this.customOperation.outputImage == true && features) {
				mapnik.createGeoJSONQueryRenderer(app, JSON.parse(JSON.stringify(features)), "4326", "style.xml", this.customOperation.id, this);
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
