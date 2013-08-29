
/**
 * Module dependencies.
 */
var pg = require('pg');

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , settings = require('./settings')
  , url = require('url')
  , flow = require('flow');

var app = express();

var routes = [];


//PostGres Connection String
var conString = "postgres://" + settings.pg.username + ":" + settings.pg.password + "@" + settings.pg.server + ":" + settings.pg.port + "/" + settings.pg.database;

// all environments
app.set('ipaddr', settings.application.ip);
app.set('port', process.env.PORT || settings.application.port);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.enable("jsonp callback");
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(function (err, req, res, next) {
    console.error(err.stack);
    log(err.message);
    res.send(500, 'There was an error with the web service. Please try your operation again.');
    log('There was an error with the web servcice. Please try your operation again.');
});

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

//Define Routes

//Get list of public base tables from postgres
routes['listTables'] = function (req, res) {
    var args = {};
    args.view = "index";
    args.breadcrumbs = [{ link: "/services", name: "Home" }];
    args.url = req.url;
    args.list = [];

    try {
        var query = { text: "SELECT * FROM information_schema.tables WHERE table_schema = 'public' and (table_type = 'BASE TABLE' or table_type = 'VIEW') AND table_name NOT IN ('geography_columns', 'geometry_columns', 'raster_columns', 'raster_overviews', 'spatial_ref_sys') ORDER BY table_schema,table_name; ", values: [] };
        executePgQuery(query, function (result) {
            args.list = result.rows;
            //Render HTML page with results at bottom
            respond(req, res, args);
        });
    } catch (e) {
        respond(req, res, args);
    }
};

//List properties of the selected table, along with operations.
routes['tableDetail'] = function (req, res) {
    var args = {};
    args.view = "table_details";
    args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "", name: req.params.table }];
    args.url = req.url;
    args.table_details = [];

    var client = new pg.Client(conString);
    client.connect();

    var query = { text: "select column_name, CASE when data_type = 'USER-DEFINED' THEN udt_name ELSE data_type end as data_type from INFORMATION_SCHEMA.COLUMNS where table_name = $1", values: [req.params.table] };

    executePgQuery(query, function (result) {
        args.table_details = result.rows;
        //Render HTML page with results at bottom
        respond(req, res, args);
    });
}



