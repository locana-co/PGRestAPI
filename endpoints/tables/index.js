//////////Tables////////////

//Express, Common and settings should be used by all sub-modules
var express = require('express'),
    common = require("../../common"),
    settings = require('../../settings');

//The next requires are specific to this module only
var flow = require('flow'),
    fs = require("fs"),
    http = require("http"),
    path = require("path"),
    blower = require("../../lib/datablower");

var nodetiles = require('../../endpoints/nodetiles');

var app = exports.app = express();

app.use(nodetiles.app);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');


//Add a route and define response
//Get list of public base tables from postgres
app.all('/services/tables', function (req, res) {
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

    args.view = "table_list";
    args.breadcrumbs = [{ link: "", name: "Table List" }];
    args.path = req.path;
    args.host = settings.application.publichost || req.headers.host;
    args.link = "http://" + args.host + "/services/tables";

    try {
        //Check to see if we've stashed the list already.
        if (settings.tableList && !args.search) {
            //Render HTML page with results at bottom
            args.featureCollection = settings.tableList;
            common.respond(req, res, args);
        }
        else {
            //Fetch from DB
            var query = { text: "SELECT * FROM information_schema.tables WHERE table_schema = 'public' and (" + (settings.displayTables === true ? "table_type = 'BASE TABLE'" : "1=1") + (settings.displayViews === true ? " or table_type = 'VIEW'" : "") + ") AND table_name NOT IN ('geography_columns', 'geometry_columns', 'raster_columns', 'raster_overviews', 'spatial_ref_sys'" + (settings.pg.noFlyList && settings.pg.noFlyList.length > 0 ? ",'" + settings.pg.noFlyList.join("','") + "'" : "") + ") " + (args.search ? " AND table_name ILIKE ('" + args.search + "%') " : "") + " ORDER BY table_schema,table_name; ", values: [] };
            common.executePgQuery(query, function (result) {

                args.featureCollection = result.rows.map(function (item) { return item.table_name; }); //Get array of table names

                //stash it for later
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

    function (req, res) {
        this.req = req;
        this.res = res;

        this.args = {};

        //Grab POST or QueryString args depending on type
        if (this.req.method.toLowerCase() == "post") {
            //If a post, then arguments will be members of the this.req.body property
            this.args = this.req.body;
        }
        else if (this.req.method.toLowerCase() == "get") {
            //If request is a get, then args will be members of the this.req.query property
            this.args = this.req.query;
        }

        this.args.table = this.req.params.table;
        this.args.view = "table_details";
        this.args.breadcrumbs = [{ link: "/services/tables", name: "Home" }, { link: "", name: this.args.table }];
        this.args.host = settings.application.publichost || req.headers.host;
        this.args.url = this.req.url;
        this.args.table_details = [];
        this.args.fullURL = "http://" + (settings.application.publichost || this.req.headers.host) + this.req.path; //TODO - make the protocol dynamic
        this.args.link = "http://" + this.args.host + "/services/tables/" + this.args.table;

        //Find Column Names
        //Grab from stash if we have it already
        if (settings.columnNames && settings.columnNames[this.args.table]) {
            this.args.featureCollection = {};
            this.args.featureCollection.columns = settings.columnNames[this.args.table].rows;

            this(settings.columnNames[this.args.table]); //Pass on in flow
        }
        else{
            //copy for closure
            var args = this.args;
            var flo = this;

            var query = { text: "select column_name, CASE when data_type = 'USER-DEFINED' THEN udt_name ELSE data_type end as data_type from INFORMATION_SCHEMA.COLUMNS where table_name = $1", values: [this.args.table] };
            common.executePgQuery(query, function (result) {
                //check for error
                if (result.status == "error") {
                    //Report error and exit.
                    args.errorMessage = result.message;
                    flo(); //go to next flow
                }
                else if (result && result.rows && result.rows.length > 0) {

                    args.featureCollection = {};
                    args.featureCollection.columns = result.rows;

                    
                    //Stash
                    if(!settings.columnNames){
                        settings.columnNames = {};   
                    }

                    settings.columnNames[args.table] = result;
                    
                    flo(result); //Call and pass to flow when done
                }
                else {
                    //unknown table, or no columns?
                    flo({ rows: [] }); //go to next flow
                }
            }); 
        }
    },
    function (result) {
        //Expecting an array of columns and types

        //Add supported operations in a property
        this.args.featureCollection.supportedOperations = [];
        this.args.featureCollection.supportedOperations.push({ link: this.args.fullURL + "/query", name: "Query" });

        var rasterOrGeometry = { present: false, name: "" };

        var args = this.args; //copy for closure

        result.rows.forEach(function (item) {
            if (item.data_type == "raster") {
                args.featureCollection.supportedOperations.push({ link: args.fullURL + "/rasterOps", name: "Raster Operations" });
                rasterOrGeometry.present = true;
                rasterOrGeometry.name = common.escapePostGresColumns([item.column_name])[0];
            }
            else if (item.data_type == "geometry") {
                args.featureCollection.supportedOperations.push({ link: args.fullURL + "/dynamicMapLanding", name: "Dynamic Map Service" });
                args.featureCollection.supportedOperations.push({ link: args.fullURL + "/topojson", name: "TopoJSON" });
                rasterOrGeometry.present = true;
                rasterOrGeometry.name = common.escapePostGresColumns([item.column_name])[0];
            }
        });

        this.args = args;  //update this.args property

        //If there's a geom or raster column, then check for SRID
        if (rasterOrGeometry.present === true) {
            if (settings.columnNames[this.args.table] && settings.columnNames[this.args.table].srid) {
                this({ rows: [{ srid: settings.columnNames[this.args.table].srid }] });
            } else {
                //check SRID
                var query = { text: "select ST_SRID(" + rasterOrGeometry.name + ") as SRID FROM " + this.args.table + " LIMIT 1;", values: [] };
                common.executePgQuery(query, this);
            }
        }
    },
    function (result) {
        //Coming from SRID check
        if (result && result.status && result.status == "error") {
            //Report error and exit.
            this.args.errorMessage = result.message;
        }
        else if (result && result.rows && result.rows.length > 0) {
            //Get SRID
            if (result.rows[0].srid == 0 || result.rows[0].srid == "0") {
                this.args.infoMessage = "Warning:  this table's SRID is 0.  Projections and other operations will not function propertly until you <a href='http://postgis.net/docs/UpdateGeometrySRID.html' target='_blank'>set the SRID</a>.";
            }
            else {
                this.args.SRID = result.rows[0].srid; //Use the SRID
                settings.columnNames[this.args.table].srid = result.rows[0].srid;
            }
        }
        else {
            //no match found.
            this.args.infoMessage = "Couldn't find inforamtion for this table.";
        }

        //Render HTML page with results at bottom
        common.respond(this.req, this.res, this.args);
    }
));

//Table Query - get - display page with default form
app.all('/services/tables/:table/query', flow.define(
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

        //Prepare Stash
        if (!settings.columnNames) {
            settings.columnNames = {};
        }

        settings.application.host = app.get('ipaddr') || "localhost";

        // arguments passed to renameAndStat() will pass through to this first function
        if (JSON.stringify(this.args) != '{}') {
            //See if they want geometry
            this.args.returnGeometry = this.args.returnGeometry || "no"; //default
            this.args.returnGeometryEnvelopes = this.args.returnGeometryEnvelopes || "no"; //default
            this.args.table = req.params.table;
            this.args.path = req.path;
            this.args.host = settings.application.publichost || req.headers.host;
            this.args.breadcrumbs = [{ link: "/services/tables", name: "Home" }, { link: "/services/tables/" + this.args.table, name: this.args.table }, { link: "", name: "Query" }];
            this.args.view = "table_query";

            //See if columns exist for this table in settings.js
            if (settings.columnNames[this.args.table]) {
                this();
            }
            else {
                //Trigger the table_details endpoint.  That will load the columns into settings.js (globally)
                var flo = this;
                common.executeSelfRESTRequest(this.args.table, "/services/tables/" + this.args.table, { where: "1=1", format: "geojson" }, function () {
                    common.log("refreshed column list");
                    flo();
                }, settings);
            }

        }
        else {
            //If the querystring is empty, just show the regular HTML form.
            //Render Query Form without any results.
            this.args.table = req.params.table;
            this.args.view = "table_query";
            this.args.breadcrumbs = [{ link: "/services/tables", name: "Home" }, { link: "/services/tables/" + this.args.table, name: this.args.table }, { link: "", name: "Query" }];
            this.args.title = "GeoWebServices";

            var args = this.args;

            //See if columns exist for this table in settings.js


            if (settings.columnNames[this.args.table]) {
                this.args.columnNames = settings.columnNames[this.args.table].rows;

                common.respond(req, res, args);
            }
            else {
                //Trigger the table_details endpoint.  That will load the columns into settings.js (globally)
                common.executeSelfRESTRequest(args.table,"/services/tables/" + this.args.table, { where: "1=1", format: "geojson" }, function () {
                    args.columnNames = settings.columnNames[args.table].rows;

                    common.log("refreshed column list");
                    common.respond(req, res, args);
                }, settings);
            }
        }
    }, function () {
        //should have column names in settings.js now
        this.args.columnNames = settings.columnNames[this.args.table].rows;

        //either way, get the spatial columns so we can exclude them from the query
        createSpatialQuerySelectStatement(this.args.table, this.args.outputsrid, this);
        
    },function (geom_fields_array, geom_select_array, geom_envelope_array) {
        //Coming from createSpatialQuerySelectStatement
        //Store the geom_fields for use later
        this.args.geom_fields_array = geom_fields_array; //hold geom column names
        this.args.geom_envelope_array = geom_envelope_array; //hold geom envelope column names
        this.where = this.args.where || ""; //where clause - copy to local variable
        this.args.groupby = this.args.groupby || ""; //group by fields
        this.args.statsdef = this.args.statsdef || ""; //statistics definition clause
        this.limit = this.args.limit || settings.pg.featureLimit || 1000;

        //requested select fields
        this.returnfields = this.args.returnfields || ""; //return fields - copy to local variable so we don't mess with the original

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
            } else {
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
                        var operation = def.split(":")[0].toLowerCase();
                        var column = def.split(":")[1];
                        statsSQLArray.push(operation + "(" + column + ") as " + operation + "_"  + column );
                    }
                    else {
                        this.args.infoMessage = "must have 2 arguments for a stats definition, such as -  sum:columnname";
                    }
                });

                if (this.args.infoMessage) {
                    //Friendly message
                    common.respond(this.req, this.res, this.args);
                    return;
                }

                //If we're here, then the group by fields should be added to the select statement as well.
                statsSQLArray.push(this.args.groupby);

                //We've got a new select statement. Override the old one.
                this.returnfields = statsSQLArray.join(",");

                //If we're overriding the select fields, then set returnGeometry to no. (For the time being);
                this.args.geometryStatement = "";
                this.args.geom_fields_array = []; //empty it
                this.args.geom_envelope_array = [];
                this.args.returnGeometry = "no";
            }
            else {
                //friendly message - exit out
                this.args.infoMessage = "Group by clause must be accompanied by a statistics definition";

                common.respond(this.req, this.res, this.args);
                return;
            }
        }

        //Add in WKT Geometry to WHERE clause , if specified
        //For now, assuming 4326.  TODO

        if (this.args.wkt) {
            //For each geometry in the table, give an intersects clause
            var wkt = this.args.wkt;
            var wkt_array = [];
            geom_fields_array.forEach(function (item) {
                wkt_array.push("ST_Intersects(ST_GeomFromText('" + wkt + "', 4326)," + item + ")");
            });
            this.wkt = wkt_array;
        }

        //Add in WHERE clause, if specified.  Don't alter the original incoming paramter.  Create this.where to hold modifications
        if (this.args.where) this.where = " " + this.where;

        if (this.where.length > 0) {
            this.where = " WHERE " + this.where;
            if (this.wkt) {
                this.where += (" AND (" + this.wkt.join(" OR ") + ")");
            }
        }
        else {
            if (this.wkt) {
                this.where += " WHERE (" + this.wkt.join(" OR ") + ")";
            }
            else {
                this.where = " WHERE 1=1";
            }
        }

        //provide all columns (except geometries).
        if (this.returnfields.legnth == 0 || this.returnfields == "" || this.returnfields.trim() == "*") {
            createSelectAllStatementWithExcept(this.args.table, common.unEscapePostGresColumns(geom_fields_array).join(","), this); //Get all fields except the no fly list
        }
        else {
            //flow to next block - pass fields
            this(this.returnfields);
        }

    }, function (fieldList) {
        //Coming from createSelectAllStatementWithExcept
        //build SQL query
        if (common.isValidSQL(fieldList) && common.isValidSQL(this.args.geometryStatement) && common.isValidSQL(this.args.table) && common.isValidSQL(this.args.where) && common.isValidSQL(this.args.groupby)) {
            var query = {
                text: "SELECT " + fieldList +
                //Dynamically plug in geometry piece depending on the geom field name(s)
                (this.args.geometryStatement ? ", " + this.args.geometryStatement : "") +
                " FROM " +
                common.escapePostGresColumns([this.args.table]).join(",") + //escape
                this.where +
                (this.args.groupby ? " GROUP BY " + this.args.groupby : "")+
                (this.limit && common.IsNumeric(this.limit) && this.limit != "-1" ? " LIMIT " + this.limit : ""), values: []
            };

            var args = this.args; //copy for closure.
            var req = this.req; //copy for closure.
            var res = this.res; //copy for closure.

            common.executePgQuery(query, this); //pass to next flow
        }
        else {
            //Invalid SQL was entered by user.
            //Exit.
            this.args.infoMessage = "Invalid SQL was entered. Try again.";

            common.respond(this.req, this.res, this.args);
            return;
        }
    }, function (result) {

        var features = [];

        //check for error
        if (result.status == "error") {
            //Report error and exit.
            this.args.errorMessage = result.message;
        } else {
            //a-ok
            //Check which format was specified
            if (!this.args.format || this.args.format.toLowerCase() == "html") {
                //Render HTML page with results at bottom
                features = common.formatters.geoJSONFormatter(result.rows, common.unEscapePostGresColumns(this.args.geom_fields_array)); //The page will parse the geoJson to make the HTMl

                //For now - hard coded.  Create new dynamic endpoint for this GeoJSON
                //nodetiles.createDynamicGeoJSONEndpoint(features, args.table, "4326", "style.mss");
            }
            else if (this.args.format && this.args.format.toLowerCase() == "geojson") {
                //Respond with JSON
                features = common.formatters.geoJSONFormatter(result.rows, common.unEscapePostGresColumns(this.args.geom_fields_array));

                //For now - hard coded.  Create new dynamic endpoint for this GeoJSON
                //nodetiles.createDynamicGeoJSONEndpoint(features, args.table, "4326", "style.mss");
            }
            else if (this.args.format && this.args.format.toLowerCase() == "esrijson") {
                //Respond with esriJSON
                features = common.formatters.ESRIFeatureSetJSONFormatter(result.rows, common.unEscapePostGresColumns(this.args.geom_fields_array));
            }

            this.args.featureCollection = features;
            this.args.scripts = ['http://cdn.leafletjs.com/leaflet-0.6.4/leaflet.js', 'http://ajax.googleapis.com/ajax/libs/jquery/1.10.2/jquery.min.js']; //Load external scripts for map preview
            this.args.css = ['http://cdn.leafletjs.com/leaflet-0.6.4/leaflet.css'];
        }
        common.respond(this.req, this.res, this.args);
    }
));


