//////////Custom Module - like Geoprocessing Module, but for custom routes, etc.////////////

//Common and settings should be used by all sub-modules
var express = require('express'), common = require("../../common"), flow = require('flow'), settings = require('../../settings');

//The next requires are specific to this module only
var custom = require('./operations');
var CCacher = require("../../lib/ChubbsCache");
var cacher = new CCacher();

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
			for (i = 0; i < custom.names.length; i++) {
				args.opslist.push({
					name : custom.names[i],
					link : "custom_operation?name=" + custom.names[i]
				});
			}
		}

		//Render HTML page with results at bottom
		common.respond(req, res, args);

	});

    // listen for events to track cache rate and errors
    cacher.on("hit", function(key) {
        console.log("Using Cached response for: " + key)
    })
    cacher.on("miss", function(key) {
        console.log("No cached response for: " + key + ".  Generating.")
    })
    cacher.on("error", function(key) {
        console.log("Error with cache. " + err)
    })

	//Show specific GP operation
	app.all('/services/custom/custom_operation', cacher.cache('days', 3), flow.define(function(req, res) {
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
                var inputCount = 0; //count the inputs.  If a job has no inputs, then execute anyway.
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
                        inputCount++;
					}
				}


        if (this.args._input_arguments.length > 0 || inputCount == 0) {
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


	//Importing the GeoWebServices RedCross Endpoints
	app.all('/services/getAdminStack', flow.define(
		function (req, res) {
			//Stash the node request and response objects.
			this.req = req;
			this.res = res;

			//Grab POST or QueryString args depending on type
			if (this.req.method.toLowerCase() == "post") {
				//If a post, then arguments will be members of the this.req.body property
				this.args = this.req.body;
			}
			else if (this.req.method.toLowerCase() == "get") {
				//If request is a get, then args will be members of the this.req.query property
				this.args = this.req.query;
			}

			//Detect if args were passed in
			if (JSON.stringify(this.args) != '{}') {
				//Add custom properties as defaults
				this.args.view = "get_admin_stack";
				this.args.title = "GeoWebServices";
				this.args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "", name: "Get Admin Stack" }];

				//Set up an object to hold search terms
				var searchObj = {};
				searchObj.returnGeometry = this.args.returnGeometry;

				//All 3 need to be defined OR WKT & Datasource and Level, or feature ID.
				if (this.args.featureid) {
					//If we get the feature id, we need to first look up the item from textsearch table, and then go  get the stack.
					executeAdminStackSearchByFeatureId(this.args.featureid, this.req, this.res, this.args); //It has its own flow defined
					//GATrackEvent("Get Admin Stack", "by feature id", this.args.featureid); //Analytics
					return;
				}
				else if (this.args.stackid && this.args.adminlevel && this.args.datasource) {
					//Check to see if the datasource was valid
					if (settings.dsColumns[this.args.datasource.toLowerCase() + this.args.adminlevel]) {
						//Set up search parameters
						searchObj.stackid = this.args.stackid;
						searchObj.adminlevel = this.args.adminlevel;
						searchObj.datasource = this.args.datasource;
						searchObj.isSpatial = false;

						//GATrackEvent("Get Admin Stack", "by Stack ID, Admin, Datasource",  this.args.stackid + "," + this.args.adminlevel + "," + this.args.datasource); //Analytics
					}
					else {
						//Couldn't find this datasource in the settings file. Exit.
						this.args.errorMessage = this.args.datasource.toLowerCase() + this.args.adminlevel + " was not found. Try GADM0, GAUL1 or NaturalEarth0, for example";
						this.args.featureCollection = { message: this.args.errorMessage, type: "FeatureCollection", features: [] };

						//Render HTML page with results at bottom
						common.respond(this.req, this.res, this.args);
						return;
					}
				}
				else {
					//did they pass in GEOM And Datasource and Level?
					if (this.args.wkt && this.args.datasource) {
						//Check to see if the datasource was valid
						if (settings.dsColumns[this.args.datasource.toLowerCase() + (this.args.adminlevel ? this.args.adminlevel : "0")]) {
							//Use the geometry in search parameters
							searchObj.wkt = this.args.wkt;
							searchObj.datasource = this.args.datasource; //optional
							searchObj.adminlevel = this.args.adminlevel; //optional
							searchObj.isSpatial = true;

							//GATrackEvent("Get Admin Stack", "by Geom, Admin, Datasource", this.args.wkt + "," + this.args.adminlevel + "," + this.args.datasource); //Analytics

						} else {
							//Couldn't find this datasource in the settings file. Exit.
							this.args.errorMessage = this.args.datasource.toLowerCase() + (this.args.adminlevel ? this.args.adminlevel : "0") + " was not found. Try GADM0, GAUL1 or NaturalEarth0, for example";
							this.args.featureCollection = { message: this.args.errorMessage, type: "FeatureCollection", features: [] };

							//Render HTML page with results at bottom
							common.respond(this.req, this.res, this.args);
							return;
						}

					}
					else {
						//Let 'em know, then abort
						this.args.errorMessage = "Please provide either a boundary's stack ID, level and datasource, OR provide a WKT point and datasource.";
						this.args.featureCollection = { message: this.args.errorMessage, type: "FeatureCollection", features: [] }; //The page will parse the geoJson to make the HTMl

						//Render HTML page with results at bottom
						common.respond(this.req, this.res, this.args);
						return;
					}
				}


				//Try querying internal GeoDB
				executeAdminStackSearch(searchObj, this);
			}
			else {
				//If the querystring is empty, just show the regular HTML form.
				//Render Query Form without any results.
				this.args.view = "get_admin_stack";
				this.args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "", name: "Get Admin Stack" }];
				this.args.title = "GeoWebServices";

				common.respond(this.req, this.res, this.args);
			}
		}, function (err, result) {
			//The result of execute Admin Stack Search
			//successful search
			if (err) {
				common.log(err);
				this.args.errorMessage = "error: " + err;
				common.respond(this.req, this.res, this.args);
			}
			else {
				this.args.featureCollection = common.formatters.geoJSONFormatter(result.rows); //format as JSON
				common.respond(this.req, this.res, this.args);
			}
		}
	));


	//RedCross GeoWebServices Search Functions
	//pass in a search term, check the Geodatabase for matching names
