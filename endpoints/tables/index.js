//////////Tables////////////

//Express, Common and settings should be used by all sub-modules
var express = require('express'), common = require("../../common"), settings = require('../../settings');

//The next requires are specific to this module only
var flow = require('flow'), fs = require("fs"), http = require("http"), path = require("path"), shortid = require("shortid");
var GeoFragger = require('../../lib/GeoFragger');

var mapnik;
try {
	mapnik = require('../../endpoints/mapnik');
} catch (e) {
	mapnik = null;
}

var ogr2ogr;
try {
	ogr2ogr = require('ogr2ogr');
} catch(e) {
	ogr2ogr = null;
	console.log("No ogr2ogr found. Will not use.");
}

//Add shapefile option to table query output list
if (ogr2ogr)
	settings.application.formatList.push('shapefile');

//var app = exports.app = express();

exports.app = function(passport) {
	var app = express();
	
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');

	//Add a route and define response
	//Get list of public base tables from postgres
	app.all('/services/tables', passport.authenticationFunctions, function(req, res) {
		var args = {};

		//Grab POST or QueryString args depending on type
		if (req.method.toLowerCase() == "post") {
			//If a post, then arguments will be members of the this.req.body property
			args = req.body;
		} else if (req.method.toLowerCase() == "get") {
			//If request is a get, then args will be members of the this.req.query property
			args = req.query;
		}

		args.view = "table_list";
		args.path = req.path;
		args.host = settings.application.publichost || req.headers.host;
		args.link = "http://" + args.host + "/services/tables";

		try {
			//Check to see if we've stashed the list already.
			if (settings.tableList && !args.search) {
				//Render HTML page with results at bottom
				args.featureCollection = settings.tableList;
				common.respond(req, res, args);
			} else {
				//Fetch from DB
				var query = {
					text : "SELECT * FROM information_schema.tables WHERE table_schema = 'public' and (" + (settings.displayTables === true ? "table_type = 'BASE TABLE'" : "1=1") + (settings.displayViews === true ? " or table_type = 'VIEW'" : "") + ") AND table_name NOT IN ('geography_columns', 'geometry_columns', 'raster_columns', 'raster_overviews', 'spatial_ref_sys'" + (settings.pg.noFlyList && settings.pg.noFlyList.length > 0 ? ",'" + settings.pg.noFlyList.join("','") + "'" : "") + ") " + (args.search ? " AND table_name ILIKE ('" + args.search + "%') " : "") + " ORDER BY table_schema,table_name; ",
					values : []
				};
				common.executePgQuery(query, function(err, result) {
                    if(err){
                        args.errorMessage = err.text;
                        common.respond(req, res, args);
                        return;
                    }

					args.featureCollection = result.rows.map(function(item) {
						return item.table_name;
					});

					//Get array of table names
					//stash it for later - if not the result of a search
					if (!args.search)
						settings.tableList = args.featureCollection;

					//Render HTML page with results at bottom
					common.respond(req, res, args);
				});
			}
		} catch (e) {
			args.errorMessage = e.text;
			common.respond(req, res, args);
		}
	});

	//Table Detail
	app.all('/services/tables/:table', flow.define(
	//If the querystring is empty, just show the regular HTML form.

	function(req, res) {
		this.req = req;
		this.res = res;

		this.args = {};

		//Grab POST or QueryString args depending on type
		if (this.req.method.toLowerCase() == "post") {
			//If a post, then arguments will be members of the this.req.body property
			this.args = this.req.body;
		} else if (this.req.method.toLowerCase() == "get") {
			//If request is a get, then args will be members of the this.req.query property
			this.args = this.req.query;
		}

		this.args.table = this.req.params.table;
		this.args.view = "table_details";
		this.args.breadcrumbs = [{
			link : "/services/tables",
			name : "Table Listing"
		}, {
			link : "",
			name : this.args.table
		}];
		this.args.host = settings.application.publichost || req.headers.host;
		this.args.url = this.req.url;
		this.args.table_details = [];
		this.args.fullURL = "http://" + (settings.application.publichost || this.req.headers.host) + this.req.path;
		//TODO - make the protocol dynamic
		this.args.link = "http://" + this.args.host + "/services/tables/" + this.args.table;

		//Find Column Names
	    //Grab from stash if we have it already
	    //TODO: don't use settings object to store column names.  use Express' app object
	
		if (settings.columnNames && settings.columnNames[this.args.table]) {
			this.args.featureCollection = {};
			this.args.featureCollection.columns = settings.columnNames[this.args.table].rows;

			this(settings.columnNames[this.args.table]);
			//Pass on in flow
		} else {
			//copy for closure
			var args = this.args;
			var flo = this;

			var query = {
				text : "select column_name, CASE when data_type = 'USER-DEFINED' THEN udt_name ELSE data_type end as data_type from INFORMATION_SCHEMA.COLUMNS where table_name = $1",
				values : [this.args.table]
			};
			
			common.executePgQuery(query, function(err, result) {
			    //check for error
			    if (err) {
			        
					//Report error and exit.
					args.errorMessage = err.text;
					flo();
					//go to next flow
				} else if (result && result.rows && result.rows.length > 0) {

					args.featureCollection = {};
					args.featureCollection.columns = result.rows;

					//Stash
					if (!settings.columnNames) {
						settings.columnNames = {};
					}

					settings.columnNames[args.table] = result;

					flo(result);
					//Call and pass to flow when done
				} else {
				    //unknown table, or no columns?
					flo({
						rows : []
					});
					//go to next flow
				}
			});
		}
	}, function(result) {
		//Expecting an array of columns and types
	    
		//Add supported operations in a property
		this.args.featureCollection.supportedOperations = [];
		this.args.featureCollection.supportedOperations.push({
			link : this.args.fullURL + "/query",
			name : "Query"
		});

		var rasterOrGeometry = {
			present : false,
			name : ""
		};

		var args = this.args;
		//copy for closure

		result.rows.forEach(function(item) {
			if (item.data_type == "raster") {
				args.featureCollection.supportedOperations.push({
					link : args.fullURL + "/rasterOps",
					name : "Raster Operations"
				});
				rasterOrGeometry.present = true;
				rasterOrGeometry.name = common.escapePostGresColumns([item.column_name])[0];
			} else if (item.data_type == "geometry") {
			    if (mapnik)
			        args.featureCollection.supportedOperations.push({
			            link: args.fullURL + "/dynamicMapLanding",
			            name: "Dynamic Map Service"
			        });
			    args.featureCollection.supportedOperations.push({
			        link: args.fullURL + "/topojson",
			        name: "TopoJSON"
			    });
			    rasterOrGeometry.present = true;
			    rasterOrGeometry.name = common.escapePostGresColumns([item.column_name])[0];
			}
		});

		this.args = args;
		//update this.args property

		//If there's a geom or raster column, then check for SRID
		this.spatialTables = app.get('spatialTables');

		if (rasterOrGeometry.present === true) {
		    if (this.spatialTables[this.args.table] && this.spatialTables[this.args.table].srid) {
		        this({
		            rows: [{
		                srid: this.spatialTables[this.args.table].srid
		            }]
		        });
		    } else {
		        //check SRID
		        var query = {
		            text: "select ST_SRID(" + rasterOrGeometry.name + ") as SRID FROM " + this.args.table + " LIMIT 1;",
		            values: []
		        };
		        common.executePgQuery(query, this);
		    }
		} else {
		    //Not a spatial table
		    //No SRID
		    this({
		        rows: [{
		            srid: -1
		        }]
		    }); //flow to next function
		}
	}, function(err, result) {
		//Coming from SRID check
		if (err) {
			//Report error and exit.
			this.args.errorMessage = err.text;
		} else if (result && result.rows && result.rows.length > 0) {
			//Get SRID
			if (result.rows[0].srid == 0 || result.rows[0].srid == "0") {
				this.args.infoMessage = "Warning:  this table's SRID is 0.  Projections and other operations will not function propertly until you <a href='http://postgis.net/docs/UpdateGeometrySRID.html' target='_blank'>set the SRID</a>.";
			} else if (result.rows[0].srid == -1) {
			    //Not a spatial table
			    this.args.SRID = "";
			}
			else {
				this.args.SRID = result.rows[0].srid;
				//Use the SRID
				if (this.spatialTables[this.args.table]) {
					this.spatialTables[this.args.table].srid = result.rows[0].srid;
				} else {
					//Add the table name and the SRID
					this.spatialTables[this.args.table] = {};
					this.spatialTables[this.args.table].srid = result.rows[0].srid;
				}
			}
		} else {
			//no match found.
			this.args.infoMessage = "Couldn't find information for this table.";
		}

		//Render HTML page with results at bottom
		common.respond(this.req, this.res, this.args);
	}));

	//Table Query - get - display page with default form
	app.all('/services/tables/:table/query', flow.define(
	//If the querystring is empty, just show the regular HTML form.

	function(req, res) {
		this.req = req;
		this.res = res;

		this.args = {};
		//Grab POST or QueryString args depending on type
		if (req.method.toLowerCase() == "post") {
			//If a post, then arguments will be members of the this.req.body property
			this.args = req.body;
		} else if (req.method.toLowerCase() == "get") {
			//If request is a get, then args will be members of the this.req.query property
			this.args = req.query;
		}

		//Prepare Stash
		if (!settings.columnNames) {
			settings.columnNames = {};
		}

		this.spatialTables = app.get('spatialTables');

		settings.application.host = app.get('ipaddr') || "localhost";

		// arguments passed to renameAndStat() will pass through to this first function
		if (JSON.stringify(this.args) != '{}') {
			//See if they want geometry
			this.args.returnGeometry = this.args.returnGeometry || "no";
			//default
			this.args.returnGeometryEnvelopes = this.args.returnGeometryEnvelopes || "no";
			//default
			this.args.table = req.params.table;
			this.args.path = req.path;
			this.args.host = settings.application.publichost || req.headers.host;
			this.args.breadcrumbs = [{
				link : "/services/tables",
				name : "Table Listing"
			}, {
				link : "/services/tables/" + this.args.table,
				name : this.args.table
			}, {
				link : "",
				name : "Query"
			}];
			this.args.view = "table_query";

			this.args.formatlist = settings.application.formatList;
			//TODO - just set this once.  Not on every request

			if (this.spatialTables[this.args.table]) {
			    //Either not listed, or not a spatial table
			    this.args.SRID = this.spatialTables[this.args.table].srid//Use the stored SRID
			} else {
			    this.args.SRID = ""; //Not spatial or not listed.
			}

			//See if columns exist for this table in settings.js
			if (settings.columnNames[this.args.table]) {
				this();
			} else {
				//Trigger the table_details endpoint.  That will load the columns into settings.js (globally)
				var flo = this;
				common.executeSelfRESTRequest(this.args.table, "/services/tables/" + this.args.table, {
					where : "1=1",
					format : "geojson"
				}, function() {
					common.log("refreshed column list");
					flo();
				}, settings);
			}

		} else {
			//If the querystring is empty, just show the regular HTML form.
			//Render Query Form without any results.
			this.args.table = req.params.table;
			this.args.view = "table_query";
			this.args.formatlist = settings.application.formatList;
			//TODO - just set this once.  Not on every request
			this.args.breadcrumbs = [{
				link : "/services/tables",
				name : "Table Listing"
			}, {
				link : "/services/tables/" + this.args.table,
				name : this.args.table
			}, {
				link : "",
				name : "Query"
			}];
			
			if (this.spatialTables[this.args.table]) {
			    //Either not listed, or not a spatial table
			    this.args.SRID = this.spatialTables[this.args.table].srid//Use the stored SRID
			} else {
			    this.args.SRID = ""; //Not spatial or not listed.
			}

			var args = this.args;

			//See if columns exist for this table in settings.js

			if (settings.columnNames[this.args.table]) {
				this.args.columnNames = settings.columnNames[this.args.table].rows;

				common.respond(req, res, args);
			} else {
                //TODO: I don't know if this will work.  Settings is not shared between all modules. It's static.  Use express variables instead.
				//Trigger the table_details endpoint.  That will load the columns into settings.js (globally)
				common.executeSelfRESTRequest(args.table, "/services/tables/" + this.args.table, {
					where : "1=1",
					format : "geojson"
				}, function() {
					args.columnNames = settings.columnNames[args.table].rows;

					common.log("refreshed column list");
					common.respond(req, res, args);
				}, settings);
			}
		}
	}, function() {
		//should have column names in settings.js now
		this.args.columnNames = settings.columnNames[this.args.table].rows;

		//either way, get the spatial columns so we can exclude them from the query
		createSpatialQuerySelectStatement(this.args.table, this.args.outputsrid, this);

	}, function (geom_fields_array, geom_select_array, geom_envelope_array, geom_envelope_fields) {
		//Coming from createSpatialQuerySelectStatement
		//Store the geom_fields for use later
		this.args.geom_fields_array = geom_fields_array;
		//hold geom column names
		this.args.geom_envelope_array = geom_envelope_array;
	    //holds the envelope SELECT statement
		this.args.geom_envelope_fields = geom_envelope_fields;
	    //hold geom envelope column names
		this.where = this.args.where || "";
		//where clause - copy to local variable
		this.args.groupby = this.args.groupby || "";
		//group by fields
		this.args.statsdef = this.args.statsdef || "";
        //statistics definition clause

	    //Limit is mainly for the HTML response page.  Don't want too many records coming back there.
		if (this.args.format && this.args.format.toLowerCase() == "html") {
		    this.limit = this.args.limit || settings.pg.featureLimit || 1000;
		}
		else {
		    //for other formats, only use a limit if present
		    this.limit = this.args.limit || -1;
		}

		//requested select fields
		this.returnfields = this.args.returnfields || "";
		//return fields - copy to local variable so we don't mess with the original

		//return geom?
		if (this.args.returnGeometry == "yes") {
			//If we got some geom queries, store them here.
			this.args.geometryStatement = geom_select_array.join(",");
		} else {
			//No geometry desired.  That means you can't have a 'shapefile' as output. Check
		    if (this.args.format && this.args.format.toLowerCase() == 'shapefile') {
				this.args.errorMessage = "Format 'shapefile' requires returnGeometry to be 'yes'.";
				common.respond(this.req, this.res, this.args);
				return;
			}

			this.args.geometryStatement = "";
			this.args.geom_fields_array = [];
			//empty it
		}

		//return geom envelopes?
		if (this.args.returnGeometryEnvelopes == "yes") {
			//If we got some geom queries, store them here.
			if (this.args.geometryStatement) {
				this.args.geometryStatement += "," + geom_envelope_array.join(",");
			} else {
				this.args.geometryStatement = geom_envelope_array.join(",");
			}
		} else {
			this.args.geom_envelope_array = [];
			//empty it
		}

		//group by? must be accompanied by some stats definitions
		if (this.args.groupby) {
			if (this.args.statsdef) {
				//If provided, a statistics definition will override the SELECT fields, and NO geometry is returned.
				//COULD work later to dissolve geometries by the group by field.
				var statsDefArray = this.args.statsdef.split(",");
				//break up if multiple defs
				var statsSQLArray = [];
				var infoMessage = "";

				statsDefArray.forEach(function(def) {
					if (def.split(":").length == 2) {
						var operation = def.split(":")[0].toLowerCase();
						var column = def.split(":")[1];
						statsSQLArray.push(operation + "(" + column + ") as " + operation + "_" + column);
					} else {
						this.args.infoMessage = "must have 2 arguments for a stats definition, such as -  sum:columnname";
					}
				}.bind(this));

				if (this.args.infoMessage) {
					//Friendly message
					common.respond(this.req, this.res, this.args);
					return;
				}

				//If we're here, then the group by fields should be added to the select statement as well.
				statsSQLArray.push(this.args.groupby);

				//We've got a new select statement. Override the old one.
				this.returnfields = statsSQLArray.join(",");

			    //Because we're modifying the user's group-by clause by potentially adding the geometry columns, we want to clone this variable so it remains untouched when displaying in the UI
			    //Internally, from this point on, we'll use a variable called groupby_appended, so we can return the unmolested groupby back to the UI.
				this.args.groupby_appended = this.args.groupby;

			    //If geometry is included, need to add items to the GROUP BY statement
				if (this.args.geometryStatement) {
				    //break up the geom statement, first by commas, then by aliases
				    var multiGeoms = this.args.geometryStatement.split(","); //if multiple geometries, or geometry and extent
				    multiGeoms.forEach(function (item) {
				        this.args.groupby_appended += ("," + item.split(" As ")[0]);
				    }.bind(this));
				}
			} else {
				//friendly message - exit out
				this.args.infoMessage = "Group by clause must be accompanied by a statistics definition";

				common.respond(this.req, this.res, this.args);
				return;
			}
		}


        //Intersects (GeoJSON) gets priority over wkt intersects if both are defined.
        //Intersects is a GeoJSON argument that needs to be parsed to create a PostGIS GeoJSON Fragment 
		if (this.args.intersects) {
		    //Just do the first geom field for now.  TODO
		    var intersects = new GeoFragger();
		    try{
		        var geojson = JSON.parse(this.args.intersects);
		        intersects = intersects.toPostGISFragment(geojson);
		    } catch (e) {
		        //friendly message - exit out
		        this.args.errorMessage = e.message;

		        common.respond(this.req, this.res, this.args);
		        return;
		    }
		    
		    var intersects_array = [];
		    geom_fields_array.forEach(function (item) {
		        intersects_array.push("ST_Intersects(ST_GeomFromGeoJSON('" + JSON.stringify(intersects) + "')," + item + ")");
		    });
		    this.intersects = intersects_array;
		}
	    //Add in WKT Geometry to WHERE clause , if specified
	    //For now, assuming 4326.  TODO
		else if (this.args.wkt) {
		    //For each geometry in the table, give an intersects clause
		    var wkt = this.args.wkt;
		    var wkt_array = [];
		    geom_fields_array.forEach(function (item) {
		        wkt_array.push("ST_Intersects(ST_GeomFromText('" + wkt + "', 4326)," + item + ")");
		    });
		    this.wkt = wkt_array;
		}

		//Add in WHERE clause, if specified.  Don't alter the original incoming paramter.  Create this.where to hold modifications
		if (this.args.where)
			this.where = " " + this.where;

		if (this.where.length > 0) {
			this.where = " WHERE " + "(" + this.where + ")";
		    //make sure where clause stands on it's own by wrapping in parenthesis
			if (this.intersects) {
			    this.where += (" AND (" + this.intersects.join(" OR ") + ")");
			}
			else if (this.wkt) {
				this.where += (" AND (" + this.wkt.join(" OR ") + ")");
			}
		} else {
            //Intersects gets priority here (GeoJSON)
		    if (this.intersects) {
		        this.where += " WHERE (" + this.intersects.join(" OR ") + ")";
		    }
			else if (this.wkt) {
				this.where += " WHERE (" + this.wkt.join(" OR ") + ")";
			}
			else {
			    this.where = " WHERE 1=1";
			}
		}

		//provide all columns (except geometries).
		if (this.returnfields.legnth == 0 || this.returnfields == "" || this.returnfields.trim() == "*") {
			createSelectAllStatementWithExcept(this.args.table, common.unEscapePostGresColumns(geom_fields_array).join(","), this);
			//Get all fields except the no fly list
		} else {
			//flow to next block - pass fields
			this(null, this.returnfields);
		}

	}, function(err, fieldList) {
		//Coming from createSelectAllStatementWithExcept
		//build SQL query
		if (common.isValidSQL(fieldList) && common.isValidSQL(this.args.geometryStatement) && common.isValidSQL(this.args.table) && common.isValidSQL(this.args.where) && common.isValidSQL(this.args.groupby)) {
			var query = {
				text : "SELECT " + fieldList +
				//Dynamically plug in geometry piece depending on the geom field name(s)
				(this.args.geometryStatement ? ", " + this.args.geometryStatement : "") + " FROM " + common.escapePostGresColumns([this.args.table]).join(",") + //escape
				this.where + (this.args.groupby_appended ? " GROUP BY " + this.args.groupby_appended : "") + (this.limit && common.IsNumeric(this.limit) && this.limit != "-1" ? " LIMIT " + this.limit : ""),
				values : []
			};

			var args = this.args;
			//copy for closure.
			var req = this.req;
			//copy for closure.
			var res = this.res;
			//copy for closure.

			common.executePgQuery(query, this);
			//pass to next flow
		} else {
			//Invalid SQL was entered by user.
			//Exit.
			this.args.infoMessage = "Invalid SQL was entered. Try again.";

			common.respond(this.req, this.res, this.args);
			return;
		}
	}, function(err, result) {

		var flo = this;
		//Save for closure //TODO - Use _self

		this.args.scripts = [settings.leaflet.js, settings.jquery.js];
		//Load external scripts for map preview
		this.args.css = [settings.leaflet.css];

		var features = [];

		//check for error
		if (err) {
			//Report error and exit.
			this.args.errorMessage = err.text;
			flo();
		} else {
			//a-ok
			//Check which format was specified
			if (!this.args.format || this.args.format.toLowerCase() == "html") {
				//Render HTML page with results at bottom
			    this.args.featureCollection = common.formatters.geoJSONFormatter(result.rows, common.unEscapePostGresColumns(this.args.geom_fields_array), common.unEscapePostGresColumns(this.args.geom_envelope_fields));
				//The page will parse the geoJson to make the HTMl
				flo();
				//For now - hard coded.  Create new dynamic endpoint for this GeoJSON
				//nodetiles.createDynamicGeoJSONEndpoint(features, args.table, "4326", "style.mss");
			} else if (this.args.format && this.args.format.toLowerCase() == "geojson") {
				//Respond with JSON
			    this.args.featureCollection = common.formatters.geoJSONFormatter(result.rows, common.unEscapePostGresColumns(this.args.geom_fields_array), common.unEscapePostGresColumns(this.args.geom_envelope_fields));
				flo();
				//For now - hard coded.  Create new dynamic endpoint for this GeoJSON
				//nodetiles.createDynamicGeoJSONEndpoint(features, args.table, "4326", "style.mss");
			} else if (this.args.format && this.args.format.toLowerCase() == "esrijson") {
				//Respond with esriJSON
			    this.args.featureCollection = common.formatters.ESRIFeatureSetJSONFormatter(result.rows, common.unEscapePostGresColumns(this.args.geom_fields_array), common.unEscapePostGresColumns(this.args.geom_envelope_fields));
				flo();
			} else if (this.args.format && this.args.format.toLowerCase() == "shapefile") {
				//Make a Shapefile with the GeoJSON.  Then offer it up for download.
				//Make a GeoJSON object from the features first.
			    features = common.formatters.geoJSONFormatter(result.rows, common.unEscapePostGresColumns(this.args.geom_fields_array), common.unEscapePostGresColumns(this.args.geom_envelope_fields));

				//Convert the GeoJSON object to a shapefile
				var shapefile = ogr2ogr(features).format('ESRI Shapefile').stream();

				var filePath = "." + settings.application.topoJsonOutputFolder + 'shapefile_' + shortid.generate() + '.zip';
				var fileWriteStream = fs.createWriteStream(filePath);

				//Set the callback for when the shapefile is done writing
				fileWriteStream.on("finish", function() {
					flo.args.file = filePath;
					flo();
					//Go to next block
				})
				//Write
				shapefile.pipe(fileWriteStream);
			} else if (this.args.format && this.args.format.toLowerCase() == "csv") {
			    //CSV
			    this.args.featureCollection = common.formatters.CSVFormatter(result.rows, common.unEscapePostGresColumns(this.args.geom_fields_array));
			    flo();
			}
		}
	}, function() {
		//coming back from shapefile creation or other file processing
		common.respond(this.req, this.res, this.args, function(file) {
			//clean up if shapefile was generated
			if (file) {
				fs.unlink(file, function(err) {
					if (err) {
						console.log("Problem deleting shapefile " + file + " :" + err);
					} else {
						console.log('Deleted shapefile ' + file);
					}
				});
			}
		});
	}));

	//Raster Operations Home Page - get - display page with default form
	app.all('/services/tables/:table/rasterOps', function(req, res) {
		//Show raster operations page
		var args = {};
		args.opslist = [{
			link : 'zonalstatistics',
			name : 'Zonal Statistics'
		}];
		args.view = "rasterops";
		args.breadcrumbs = [{
			link : "/services/tables",
			name : "Table Listing"
		}, {
			link : "/services/tables/" + req.params.table,
			name : req.params.table
		}, {
			link : "",
			name : "Raster Ops"
		}];
		args.path = req.path;
		args.host = req.headers.host;

		common.respond(req, res, args);
	});

	//ZonalStats - get - display page with default form
	app.all('/services/tables/:table/rasterOps/zonalstatistics', flow.define(
	//If the querystring is empty, just show the regular HTML form.

	function(req, res) {
		this.req = req;
		this.res = res;

		this.args = {};

		//Grab POST or QueryString args depending on type
		if (req.method.toLowerCase() == "post") {
			//If a post, then arguments will be members of the this.req.body property
			this.args = req.body;
		} else if (req.method.toLowerCase() == "get") {
			//If request is a get, then args will be members of the this.req.query property
			this.args = req.query;
		}

		if (JSON.stringify(this.args) != '{}') {

			this.args.table = req.params.table;
			this.args.view = "zonalstatistics";
			this.args.breadcrumbs = [{
				link : "/services/tables",
				name : "Table Listing"
			}, {
				link : "/services/tables/" + req.params.table,
				name : req.params.table
			}, {
				link : "/services/tables/" + req.params.table + "/rasterOps",
				name : "Raster Ops"
			}, {
				link : "",
				name : "Zonal Statistics"
			}];
			this.args.path = req.path;
			this.args.host = req.headers.host;
			this.args.featureCollection = {};

			var statType = (req.body.statType ? req.body.statType : "sum");

			//Add in WKT, if specified
			var wkt = "";
			//create internal var so we don't alter the original variable.
			if (this.args.wkt)
				wkt = " " + this.args.wkt;

			if (wkt.length == 0) {
				this.args.errorMessage = "You must specify an input geometry in WKT format."
				common.respond(this.req, this.res, this.args);
				return;
			}

			if (this.args.wkt.toLowerCase().indexOf('point') == 0) {
				//if a point geom, then buffer is mandatory

				if (!this.args.bufferdistance) {
					//Tell them that you're setting it to a default, but continue with the operation (happens in next flow)
					this.args.infoMessage = "Point geometries need to have a buffer set. Default buffer of 500 meters was used."
				}
			}

			//Dynamically fetch the raster name for this table.
			getRasterColumnName(this.args.table, this);
		} else {
			//Render Query Form without any results.
			this.args.table = this.req.params.table;
			this.args.view = "zonalstatistics";
			this.args.breadcrumbs = [{
				link : "/services",
				name : "Table Listing"
			}, {
				link : "/services/tables/" + this.args.table,
				name : this.args.table
			}, {
				link : "/services/tables/" + this.args.table + "/rasterOps",
				name : "Raster Ops"
			}, {
				link : "",
				name : "Zonal Statistics"
			}];

			common.respond(this.req, this.res, this.args);
		}
	}, function(raster_column_name) {
		//Coming back from getRasterColumnName.  Should return a string. Assuming just 1 raster column per table.

		//var query = {
		//    text: "SELECT SUM((ST_SummaryStats(ST_Clip(rast,1,ST_GeomFromText('" +
		//    req.body.wkt +
		//    "', 4326), true)))." + statType + ")" +
		//    "FROM " + args.table +
		//    " WHERE ST_Intersects(ST_GeomFromText('" + req.body.wkt +
		//    "', 4326),rast)", values: []
		//};

		if (raster_column_name) {
			var bufferdistance = 500;
			//default if distance is not numeric or not specified

			if (this.args.bufferdistance && common.IsNumeric(this.args.bufferdistance)) {
				bufferdistance = this.args.bufferdistance;
			} else {
				//set it as an output parameter to be written to template
				this.args.bufferdistance = bufferdistance;
			}

			var query = {
				text : "DO $$DECLARE " + "orig_srid int; " + "utm_srid int; " + "input geometry := ST_GeomFromText('" + this.args.wkt + "', 4326); " + //TODO: make the input SRID dymamic.
				"geomgeog geometry; " + "buffer geometry; " + "zone int; " + "pref int; " + "BEGIN " + "geomgeog:= ST_Transform(input,4326); " +
				//See if incoming WKT is a point.  If so, use the ST_Y to find the right zone.  Otherwize, get the centroid, and get the y from that.
				(this.args.wkt.toLowerCase().indexOf("point") == 0 ? "IF (ST_Y(geomgeog))>0 THEN pref:=32600; ELSE pref:=32700; END IF;" : "IF (ST_Y(ST_CENTROID(geomgeog))) > 0 THEN pref:=32600; ELSE pref:=32700; END IF; ") + (this.args.wkt.toLowerCase().indexOf("point") == 0 ? "zone:=floor((ST_X(geomgeog)+180)/6)+1; " : "zone:=floor((ST_X(ST_CENTROID(geomgeog))+180)/6)+1; ") + " " + "orig_srid:= ST_SRID(input); " + "utm_srid:= zone+pref; " +

				//If a point, buffer.  Otherwise, don't.
				(this.args.wkt.toLowerCase().indexOf("point") == 0 ? "buffer:= ST_transform(ST_Buffer(ST_transform(input, utm_srid), " + bufferdistance + "), 4326);" : "buffer:=input; ") + "drop table if exists _zstemp; " + //TODO: Add session ID (or something) to make sure this is dynamic.
				"create temporary table _zstemp as " + "SELECT SUM((ST_SummaryStats(ST_Clip(" + raster_column_name + ", buffer , true)))." + this.args.stattype + ") as  " + this.args.stattype + ", ST_ASGeoJSON(buffer) as geom, ST_AsText(buffer) as wkt " + //Todo - get raster's SRID dynamically and make sure the buffer is transformed to that SRID.
				" FROM " + this.args.table + " WHERE ST_Intersects(buffer," + raster_column_name + "); " + //Todo - get raster's SRID dynamically and make sure the buffer is transformed to that SRID.

				"END$$; " + "select * from _zstemp;",
				values : []
			};

			var args = this.args;
			//copy for closure.
			var req = this.req;
			//copy for closure.
			var res = this.res;
			//copy for closure.

			common.executePgQuery(query, function(err, result) {

				if (err) {
					//Report error and exit.
					args.errorMessage = err.text;

				} else {

					var features = "";

					//Check which format was specified
					if (!args.format || args.format.toLowerCase() == "html") {
						//Render HTML page with results at bottom
						features = common.formatters.geoJSONFormatter(result.rows, ["geom"]);
						//The page will parse the geoJson to make the HTMl
					} else if (args.format && args.format.toLowerCase() == "geojson") {
						//Respond with JSON
						features = common.formatters.geoJSONFormatter(result.rows, ["geom"]);
					} else if (args.format && args.format.toLowerCase() == "esrijson") {
						//Respond with esriJSON
						features = common.formatters.ESRIFeatureSetJSONFormatter(result.rows, ["geom"]);
					}

					args.featureCollection = features;
				}

				common.respond(req, res, args);
			});
		}
	}));

	//list topojson files for a particular dataset, and let user create a new one.
	app.all('/services/tables/:table/topojson', flow.define(
	//If the querystring is empty, just show the regular HTML form.

	function(req, res) {
		this.req = req;
		this.res = res;
		this.rootRelativePath = ".";
		//TODO - make this more dynamic.  It's how we'll know how to find the 'root' + public/foo to write the output files.

		this.args = {};

		//Grab POST or QueryString args depending on type
		if (this.req.method.toLowerCase() == "post") {
			//If a post, then arguments will be members of the this.req.body property
			this.args = this.req.body;
		} else if (this.req.method.toLowerCase() == "get") {
			//If request is a get, then args will be members of the this.req.query property
			this.args = this.req.query;
		}

		if (JSON.stringify(this.args) != '{}') {
			this.args.view = "topojson_list";
			this.args.table = this.req.params.table;
			this.args.breadcrumbs = [{
				link : "/services/tables",
				name : "Table Listing"
			}, {
				link : "/services/tables/" + this.args.table,
				name : this.args.table
			}, {
				link : "",
				name : "TopoJSON"
			}];
			this.args.path = this.req.path;
			this.args.host = this.req.headers.host;
			this.args.files = [];

			if (this.args.topofilename) {
				//Make the File if flag was sent

				//First - check to see if GeoJSON output folder exists for this table
				console.log("checking for folder: " + this.rootRelativePath + settings.application.geoJsonOutputFolder + this.args.table);
				fs.exists(this.rootRelativePath + settings.application.geoJsonOutputFolder + this.args.table, this);
			} else {
				//Expecting a topofilename
				common.respond(req, res, args);
			}
		} else {
			//Respond with list.
			this.args.view = "topojson_list";
			this.args.table = this.req.params.table;
			this.args.breadcrumbs = [{
				link : "/services/tables",
				name : "Table Listing"
			}, {
				link : "/services/tables/" + this.args.table,
				name : this.args.table
			}, {
				link : "",
				name : "TopoJSON"
			}];
			this.args.path = this.req.path;
			this.args.host = this.req.headers.host;

			this.args.files = [];

			var args = this.args;
			//copy for closure

			console.log(this.rootRelativePath);
			console.log(settings.application.topoJsonOutputFolder);
			console.log(this.args.table);
			//Find all existing topojson files in the public/topojson/output folder

			console.log("checking for folder: " + this.rootRelativePath + settings.application.topoJsonOutputFolder + this.args.table);

			fs.exists(this.rootRelativePath + settings.application.topoJsonOutputFolder + this.args.table, function(exists) {
				if (exists === true) {
					fs.readdirSync(path.join(".", settings.application.topoJsonOutputFolder, args.table)).forEach(function(file) {
						if (file.indexOf("topo_") == 0) {
							args.files.push({
								link : settings.application.topoJsonOutputFolder + file,
								name : file
							});
						}
					});
					common.respond(req, res, args);

				} else {
					//Doesn't exist
					common.respond(req, res, args);
				}
			});
		}
	}, function(exists) {
		//Coming from flow - check if geojson output folder exists
		if (exists === false) {
			//make it
			console.log("Didn't find it.  Tyring to make folder: " + this.rootRelativePath + settings.application.geoJsonOutputFolder + this.args.table);
			fs.mkdirSync(this.rootRelativePath + settings.application.geoJsonOutputFolder + this.args.table);
			//Synch
		}

		console.log("checking for folder: " + this.rootRelativePath + settings.application.topoJsonOutputFolder + this.args.table);
		//Now, check to see if table has a topojson subfolder on disk
		fs.exists("." + settings.application.topoJsonOutputFolder + this.args.table, this);

	}, function(exists) {
		//coming from check if topojson folder exists
		if (exists === false) {
			console.log("Didn't find it.  Tyring to make folder: " + this.rootRelativePath + settings.application.topoJsonOutputFolder + this.args.table);
			fs.mkdirSync(this.rootRelativePath + settings.application.topoJsonOutputFolder + this.args.table);
			//Synch
		}

		var args = this.args;
		//copy for closure
		var req = this.req;
		var res = this.res;
		var relativeRootPath = this.rootRelativePath;

		//Make the Geo File
		makeGeoJSONFile(this.args.table, this.args.topofilename, function(error, filename, filepath) {
			if (error) {
				args.infoMessage = error.message;
				common.respond(req, res, args);
				return;
			} else {
				//created geojson folder
				args.infoMessage = "Created file - " + filename;

				//Now turn file into TopoJSON - pass in original file, topo file, callback
				geoJSONToTopoJSON(args.table, filename, "topo_" + filename, function(error, stdout) {
					if (error) {
						args.errorMessage = error.message;
					} else {
						console.log("Finished making Topo File.");
						args.infoMessage = stdout;

						//Find all existing topojson files in the public/topojson/output folder
						fs.readdirSync(path.join(relativeRootPath, settings.application.topoJsonOutputFolder, args.table)).forEach(function(file) {
							if (file.indexOf("topo_") == 0) {
								args.files.push({
									link : settings.application.topoJsonOutputFolder + args.table + "/" + file,
									name : file
								});
							}
						});
					}

					common.respond(req, res, args);
				});
			} //End  if error
		});
	}));

	//If mapnik exists, then load the endpointDynamic
	if (mapnik) {
		//Show users about a table's dynamic map service, along with a preview
		app.all('/services/tables/:table/dynamicMapLanding', flow.define(function(req, res) {
			this.args = {};
			this.req = req;
			this.res = res;

			//Grab POST or QueryString args depending on type
			if (this.req.method.toLowerCase() == "post") {
				//If a post, then arguments will be members of the this.req.body property
				this.args = this.req.body;
			} else if (this.req.method.toLowerCase() == "get") {
				//If request is a get, then args will be members of the this.req.query property
				this.args = this.req.query;
			}

			this.args.view = "table_dynamic_map";
			this.args.table = this.req.params.table;
			this.args.breadcrumbs = [{
				link : "/services/tables/",
				name : "Table Listing"
			}, {
				link : "/services/tables/" + this.args.table,
				name : this.args.table
			}, {
				link : "",
				name : "Dynamic Map Service"
			}];
			this.args.path = this.req.path;
			this.args.host = settings.application.publichost || this.req.headers.host;

			//Get geometry names
			getGeometryFieldNames(this.args.table, this);

		}, function(err, geom_fields_array) {
			
			this.spatialTables = app.get('spatialTables');

			//This should have a value
			var srid = this.spatialTables[this.args.table].srid;

			//coming back from getGeometryFieldNames
			//for now, assume just 1 geometry.  TODO
			if (geom_fields_array.length > 0) {
				//Check for layer extent
				//Transform to 4326 if 3857
				var query;
				if (srid && (srid == 3857 || srid == 3587)) {
					query = {
						text : "SELECT ST_Extent(ST_Transform(" + geom_fields_array[0] + ", 4326)) as table_extent FROM " + this.args.table + ";",
						values : []
					};
				} else {
					query = {
						text : "SELECT ST_Extent(" + geom_fields_array[0] + ") as table_extent FROM " + this.args.table + ";",
						values : []
					};
				}
				common.executePgQuery(query, this);
			} else {
				//No geom column or no extent or something.
				this.args.errorMessage = "Problem getting the geom column for this table.";
				common.respond(this.req, this.res, this.args);
				return;
			}
		}, function(err, result) {

			if (err) {
				this.args.errorMessage = "Problem getting the extent for this table.";
			} else { 
				var bboxArray = result.rows[0].table_extent.replace("BOX(", "").replace(")", "").split(",");
				//Should be BOX(XMIN YMIN, XMAX YMAX)
				this.args.xmin = bboxArray[0].split(" ")[0];
				this.args.ymin = bboxArray[0].split(" ")[1];
				this.args.xmax = bboxArray[1].split(" ")[0];
				this.args.ymax = bboxArray[1].split(" ")[1];

				//Write out the details for this map service
				this.args.featureCollection = [];
				this.args.featureCollection.push({
					name : "Map Service Endpoint",
					link : "http://" + this.args.host + "/services/postgis/" + this.args.table + "/dynamicMap"
				});
				this.args.extent = result.rows[0];

				//load leaflet
				this.args.scripts = [settings.leaflet.js];
				//Load external scripts for map preview
				this.args.css = [settings.leaflet.css];
			}

			common.respond(this.req, this.res, this.args);
		}));
	}


	//pass in a table, and a comma separated list of fields to NOT select
	function createSelectAllStatementWithExcept(table, except_list, callback) {
		var query = {
			text : "SELECT c.column_name::text FROM information_schema.columns As c WHERE table_name = $1 AND  c.column_name NOT IN ($2)",
			values : [table, except_list]
		};
		common.executePgQuery(query, function(err, result) {
            if(err){
                callback(err);
                return;
            }
			var rows = result.rows.map(function(item) {
				return item.column_name;
			});

			//Get array of column names
			//Wrap columns in double quotes
			rows = common.escapePostGresColumns(rows);

			//Callback
			callback(err, rows.join(","));
		});
	}

	var createSpatialQuerySelectStatement = flow.define(function(table, outputsrid, callback) {
		this.callback = callback;
		this.outputsrid = outputsrid;
		getGeometryFieldNames(table, this);
	}, function(err, geom_fields_array) {
		//Array of geometry columns
		console.log(" in geom fields. " + geom_fields_array.length);
		if (geom_fields_array.length == 0) {
			this.callback([], []);
		} else {
			var geom_query_array = [];
			var geom_envelope_array = [];
            var geom_envelope_names = [];

			// in case they want envelopes
			var outputsrid = this.outputsrid;

			//Format as GeoJSON
			if (this.outputsrid) {
				geom_fields_array.forEach(function(item) {
					geom_query_array.push("ST_AsGeoJSON(ST_Transform(" + item + ", " + outputsrid + ")) As " + item);
					geom_envelope_array.push("ST_AsGeoJSON(ST_Transform(ST_Envelope(" + item + "), " + outputsrid + ")) As " + ('"' + item.replace(/"/g, "") + "_envelope" + '"'));
                    geom_envelope_names.push(item.replace(/"/g, "") + "_envelope");
                });
			} else {
				geom_fields_array.forEach(function(item) {
					geom_query_array.push("ST_AsGeoJSON(" + item + ") As " + item);
					geom_envelope_array.push("ST_AsGeoJSON(ST_Envelope(" + item + ")) As " + ('"' + item.replace(/"/g, "") + "_envelope" + '"'));
                    geom_envelope_names.push(item.replace(/"/g, "") + "_envelope");
				});
			}

			this.callback(geom_fields_array, geom_query_array, geom_envelope_array, geom_envelope_names);
		}
	});

	//pass in a table, get an array of geometry columns
	function getGeometryFieldNames(table, callback) {

		if (table == '')
			callback([]);
		//If no table, return empty array

		var query = {
			text : "select column_name from INFORMATION_SCHEMA.COLUMNS where (data_type = 'USER-DEFINED' AND udt_name = 'geometry') AND table_name = $1",
			values : [table]
		};
		common.executePgQuery(query, function(err, result) {
            if(err){
                callback(err);
                return;
            }

			var rows = result.rows.map(function(item) {
				return item.column_name;
			});
			//Get array of column names
			//Wrap columns in double quotes
			rows = common.escapePostGresColumns(rows);

			//Callback
			callback(err, rows);
		});
	};

	//pass in a table, get an array of geometry columns
	function getRasterColumnName(table, callback) {
		if (table == '')
			callback([]);
		//If no table, return empty array

		var query = {
			text : "select column_name from INFORMATION_SCHEMA.COLUMNS where (data_type = 'USER-DEFINED' AND udt_name = 'raster') AND table_name = $1",
			values : [table]
		};
		common.executePgQuery(query, function(err, result){
            if(err){
                callback(err);
                return;
            }

			var rows = result.rows.map(function(item) {
				return item.column_name;
			});
			//Get array of column names

			//Wrap columns in double quotes
			rows = common.escapePostGresColumns(rows);

			//Callback
			callback(err, rows);
		});
	};

	///TopoJSON functions - TODO - move to a separate module.

	//example
	//topojson -o output.json input.json
	function geoJSONToTopoJSON(table, geojsonfile, topojsonfile, callback) {
		var filename = geojsonfile.split(".")[0];
		var outputPath = path.join(__dirname, "../..", settings.application.topoJsonOutputFolder, table);
		var geoJsonPath = path.join(__dirname, "../..", settings.application.geoJsonOutputFolder, table);
		var sys = require('sys');
		var exec = require('child_process').exec
		console.log("About to execute: " + 'topojson -o ' + path.join(outputPath, topojsonfile) + " " + path.join(geoJsonPath, geojsonfile));
		child = exec('topojson -o ' + path.join(outputPath, topojsonfile) + " " + path.join(geoJsonPath, geojsonfile), function(error, stdout, stderr) {
			callback(error, stdout);
		});
	}

	//Query table's rest endpoint, write out GeoJSON file.
	function makeGeoJSONFile(table, filename, callback) {
		//Grab GeoJSON from our own rest service for this table.
		var options = {
			host : settings.application.host, //TODO - make this point to the environment variable to get the right IP
			path : "/services/tables/" + table + "/query?where=1%3D1&format=geojson&returnGeometry=yes&returnGeometryEnvelopes=no&limit=-1",
			port : settings.application.port
		};

		http.request(options, function(response) {
			var str = [];

			//another chunk of data has been recieved, so append it to `str`
			response.on('data', function(chunk) {
				str.push(chunk);
			});

			//the whole response has been recieved, so we just print it out here
			response.on('end', function() {
				console.log("ended API response");
				//Write out a GeoJSON file to disk - remove all whitespace
				var geoJsonOutFile = filename + '.json';
				fs.writeFile("." + settings.application.geoJsonOutputFolder + table + "/" + geoJsonOutFile, str.join("").replace(/\s+/g, ''), function(err) {
					if (err) {
						console.log(err.message);
					} else {
						console.log("created GeoJSON file.");
					}

					//pass back err, even if null
					callback(err, geoJsonOutFile, settings.application.geoJsonOutputFolder + table + "/" + geoJsonOutFile);
				});
			});
		}).end();
	}

    //Get the list of spatial tables.
    common.findSpatialTables(app, function (error, tables) {
        //set for this class
        app.set('spatialTables', tables);
    });
	
	
	return app;
};