//Raster Operations Home Page - get - display page with default form
app.all('/services/tables/:table/rasterOps', function (req, res) {
    //Show raster operations page
    var args = {};
    args.opslist = [{ link: 'zonalstatistics', name: 'Zonal Statistics' }];
    args.view = "rasterops";
    args.breadcrumbs = [{ link: "/services/tables", name: "Home" }, { link: "/services/tables/" + req.params.table, name: req.params.table }, { link: "", name: "Raster Ops" }];
    args.title = "GeoWebServices";
    args.path = req.path;
    args.host = req.headers.host;

    common.respond(req, res, args);
});

//ZonalStats - get - display page with default form
app.all('/services/tables/:table/rasterOps/zonalstatistics', flow.define(
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

        if (JSON.stringify(this.args) != '{}') {

            this.args.table = req.params.table;
            this.args.view = "zonalstatistics";
            this.args.breadcrumbs = [{ link: "/services/tables", name: "Home" }, { link: "/services/tables/" + req.params.table, name: req.params.table }, { link: "/services/tables/" + req.params.table + "/rasterOps", name: "Raster Ops" }, { link: "", name: "Zonal Statistics" }];
            this.args.path = req.path;
            this.args.host = req.headers.host;
            this.args.featureCollection = {};

            var statType = (req.body.statType ? req.body.statType : "sum");

            //Add in WKT, if specified
            var wkt = ""; //create internal var so we don't alter the original variable.
            if (this.args.wkt) wkt = " " + this.args.wkt;

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
        }
        else {
            //Render Query Form without any results.
            this.args.table = this.req.params.table;
            this.args.view = "zonalstatistics";
            this.args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services/tables/" + this.args.table, name: this.args.table }, { link: "/services/tables/" + this.args.table + "/rasterOps", name: "Raster Ops" }, { link: "", name: "Zonal Statistics" }];
            this.args.title = "GeoWebServices";

            common.respond(this.req, this.res, this.args);
        }
    },
    function (raster_column_name) {
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
            var bufferdistance = 500; //default if distance is not numeric or not specified

            if (this.args.bufferdistance && common.IsNumeric(this.args.bufferdistance)) {
                bufferdistance = this.args.bufferdistance;
            }
            else {
                //set it as an output parameter to be written to template
                this.args.bufferdistance = bufferdistance;
            }


            var query = {
                text: "DO $$DECLARE " +
                        "orig_srid int; " +
                        "utm_srid int; " +
                        "input geometry := ST_GeomFromText('" + this.args.wkt + "', 4326); " + //TODO: make the input SRID dymamic.
                        "geomgeog geometry; " +
                        "buffer geometry; " +
                        "zone int; " +
                        "pref int; " +
                        "BEGIN " +
                        "geomgeog:= ST_Transform(input,4326); " +
                        //See if incoming WKT is a point.  If so, use the ST_Y to find the right zone.  Otherwize, get the centroid, and get the y from that.
                        (this.args.wkt.toLowerCase().indexOf("point") == 0 ? "IF (ST_Y(geomgeog))>0 THEN pref:=32600; ELSE pref:=32700; END IF;" : "IF (ST_Y(ST_CENTROID(geomgeog))) > 0 THEN pref:=32600; ELSE pref:=32700; END IF; ") +
                        (this.args.wkt.toLowerCase().indexOf("point") == 0 ? "zone:=floor((ST_X(geomgeog)+180)/6)+1; " : "zone:=floor((ST_X(ST_CENTROID(geomgeog))+180)/6)+1; ") +

                        " " +
                        "orig_srid:= ST_SRID(input); " +
                        "utm_srid:= zone+pref; " +

                        //If a point, buffer.  Otherwise, don't.
                        (this.args.wkt.toLowerCase().indexOf("point") == 0 ? "buffer:= ST_transform(ST_Buffer(ST_transform(input, utm_srid), " + bufferdistance + "), 4326);" : "buffer:=input; ") +

                        "drop table if exists _zstemp; " +  //TODO: Add session ID (or something) to make sure this is dynamic.
                        "create temporary table _zstemp as " +

                        "SELECT SUM((ST_SummaryStats(ST_Clip(" + raster_column_name + ", buffer , true)))." + this.args.stattype + ") as  " + this.args.stattype + ", ST_ASGeoJSON(buffer) as geom, ST_AsText(buffer) as wkt " + //Todo - get raster's SRID dynamically and make sure the buffer is transformed to that SRID.
                        " FROM " + this.args.table +
                        " WHERE ST_Intersects(buffer," + raster_column_name + "); " + //Todo - get raster's SRID dynamically and make sure the buffer is transformed to that SRID.

                        "END$$; " +
                        "select * from _zstemp;", values: []
            };

            var args = this.args; //copy for closure.
            var req = this.req; //copy for closure.
            var res = this.res; //copy for closure.

            common.executePgQuery(query, function (result) {

                if (result.status == "error") {
                    //Report error and exit.
                    args.errorMessage = result.message;

                } else {

                    var features = "";

                    //Check which format was specified
                    if (!args.format || args.format.toLowerCase() == "html") {
                        //Render HTML page with results at bottom
                        features = common.formatters.geoJSONFormatter(result.rows, ["geom"]); //The page will parse the geoJson to make the HTMl
                    }
                    else if (args.format && args.format.toLowerCase() == "geojson") {
                        //Respond with JSON
                        features = common.formatters.geoJSONFormatter(result.rows, ["geom"]);
                    }
                    else if (args.format && args.format.toLowerCase() == "esrijson") {
                        //Respond with esriJSON
                        features = common.formatters.ESRIFeatureSetJSONFormatter(result.rows, ["geom"]);
                    }

                    args.featureCollection = features;
                }

                common.respond(req, res, args);
            });
        }
    }
));