//This is part 1 of 2 for getting back an admin stack
	var startExecuteAdminNameSearch = flow.define(

		function (searchterm, options, req, res, args) {
			this.req = req;
			this.res = res;
			this.args = args;

			//Start looking for exact matches
			executeStrictAdminNameSearch(searchterm, options, this);

		}, function (result) {
			//this is the result of executeAdminNameSearch 'strict' callback
			//result should be sucess or error.  If success, return results to user.
			//if error or no results, try the non-strict results

			common.log("strict matches for " + this.args.searchterm + ": " + result.rows.length);

			if (result && result.status == "success" && result.rows.length > 0) {

				this.args.featureCollection = geoJSONFormatter(result.rows); //The page will parse the geoJson to make the HTMl
				this.args.featureCollection.source = "GeoDB";
				this.args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "", name: "Query" }];
				common.respond(this.req, this.res, this.args);
				return;
			}
			else {
				//Try querying internal GeoDB - not strict
				executeLooseAdminNameSearch(this.args.searchterm, { returnGeometry: this.args.returnGeometry }, this);
			}
		}, function (result) {
			//this is the result of executeAdminNameSearch 'not-strict' callback
			//result should be sucess or error.  If success, return results to user.
			//if error or no results, try GeoNames

			common.log("loose matches for " + this.args.searchterm + ": " + result.rows.length);

			if (result && result.status == "success" && result.rows.length > 0) {

				//Return results
				//Check which format was specified

				this.args.featureCollection = geoJSONFormatter(result.rows); //The page will parse the geoJson to make the HTMl
				this.args.featureCollection.source = "GeoDB";
				this.args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "", name: "Query" }];

				//Render HTML page with results at bottom
				common.respond(this.req, this.res, this.args);
				return;
			}
			else {
				//Check GeoNames
				executeGeoNamesAPISearch(this.args.searchterm, this)
			}
		},
		function (statuscode, result) {
			//This is the callback from the GeoNamesAPI Search
			//check the result and decide what to do.

			this.args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "", name: "Query" }];

			if (statuscode && statuscode == "200") {
				//we got a response, decide what to do
				if (result && result.geonames && result.geonames.length > 0) {

					this.args.featureCollection = geoJSONFormatter(result.geonames); //The page will parse the geoJson to make the HTMl
					this.args.featureCollection.source = "Geonames";

					//Render HTML page with results at bottom
					common.respond(this.req, this.res, this.args);
				}
				else {
					//no results
					var infoMessage = "No results found.";
					this.args.infoMessage = infoMessage;
					this.args.featureCollection = { message: infoMessage, type: "FeatureCollection", features: [] }; //The page will parse the geoJson to make the HTMl
					this.args.featureCollection.source = "Geonames";

					//Render HTML page with results at bottom
					common.respond(this.req, this.res, this.args);
				}
			} else {
				//handle a non 200 response
				this.args.errorMessage = "Unable to complete operation. Response code: " + statuscode;
				this.args.featureCollection = { message: this.args.errorMessage, type: "FeatureCollection", features: [] }; //The page will parse the geoJson to make the HTMl

				//Render HTML page with results at bottom
				common.respond(this.req, this.res, this.args);
			}
		}
	);