//Allow for Table Query
routes['tableQuery'] = flow.define(
    //If the querystring is empty, just show the regular HTML form.

    function (req, res) {
        this.req = req;
        this.res = res;

        this.args = {};

        //Grab POST or QueryString args depending on type
        if (req.method.toLowerCase() == "post") {
            //If a post, then arguments will be members of the this.req.body property
            this.args = req.body;
        }
        else if (req.method.toLowerCase() == "get") {
            //If request is a get, then args will be members of the this.req.query property
            this.args = req.query;
        }


        // arguments passed to renameAndStat() will pass through to this first function
        if (JSON.stringify(this.args) != '{}') {
            //See if they want geometry
            this.args.returnGeometry = this.args.returnGeometry || "no"; //default
            this.args.returnGeometryEnvelopes = this.args.returnGeometryEnvelopes || "no"; //default
            this.args.table = req.params.table;

            //either way, get the spatial columns so we can exclude them from the query
            createSpatialQuerySelectStatement(this.args.table, this);
        }
        else {
            //If the querystring is empty, just show the regular HTML form.
            //Render Query Form without any results.
            this.args.table = req.params.table;
            this.args.view = "table_query";
            this.args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services/" + this.args.table, name: this.args.table }, { link: "", name: "Query" }];
            this.args.title = "GeoWebServices";

            respond(this.req, this.res, this.args);
        }

    }, function (geom_fields_array, geom_select_array, geom_envelope_array) {
        //Coming from createSpatialQuerySelectStatement
        //Store the geom_fields for use later
        this.args.geom_fields_array = geom_fields_array; //hold geom column names
        this.args.geom_envelope_array = geom_envelope_array; //hold geom envelope column names
        this.where = this.args.where || ""; //where clause - copy to local variable
        this.args.groupby = this.args.groupby || ""; //group by fields
        this.args.statsdef = this.args.statsdef || ""; //statistics definition clause

        //requested select fields
        this.args.returnfields = this.args.returnfields || ""; //default

        //return geom?
        if (this.args.returnGeometry == "yes") {
            //If we got some geom queries, store them here.
            this.args.geometryStatement = geom_select_array.join(",");
        }
        else {
            this.args.geometryStatement = "";
            this.args.geom_fields_array = []; //empty it
        }

        //return geom envelopes?
        if (this.args.returnGeometryEnvelopes == "yes") {
            //If we got some geom queries, store them here.
            if (this.args.geometryStatement) {
                this.args.geometryStatement += "," + geom_envelope_array.join(",");
            }else{
                this.args.geometryStatement = geom_envelope_array.join(",");
            }
        }
        else {
            this.args.geom_envelope_array = []; //empty it
        }

        //group by? must be accompanied by some stats definitions

        if (this.args.groupby) {
            if (this.args.statsdef) {
                //If provided, a statistics definition will override the SELECT fields, and NO geometry is returned.  
                //COULD work later to dissolve geometries by the group by field.
                var statsDefArray = this.args.statsdef.split(","); //break up if multiple defs
                var statsSQLArray = [];
                var infoMessage = "";

                statsDefArray.forEach(function (def) {
                    if (def.split(":").length == 2) {
                        statsSQLArray.push(def.split(":")[0].toLowerCase() + "(" + def.split(":")[1] + ")");
                    }
                    else {
                        this.args.infoMessage = "must have 2 arguments for a stats definition, such as -  sum:columnname";
                    }
                });

                if (this.args.infoMessage) {
                    //Friendly message
                    this.args.view = "table_query";
                    this.args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services/" + this.args.table, name: this.args.table }, { link: "", name: "Query" }];
                    this.args.title = "GeoWebServices";

                    respond(this.req, this.res, this.args);
                    return;
                }

                //If we're here, then the group by fields should be added to the select statement as well.
                statsSQLArray.push(this.args.groupby);

                //We've got a new select statement. Override the old one.
                this.args.returnfields = statsSQLArray.join(",");

                //If we're overriding the select fields, then set returnGeometry to no. (For the time being);
                this.args.geometryStatement = "";
                this.args.geom_fields_array = []; //empty it
                this.args.geom_envelope_array = [];
                this.args.returnGeometry = "no";
            }
            else {
                //friendly message - exit out
                this.args.infoMessage = "Group by clause must be accompanied by a statistics definition";
                this.args.view = "table_query";
                this.args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services/" + this.args.table, name: this.args.table }, { link: "", name: "Query" }];
                this.args.title = "GeoWebServices";

                respond(this.req, this.res, this.args);
                return;
            }
        }

        //Add in WKT Geometry to WHERE clause , if specified
        //For now, assuming 4326.  TODO
        if (this.args.wkt) {
            //For each geometry in the table, give an intersects clause
            var wkt_array = [];
            this.args.geom_fields_array.forEach(function (item) {
                wkt_array.push("ST_Intersects(ST_GeomFromText('" + this.args.wkt + "', 4326)," + item + ")");
            });
            this.args.wkt = wkt_array;
        }

        //Add in WHERE clause, if specified.  Don't alter the original incoming paramter.  Create this.where to hold modifications
        if (this.args.where) this.where = " " + this.where;
        
        if (this.where.length > 0) {
            this.where = " WHERE " + this.where;
            if (this.args.wkt) {
                this.where += " AND (" + this.args.wkt.join(" OR ") + ")";
            }
        }
        else {
            if (this.args.wkt) {
                this.where += " WHERE (" + this.args.wkt.join(" OR ") + ")";
            }
            else {
                this.where = " WHERE 1=1";
            }
        }

        //provide all columns (except geometries).
        if (this.args.returnfields.legnth == 0 || this.args.returnfields == "" || this.args.returnfields.trim() == "*") {
            createSelectAllStatementWithExcept(this.args.table, "'" + this.args.geom_fields_array.join("','") + "'", this); //Get all fields except the no fly list
        }
        else {
            //flow to next block - pass fields
            this(this.args.returnfields);
        }

    }, function (fieldList) {
        //Coming from createSelectAllStatementWithExcept
        //build SQL query
        if (isValidSQL(fieldList) && isValidSQL(this.args.geometryStatement) && isValidSQL(this.args.table) && isValidSQL(this.args.where) && isValidSQL(this.args.groupby)) {
            var query = {
                text: "SELECT " + fieldList +
                //Dynamically plug in geometry piece depending on the geom field name(s)
                (this.args.geometryStatement ? ", " + this.args.geometryStatement : "") +
                " FROM " +
                this.args.table +
                this.where +
                (this.args.groupby ? " GROUP BY " + this.args.groupby : ""), values: []
            };

            var args = this.args; //copy for closure.
            var req = this.req; //copy for closure.
            var res = this.res; //copy for closure.

            executePgQuery(query, function (result) {
                var features = "";

                //Check which format was specified
                if (!args.format || args.format == "html") {
                    //Render HTML page with results at bottom
                    features = geoJSONFormatter(result.rows, args.geom_fields_array); //The page will parse the geoJson to make the HTMl
                }
                else if (args.format && args.format == "GeoJSON") {
                    //Respond with JSON
                    features = geoJSONFormatter(result.rows, args.geom_fields_array);
                }
                else if (args.format && args.format == "esriJSON") {
                    //Respond with esriJSON
                    features = ESRIFeatureSetJSONFormatter(result.rows, args.geom_fields_array);
                }

                args.table = req.params.table;
                args.view = "table_query";
                args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services/" + args.table, name: args.table }, { link: "", name: "Query" }];
                args.title = "GeoWebServices";
                args.featureCollection = features;

                respond(req, res, args);
            });
        }
        else {
            //Invalid SQL was entered by user.
            //Exit.
            this.args.infoMessage = "Invalid SQL was entered. Try again.";
            this.args.view = "table_query";
            this.args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services/" + this.args.table, name: this.args.table }, { link: "", name: "Query" }];
            this.args.title = "GeoWebServices";

            respond(this.req, this.res, this.args);
            return;
        }
    }
);