//list topojson files for a particular dataset, and let user create a new one.
app.all('/services/tables/:table/topojson', flow.define(
//If the querystring is empty, just show the regular HTML form.

    function (req, res) {
        this.req = req;
        this.res = res;
        this.rootRelativePath = "."; //TODO - make this more dynamic.  It's how we'll know how to find the 'root' + public/foo to write the output files.

        this.args = {};

        //Grab POST or QueryString args depending on type
        if (this.req.method.toLowerCase() == "post") {
            //If a post, then arguments will be members of the this.req.body property
            this.args = this.req.body;
        }
        else if (this.req.method.toLowerCase() == "get") {
            //If request is a get, then args will be members of the this.req.query property
            this.args = this.req.query;
        }

        if (JSON.stringify(this.args) != '{}') {
            this.args.view = "topojson_list";
            this.args.table = this.req.params.table;
            this.args.breadcrumbs = [{ link: "/services/tables", name: "Home" }, { link: "/services/tables/" + this.args.table, name: this.args.table }, { link: "", name: "TopoJSON" }];
            this.args.path = this.req.path;
            this.args.host = this.req.headers.host;
            this.args.files = [];


            if (this.args.topofilename) {
                //Make the File if flag was sent

                //First - check to see if GeoJSON output folder exists for this table 
                console.log("checking for folder: " + this.rootRelativePath + settings.application.geoJsonOutputFolder + this.args.table);
                fs.exists(this.rootRelativePath + settings.application.geoJsonOutputFolder + this.args.table, this);
            }
            else {
                //Expecting a topofilename
                common.respond(req, res, args);
            }
        }
        else {
            //Respond with list.
            this.args.view = "topojson_list";
            this.args.table = this.req.params.table;
            this.args.breadcrumbs = [{ link: "/services/tables", name: "Home" }, { link: "/services/tables/" + this.args.table, name: this.args.table }, { link: "", name: "TopoJSON" }];
            this.args.path = this.req.path;
            this.args.host = this.req.headers.host;

            this.args.files = [];

            var args = this.args; //copy for closure

            console.log(this.rootRelativePath);
            console.log(settings.application.topoJsonOutputFolder);
            console.log(this.args.table);
            //Find all existing topojson files in the public/topojson/output folder
            
            console.log("checking for folder: " + this.rootRelativePath + settings.application.topoJsonOutputFolder + this.args.table);

            fs.exists(this.rootRelativePath + settings.application.topoJsonOutputFolder + this.args.table, function (exists) {
                if (exists === true) {
                    fs.readdirSync(path.join(".", settings.application.topoJsonOutputFolder, args.table)).forEach(function (file) {
                        if (file.indexOf("topo_") == 0) {
                            args.files.push({ link: settings.application.topoJsonOutputFolder + file, name: file });
                        }
                    });
                    common.respond(req, res, args);

                }
                else {
                    //Doesn't exist
                    common.respond(req, res, args);
                }
            });
        }
    },
    function (exists) {
        //Coming from flow - check if geojson output folder exists
        if (exists === false) {
            //make it
            console.log("Didn't find it.  Tyring to make folder: " + this.rootRelativePath + settings.application.geoJsonOutputFolder + this.args.table);
            fs.mkdirSync(this.rootRelativePath + settings.application.geoJsonOutputFolder + this.args.table); //Synch
        }


        console.log("checking for folder: " + this.rootRelativePath + settings.application.topoJsonOutputFolder + this.args.table);
        //Now, check to see if table has a topojson subfolder on disk
        fs.exists("." + settings.application.topoJsonOutputFolder + this.args.table, this);

    },
    function (exists) {
        //coming from check if topojson folder exists
        if (exists === false) {
            console.log("Didn't find it.  Tyring to make folder: " + this.rootRelativePath + settings.application.topoJsonOutputFolder + this.args.table);
            fs.mkdirSync(this.rootRelativePath + settings.application.topoJsonOutputFolder + this.args.table); //Synch
        }

        var args = this.args; //copy for closure
        var req = this.req;
        var res = this.res;
        var relativeRootPath = this.rootRelativePath;

        //Make the Geo File
        makeGeoJSONFile(this.args.table, this.args.topofilename, function (error, filename, filepath) {
            if (error) {
                args.infoMessage = error.message;
                common.respond(req, res, args);
                return;
            }
            else {
                //created geojson folder
                args.infoMessage = "Created file - " + filename;

                //Now turn file into TopoJSON - pass in original file, topo file, callback
                geoJSONToTopoJSON(args.table, filename, "topo_" + filename, function (error, stdout) {
                    if (error) {
                        args.errorMessage = error.message;
                    }
                    else {
                        console.log("Finished making Topo File.");
                        args.infoMessage = stdout;

                        //Find all existing topojson files in the public/topojson/output folder
                        fs.readdirSync(path.join(relativeRootPath,settings.application.topoJsonOutputFolder,args.table)).forEach(function (file) {
                            if (file.indexOf("topo_") == 0) {
                                args.files.push({ link: settings.application.topoJsonOutputFolder + args.table + "/" + file, name: file });
                            }
                        });
                    }

                    common.respond(req, res, args);
                });
            } //End  if error
        });
    }
));