//Strict name Search
	function executeStrictAdminNameSearch(searchterm, options, callback) {

		var sql = { text: "select * from udf_executestrictadminsearchbyname($1)", values: [searchterm] };

		if (options) {
			if (options.returnGeometry == "yes") {
				//Try for exact match - with geom
				sql = { text: "select * from udf_executestrictadminsearchbynamewithgeom($1)", values: [searchterm] };
			}
			else {
				//Try for exact match - without geom
				sql = { text: "select * from udf_executestrictadminsearchbyname($1)", values: [searchterm] };
			}
			//run it
			common.executePgQuery(sql, callback);
		}
	}

//loose name search
	function executeLooseAdminNameSearch(searchterm, options, callback) {

		var sql = { text: "select * from udf_executeadminsearchbyname($1)", values: [searchterm] };

		if (options) {
			if (options.returnGeometry == "yes") {
				//use wildcard or partial match - with geom
				sql = { text: "select * from udf_executeadminsearchbynamewithgeom($1)", values: [searchterm] };
			}
			else {
				//use wildcard or partial match - without geom
				sql = { text: "select * from udf_executeadminsearchbyname($1)", values: [searchterm] };
			}
		}


		//run it
		common.executePgQuery(sql, callback);
	}

//pass in an ID, check the text search table for the ID
//This is part 1 of 2 for getting back an admin stack
	function executeAdminIDSearch(featureID, options, callback) {

		//search by ID - without geom
		var sql = { text: "select * from udf_executeadminsearchbyid($1)", values: [featureID] }; //default

		if (options) {
			if (options.returnGeometry == "yes") {
				//search by ID - with geom
				sql = { text: "select * from udf_executeadminsearchbyidwithgeom($1)", values: [featureID] };
			}
		}

		//run it
		common.executePgQuery(sql, callback);
	}