//List available raster operations
routes['rasterOps'] = function (req, res) {
    //Show raster operations page
    var args = {};
    args.opslist = [{ link: 'zonalstatistics', name: 'Zonal Statistics' }];
    args.view = "rasterops";
    args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, { link: "", name: "Raster Ops" }];
    args.title = "GeoWebServices";

    respond(req, res, args);
};

//Allow for Zonal Statistics Definition
routes['zonalStats'] = function (req, res) {
    //If the querystring is empty, just show the regular HTML form.
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

    if (JSON.stringify(args) != '{}') {

        args.table = req.params.table;

        var statType = (req.body.statType ? req.body.statType : "sum");

        //Add in WKT, if specified
        var wkt = ""; //create internal var so we don't alter the original variable.
        if (args.wkt) wkt = " " + args.wkt;
        
        if (wkt.length == 0) {
            //Respond with friendly message
            var args = {};
            args.view = "zonalstatistics";
            args.infoMessage = "You must specify an input polygon in WKT format."
            args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, { link: "/services/" + req.params.table + "/rasterOps", name: "Raster Ops" }, { link: "", name: "Zonal Statistics" }];
            args.title = "GeoWebServices";

            respond(req, res, args);
            return;
        }

        //build SQL query for zonal stats - TODOD: make rast name dynamic
        var query = {
            text: "SELECT SUM((ST_SummaryStats(ST_Clip(rast,1,ST_GeomFromText('" +
            req.body.wkt +
            "', 4326))))." + statType + ")" +
            "FROM " + args.table +
            " WHERE ST_Intersects(ST_GeomFromText('" + req.body.wkt +
            "', 4326),rast)", values: []
        };

        executePgQuery(query, function (result) {
            var features = "";

            //Check which format was specified
            if (!args.format || args.format == "html") {
                //Render HTML page with results at bottom
                features = geoJSONFormatter(result.rows); //The page will parse the geoJson to make the HTMl
            }
            else if (args.format && args.format == "GeoJSON") {
                //Respond with JSON
                features = geoJSONFormatter(result.rows);
            }
            else if (args.format && args.format == "esriJSON") {
                //Respond with esriJSON
                features = ESRIFeatureSetJSONFormatter(result.rows);
            }

            args.table = req.params.table;
            args.view = "zonalstatistics";
            args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services/" + args.table, name: args.table }, { link: "", name: "Query" }];
            args.title = "GeoWebServices";
            args.results_list = features;

            respond(req, res, args);
        });      
    }
    else {
        //Render Query Form without any results.
        args.table = req.params.table;
        args.view = "zonalstatistics";
        args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, { link: "/services/" + req.params.table + "/rasterOps", name: "Raster Ops" }, { link: "", name: "Zonal Statistics" }];
        args.title = "GeoWebServices";
        args.results_list = features;

        respond(req, res, args);
    }
};



    //Define Paths
    //Root Request
    app.get('/', function (req, res) { res.redirect('/services') });

    //List All Tables
    app.get('/services', routes['listTables']);

    //Table Detail
    app.get('/services/:table', routes['tableDetail']);

    //Table Query - get - display page with default form
    app.get('/services/:table/query', routes['tableQuery']);

    //When a Query gets posted - read attributes from post and render results
    app.post('/services/:table/query', routes['tableQuery']);

    //Raster Operations Home Page - get - display page with default form
    app.get('/services/:table/rasterOps', routes['rasterOps']);

    //ZonalStats - get - display page with default form
    app.get('/services/:table/rasterOps/zonalstatistics', routes['zonalStats']);

    //ZonalStats - POST - display page with results
    app.post('/services/:table/rasterOps/zonalstatistics', routes['zonalStats']);


    http.createServer(app).listen(app.get('port'), app.get('ipaddr'), function () {
        console.log('Express server listening on IP:' + app.get('ipaddr') + ', port ' + app.get('port'));
    });