//Show users about a table's dynamic map service, along with a preview
app.all('/services/tables/:table/dynamicMapLanding', flow.define(
    
    function (req, res) {
        this.args = {};
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

        this.args.view = "table_dynamic_map";
        this.args.table = this.req.params.table;
        this.args.breadcrumbs = [{ link: "/services/tables/", name: "Home" }, { link: "/services/tables/" + this.args.table, name: this.args.table }, { link: "", name: "Dynamic Map Service" }];
        this.args.path = this.req.path;
        this.args.host = settings.application.publichost || this.req.headers.host;

        //Get geometry names
        getGeometryFieldNames(this.args.table, this);

    }, function (geom_fields_array) {
        
        //coming back from getGeometryFieldNames
        //for now, assume just 1 geometry.  TODO
        if (geom_fields_array.length > 0) {
            //Check for layer extent
            var query = { text: "SELECT ST_Extent(" + geom_fields_array[0] + ") as table_extent FROM " + this.args.table + ";", values: [] };
            common.executePgQuery(query, this);
        } 
        else {
            //No geom column or no extent or something.
            this.args.errorMessage = "Problem getting the geom column for this table.";
            common.respond(this.req, this.res, this.args);
            return;
        }
    },
    function (result) {
        
        if (result.status == "error") {
            this.args.errorMessage = "Problem getting the extent for this table.";
        }
        else {

            var bboxArray = result.rows[0].table_extent.replace("BOX(", "").replace(")","").split(","); //Should be BOX(XMIN YMIN, XMAX YMAX)
            this.args.xmin = bboxArray[0].split(" ")[0];
            this.args.ymin = bboxArray[0].split(" ")[1];
            this.args.xmax = bboxArray[1].split(" ")[0];
            this.args.ymax = bboxArray[1].split(" ")[1];

            //Write out the details for this map service
            this.args.featureCollection = [];
            this.args.featureCollection.push({ name: "Map Service Endpoint", link: "http://" + this.args.host + "/services/tables/" + this.args.table + "/dynamicMap" });
            this.args.extent = result.rows[0];

            //load leaflet and jquery
            this.args.scripts = ['http://cdn.leafletjs.com/leaflet-0.6.4/leaflet.js', 'http://codeorigin.jquery.com/jquery-1.10.2.min.js']; //Load external scripts for map preview
            this.args.css = ['http://cdn.leafletjs.com/leaflet-0.6.4/leaflet.css'];
        }

        common.respond(this.req, this.res, this.args);
    }
));