//pass in a search object with stackid, admin level, datasource OR WKT, find the matching administrative hierarchy
	function executeAdminStackSearch(searchObject, callback) {
		var sql = "";

		//See if this is a spatial (WKT) search or not
		if (searchObject.isSpatial == false) {
			//lookup by id, datasource and level
			//build sql query
			sql = buildAdminStackQuery(searchObject.stackid, searchObject.datasource, searchObject.adminlevel, searchObject.returnGeometry);
			common.log(sql);

			//run it
			common.executePgQuery(sql, callback);
		}
		else {
			//do a spatial search

			//If user specifies admin level, then use that to start with, otherwise, start with the lowest level for that datasource
			var adminLevel = 2;

			if (searchObject.adminlevel) {
				//use user's level
				adminLevel = searchObject.adminlevel;
			}
			else {
				//use a specified level
				adminLevel = settings.dsLevels[searchObject.datasource.toLowerCase()];
			}

			common.log(adminLevel);

			//Admin level will be passed in iteratively until we find a match.
			function hitTest(level) {
				if (level >= 0) {
					//Do Hit Test, starting with lowest available admin level
					common.log("In hit test loop.  checking level " + level);
					sql = buildAdminStackSpatialQuery(searchObject.wkt, searchObject.datasource, level, searchObject.returnGeometry);
					common.executePgQuery(sql, function (err, result) {
						if (err) {
							//continue searching
							hitTest(level - 1);
						}
						else {
							//we found a match, break out.
							if (result.rows.length > 0) {
								callback(err, result);
								return;
							}
							else {
								//continue searching
								hitTest(level - 1);
							}
						}
					});
				}
				else {
					//We've hit the end of the road
					common.log("checked all levels for " + searchObject.wkt + ", found nothing.");
					callback(null, { rows: [], status: "success" });
				}
			}
			//initiate loop
			hitTest(adminLevel);
		}
	}

	//This is the case where user passes in feature id to the admin stack search. in this case, we need to look up the level and datasource for that feature, and then build a query to get the stack.
	var executeAdminStackSearchByFeatureId = flow.define(

		function (featureid, req, res, args) {
			this.req = req;
			this.res = res;
			this.args = args;

			executeAdminIDSearch(featureid, { type: "id", returnGeometry: this.args.returnGeometry }, this);

		},
		function (err, result) {
			//handle results of executeAdminIDSearch
			if (result && result.rows) {
				//If we got a result from text_search table, then build a query to get the stack.
				var row = result.rows[0];
				var searchObj = {};
				searchObj.stackid = row.stackid;
				searchObj.adminlevel = row.level;
				searchObj.datasource = row.source;
				searchObj.returnGeometry = this.args.returnGeometry;
				searchObj.isSpatial = false;

				executeAdminStackSearch(searchObj, this);
			}
		},
		function (err, result) {
			//handles results of executeAdminStackSearch
			//The result of execute Admin Stack Search
			//successful search
			if (err) {
				common.log(result.message.text);
				this.args.errorMessage = "error: " + result.message.text;
				common.respond(this.req, this.res, this.args);
			}
			else {
				this.args.featureCollection = geoJSONFormatter(result.rows); //format as JSON
				common.respond(this.req, this.res, this.args);
			}
		}
	)

	function buildAdminStackQuery(rowid, datasource, level, returnGeometry) {
		//build up the query to be executed for getting Admin Stacks

		var table = datasource.toLowerCase() + level; //gadm, gaul, naturalearth, local, custom
		var queryObj = {};
		try{
			queryObj.text = "SELECT " + (returnGeometry == "yes" ? settings.dsColumns[table].geometry : "") + settings.dsColumns[table].columns + " FROM " + table + " WHERE guid = $1";
			queryObj.values = [rowid];
		} catch (e) {

		}
		finally{
			return queryObj;
		}


	}

	function buildAdminStackSpatialQuery(wkt, datasource, level, returnGeometry) {
		//build the spatial query for getting Admin Stacks by WKT geometry intersect
		var table = datasource.toLowerCase() + level; //gadm, gaul, naturalearth, local, custom
		var queryObj = {};

		queryObj.text = "SELECT " + (returnGeometry == "yes" ? settings.dsColumns[table].geometry : "") + settings.dsColumns[table].columns + " FROM " + table + " WHERE ST_Intersects(ST_GeomFromText($1, 4326), geom)";
		queryObj.values = [wkt];

		return queryObj;
	}
	
	return app;
}