//pass in a table, and a comma separated list of fields to NOT select
function createSelectAllStatementWithExcept(table, except_list, callback) {
    var query = { text: "SELECT c.column_name::text FROM information_schema.columns As c WHERE table_name = $1 AND  c.column_name NOT IN($2)", values: [table, except_list] };
    executePgQuery(query, function (result) {
        callback(result.rows.map(function (item) { return item.column_name; }).join(",")); //Extract column_names into array
    });
}

//pass in a table, get an array of geometry columns
function getGeometryFieldNames(table, callback) {

    if (table == '') callback([]); //If no table, return empty array

    var query = { text: "select column_name from INFORMATION_SCHEMA.COLUMNS where (data_type = 'USER-DEFINED' AND udt_name = 'geometry') AND table_name = $1", values: [table] };
    executePgQuery(query, function (result) {
        callback(result.rows.map(function (item) { return item.column_name; })); //Extract column_names into array
    });
}


function executePgQuery(query, callback) {
    var result = { status: "success", rows: [] }; //object to store results, and whether or not we encountered an error.

    //Just run the query
    //Setup Connection to PG
    var client = new pg.Client(conString);
    client.connect();

    //Log the query to the console, for debugging
    log("Executing query: " + query.text + ", " + query.values);
    var query = client.query(query);

    //If query was successful, this is iterating thru result rows.
    query.on('row', function (row) {
        result.rows.push(row);
    });

    //Handle query error - fires before end event
    query.on('error', function (error) {
        //req.params.errorMessage = error;
        result.status = "error";
        result.message = error;
    });

    //end is called whether successfull or if error was called.
    query.on('end', function () {
        //End PG connection
        client.end();
        callback(result); //pass back result to calling function
    });
}

var createSpatialQuerySelectStatement = flow.define(
    //If the querystring is empty, just show the regular HTML form.

    function (table, callback) {
        this.callback = callback;
        getGeometryFieldNames(table, this);
    },
    function (geom_fields_array) {
        //Array of geometry columns
        console.log(" in geom fields. " + geom_fields_array.length);
        if (geom_fields_array.length == 0) {
            this.callback([], []);
        }::
        else {
            var geom_query_array = [];
            var geom_envelope_array = []; // in case they want envelopes
            geom_fields_array.forEach(function (item) {
                geom_query_array.push("ST_AsGeoJSON(st_geometryn(" + item + ", 1), 5) As " + item);
                geom_envelope_array.push("ST_AsGeoJSON(ST_Envelope(st_geometryn(" + item + ", 1)), 5) As " + item + "_envelope");
            });
            this.callback(geom_fields_array, geom_query_array, geom_envelope_array);
        }
    }
 );