//Test blower route
app.all("/services/blower", function (req, res) {
    blower.blow(null, null, function (err, result) {
        //Handle err

        //then
        res.jsonp(result);
    });
});







//pass in a table, and a comma separated list of fields to NOT select
function createSelectAllStatementWithExcept(table, except_list, callback) {
    var query = { text: "SELECT c.column_name::text FROM information_schema.columns As c WHERE table_name = $1 AND  c.column_name NOT IN ($2)", values: [table, except_list] };
    common.executePgQuery(query, function (result) {
        var rows = result.rows.map(function (item) { return item.column_name; }); //Get array of column names

        //Wrap columns in double quotes
        rows = common.escapePostGresColumns(rows);

        //Callback
        callback(rows.join(","));
    });
}


var createSpatialQuerySelectStatement = flow.define(

    function (table, outputsrid, callback) {
        this.callback = callback;
        this.outputsrid = outputsrid;
        getGeometryFieldNames(table, this);
    },
    function (geom_fields_array) {
        //Array of geometry columns
        console.log(" in geom fields. " + geom_fields_array.length);
        if (geom_fields_array.length == 0) {
            this.callback([], []);
        }
        else {
            var geom_query_array = [];
            var geom_envelope_array = []; // in case they want envelopes
            var outputsrid = this.outputsrid;

            //Format as GeoJSON
            if (this.outputsrid) {
                geom_fields_array.forEach(function (item) {
                    geom_query_array.push("ST_AsGeoJSON(ST_Transform(" + item + ", " + outputsrid + ")) As " + item);
                    geom_envelope_array.push("ST_AsGeoJSON(ST_Transform(ST_Envelope(" + item + "), " + outputsrid + ")) As " + ('"' + item.replace(/"/g, "") + "_envelope" + '"'));
                });
            }
            else {
                geom_fields_array.forEach(function (item) {
                    geom_query_array.push("ST_AsGeoJSON(" + item + ") As " + item);
                    geom_envelope_array.push("ST_AsGeoJSON(ST_Envelope(" + item + ")) As " + ('"' + item.replace(/"/g, "") + "_envelope" + '"'));
                });
            }

            this.callback(geom_fields_array, geom_query_array, geom_envelope_array);
        }
    }
 );

//pass in a table, get an array of geometry columns
function getGeometryFieldNames(table, callback) {

    if (table == '') callback([]); //If no table, return empty array

    var query = { text: "select column_name from INFORMATION_SCHEMA.COLUMNS where (data_type = 'USER-DEFINED' AND udt_name = 'geometry') AND table_name = $1", values: [table] };
    common.executePgQuery(query, function (result) {
        var rows = result.rows.map(function (item) { return item.column_name; }); //Get array of column names
        //Wrap columns in double quotes
        rows = common.escapePostGresColumns(rows);

        //Callback
        callback(rows);
    });
}

//pass in a table, get an array of geometry columns
function getRasterColumnName(table, callback) {
    if (table == '') callback([]); //If no table, return empty array

    var query = { text: "select column_name from INFORMATION_SCHEMA.COLUMNS where (data_type = 'USER-DEFINED' AND udt_name = 'raster') AND table_name = $1", values: [table] };
    common.executePgQuery(query, function (result) {
        var rows = result.rows.map(function (item) { return item.column_name; }); //Get array of column names

        //Wrap columns in double quotes
        rows = common.escapePostGresColumns(rows);

        //Callback
        callback(rows);
    });
}

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
    child = exec('topojson -o ' + path.join(outputPath, topojsonfile) + " " + path.join(geoJsonPath, geojsonfile), function (error, stdout, stderr) {
        callback(error, stdout);
    });
}

//Query table's rest endpoint, write out GeoJSON file.
function makeGeoJSONFile(table, filename, callback) {
    //Grab GeoJSON from our own rest service for this table.
    var options = {
        host: settings.application.host, //TODO - make this point to the environment variable to get the right IP
        path: "/services/tables/" + table + "/query?where=1%3D1&format=geojson&returnGeometry=yes&returnGeometryEnvelopes=no&limit=-1",
        port: settings.application.port
    };

    http.request(options, function (response) {
        var str = [];

        //another chunk of data has been recieved, so append it to `str`
        response.on('data', function (chunk) {
            str.push(chunk);
        });

        //the whole response has been recieved, so we just print it out here
        response.on('end', function () {
            console.log("ended API response");
            //Write out a GeoJSON file to disk - remove all whitespace
            var geoJsonOutFile = filename + '.json';
            fs.writeFile("." + settings.application.geoJsonOutputFolder + table + "/" + geoJsonOutFile, str.join("").replace(/\s+/g, ''), function (err) {
                if (err) {
                    console.log(err.message);
                }
                else {
                    console.log("created GeoJSON file.");
                }

                //pass back err, even if null
                callback(err, geoJsonOutFile, settings.application.geoJsonOutputFolder + table + "/" + geoJsonOutFile);
            });
        });
    }).end();
}

//Find all PostGres tables with a geometry column.  Return the table names, geom column name(s) and SRID
exports.findSpatialTables = function (callback) {
    var spatialTables = [];
    var error;

    var query = { text: "select * from geometry_columns", values: [] }; //TODO - add options to specify schema and database.  Right now it will read all
    common.executePgQuery(query, function (result) {
        if (result.status == "error") {
            //Report error and exit.
            error = result.message;
            console.log("Error in reading spatial tables from DB.  Can't load dynamic tile endopints. Message is: " + result.message);
        } else {
            //Add to list of tables.
            result.rows.forEach(function (item) {
                spatialTables.push({ table: item.f_table_name, geometry_column:item.f_geometry_column, srid: item.srid });
            });
        }

        //return to sender
        callback(error, spatialTables);
    });

}