////Take in results object, return GeoJSON (if there is geometry)
function geoJSONFormatter(rows, geom_fields_array) {
    //Take in results object, return GeoJSON
    if (!geom_fields_array) geom_fields_array = ["geom"]; //default

    //Loop thru results
    var featureCollection = { "type": "FeatureCollection", "features": [] };

    rows.forEach(function (row) {
        var feature = { "type": "Feature", "properties": {} };
        //Depending on whether or not there is geometry properties, handle it.  If multiple geoms, use a GeometryCollection output for GeoJSON.

        if (geom_fields_array && geom_fields_array.length == 1) {
            //single geometry
            if (row[geom_fields_array[0]]) {
                //feature.geometry = JSON.parse(row[geom_fields_array[0]]);
                feature.geometry = row[geom_fields_array[0]];

                //remove the geometry property from the row object so we're just left with non-spatial properties
                delete row[geom_fields_array[0]];
            }
        }
        else if (geom_fields_array && geom_fields_array.length > 1) {
            //if more than 1 geom, make a geomcollection property
            feature.geometry = { "type": "GeometryCollection", "geometries": [] };
            geom_fields_array.forEach(function (item) {
                feature.geometry.geometries.push(row[item]);
                //remove the geometry property from the row object so we're just left with non-spatial properties
                delete row[item];
            });
        }

        feature.properties = row;
        featureCollection.features.push(feature);
    })

    return featureCollection;
}

function ESRIFeatureSetJSONFormatter(rows, geom_fields_array) {
    //Take in results object, return ESRI Flavor of GeoJSON
    if (!geom_fields_array) geom_fields_array = ["geom"]; //default

    //Loop thru results
    var featureSet = { "features": [], "geometryType": "" };

    rows.forEach(function (row) {
        var feature = { "attributes": {} };
        //Depending on whether or not there is geometry properties, handle it.  
        //Multiple geometry featureclasses don't exist in ESRI-land.  How to handle?  For now, just take the 1st one we come across
        //TODO:  Make user choose what they want

        if (geom_fields_array) {
            //single geometry
            if (row[geom_fields_array[0]]) {
                //manipulate to conform
                if (row[geom_fields_array[0]].type == "Polygon") featureSet.geometryType = "esriGeometryPolygon";
                else if (row[geom_fields_array[0]].type == "Point") featureSet.geometryType = "esriGeometryPoint";
                else if (row[geom_fields_array[0]].type == "Line") featureSet.geometryType = "esriGeometryLine";
                else if (row[geom_fields_array[0]].type == "Polyline") featureSet.geometryType = "esriGeometryPolyline";
                //TODO - add the rest
                //TODO - support all types below
                feature.geometry = {};

                if (featureSet.geometryType = "esriGeometryPolygon") {
                    feature.geometry.rings = row[geom_fields_array[0]].coordinates;
                }
                else {
                    feature.geometry = row[geom_fields_array[0]];
                }
                //remove the geometry property from the row object so we're just left with non-spatial properties
                delete row[geom_fields_array[0]];
            }
        }


        feature.attributes = row;
        featureSet.features.push(feature);
    })

    return featureSet;
}

function respond(req, res, args) {
    //Write out a response as JSON or HTML with the appropriate arguments.  Add more formats here if desired
    if (!args.format || args.format == "html") {
        res.render(args.view, args)
    }
    else if (args.format && (args.format == "GeoJSON" || args.format == "esriJSON")) {
        //Responsd with GeoJSON (or JSON if there is no geo)
        res.jsonp(args.featureCollection);
    }
}

//Utilities
function log(message) {
    //Write to console
    console.log(message);
}

//Determine if a string contains all numbers.
function IsNumeric(sText) {
    var ValidChars = "0123456789";
    var IsNumber = true;
    var Char;
    sText.replace(/\s+/g, '')

    for (i = 0; i < sText.length && IsNumber == true; i++) {
        Char = sText.charAt(i);
        if (ValidChars.indexOf(Char) == -1) {
            IsNumber = false;
        }
    }
    return IsNumber;
}

function isValidSQL(item) {
    //if(!item || item.length == 0) return true;

    //var illegalChars = /[\<\>\;\\\/\"\'\[\]]/;

    //if (illegalChars.test(item)) {
    //    //String contains invalid characters
    //    log("invalid sql: " + item);
    //    return false;
    //} else {
    //    return true;
    //}
    return true;
    //TODO - add validation code.
}

