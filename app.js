
/**
 * Module dependencies.
 */
var pg = require('pg');
var phantom = require('node-phantom');

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path')
  , flow = require('flow');

var app = express();

var routes = [];

var conString = "postgres://postgres:p0stgr3s*1@localhost:5434/crs";

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use("/output", express.static(path.join(__dirname, 'output')));


// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

//Define Routes

//Get list of public base tables from postgres
routes['listTables'] = function (req, res) {
 
    var client = new pg.Client(conString);
    client.connect();

    var sql = "SELECT * FROM information_schema.tables WHERE table_schema = 'public' and table_type = 'BASE TABLE' ORDER BY table_schema,table_name;"

    var query = client.query(sql);

    var table_list = [];
    query.on('row', function (row) {
	table_list.push({ table_name: row.table_name });
    });

    query.on('end', function () {
        res.render('index', {baseURL: req.url, title: 'pGIS Server', list: table_list, breadcrumbs: [{ link: "/services", name: "Home"}] })
        client.end();
    });
};

//List properties of the selected table, along with operations.
routes['tableDetail'] = function (req, res) {

    var client = new pg.Client(conString);
    client.connect();

    var sql = "select column_name, CASE when data_type = 'USER-DEFINED' THEN udt_name ELSE data_type end as data_type from INFORMATION_SCHEMA.COLUMNS where table_name = '" + req.params.table + "'";

    var query = client.query(sql);

    var table_list = [];
    query.on('row', function (row) {
        table_list.push(row);
    });

    query.on('end', function () {
        res.render('table_details', { baseURL: req.url, title: 'pGIS Server', table_details: table_list, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "", name: req.params.table }] })
        client.end();
    });
};


//Allow for Table Query
routes['tableQuery'] = flow.define(
    //If the querystring is empty, just show the regular HTML form.

    function (req, res) {
        this.req = req;
        this.res = res;

        // arguments passed to renameAndStat() will pass through to this first function
        if (JSON.stringify(req.body) != '{}') {
            //See if they want geometry
            this.returnGeometry = (req.body.returnGeometry ? req.body.returnGeometry : "yes");
            this.returnGeometryEnvelopes = (req.body.returnGeometryEnvelopes ? req.body.returnGeometryEnvelopes : "yes");

            //either way, get the spatial columns so we can exclude them from the query
            createSpatialQuerySelectStatement(req.params.table, this);
        }
        else {
            //Render Query Form without any results.
            res.render('table_query', { title: 'pGIS Server', table: req.params.table, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, { link: "", name: "Query" }] })
        }

    }, function (geom_fields_array, geom_select_array) {
        //Coming from createSpatialQuerySelectStatement
        //Store the geom_fields for use later
        this.geom_fields_array = geom_fields_array;
        this.where = "";
        var fields = "";
        this.groupby = "";
        this.statsdef = "";

        //requested select fields
        
        if (this.req.body.returnfields) {
            fields = this.req.body.returnfields;
        }

        //return geom?
        if (this.returnGeometry == "yes") {
            //If we got some geom queries, store them here.
            this.geometryStatement = geom_select_array.join(",");
        }
        else {
            this.geometryStatement = "";
            this.geom_fields_array = []; //empty it
        }

        //return geom envelopes?
        if (this.returnGeometryEnvelopes == "yes") {
            //If we got some geom queries, store them here.
            this.geometryStatement = geom_select_array.join(",");
        }
        else {
            this.geometryStatement = "";
            this.geom_fields_array = []; //empty it
        }

        //group by? must be accompanied by some stats definitions

        if (this.req.body.groupby) {
            if (this.req.body.statsdef) {
                this.groupby = this.req.body.groupby;
                this.statsdef = this.req.body.statsdef;
                //If provided, a statistics definition will override the SELECT fields, and NO geometry is returned.  
                //COULD work later to dissolve geometries by the group by field.
                var statsDefArray = this.statsdef.split(","); //break up if multiple defs
                var statsSQLArray = [];
                var infoMessage = "";

                statsDefArray.forEach(function (def) {
                    if (def.split(":").length == 2) {
                        statsSQLArray.push(def.split(":")[0].toLowerCase() + "(" + def.split(":")[1] + ")");
                    }
                    else {
                        infoMessage = "must have 2 arguments for a stats definition, such as -  sum:columnname";
                    }
                });

                if (infoMessage) {
                    //Friendly message
                    routes['onError'](this.req, this.res, "table_query", infoMessage);
                    return;
                }

                //If we're here, then the group by fields should be added to the select statement as well.
                statsSQLArray.push(this.groupby);

                //We've got a new select statement. Override the old one.
                fields = statsSQLArray.join(",");

                //If we're overriding the select fields, then set returnGeometry to no. (For the time being);
                this.geometryStatement = "";
                this.geom_fields_array = []; //empty it
                this.returnGeometry = "no";
            }
            else {
                //friendly message - exit out
                var infoMessage = "Group by clause must be accompanied by a statistics definition";
                routes['onError'](this.req, this.res, "table_query", infoMessage);
                return;
            }
        }

        //Add in WKT Geometry to WHERE clause , if specified
        //For now, assuming 4326.  TODO
        this.wkt = "";
        if (this.req.body.wkt) {
            //For each geometry in the table, give an intersects clause
            var wkt_array = [];
            var wkt = this.req.body.wkt;
            geom_fields_array.forEach(function (item) {
                wkt_array.push("ST_Intersects(ST_GeomFromText('" + wkt + "', 4326)," + item + ")");
            });
            this.wkt = wkt_array;
        } 

        //Add in WHERE clause, if specified
        
        if (this.req.body.where) {
            this.where = " " + this.req.body.where;
        }

        if (this.where.length > 0) {
            this.where = " WHERE " + this.where;
            if (this.wkt) {
                this.where += " AND (" + this.wkt.join(" OR ") + ")";
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
        if (fields.legnth == 0 || fields == "" || fields.trim() == "*") {
            createSelectAllStatementWithExcept(this.req.params.table, "'" + geom_fields_array.join("','") + "'", this); //Get all fields except the no fly list
        }
        else {
            //flow to next block - pass fields
            this(fields);
        }

    }, function (gpFields) {
        //Coming from createSelectAllStatementWithExcept
        //build SQL query
        var sql = "SELECT " + gpFields +
        //Dynamically plug in geometry piece depending on the geom field name(s)
        (this.geometryStatement ? ", " + this.geometryStatement : "") +
        " FROM " +
        this.req.params.table +
        this.where +
        (this.groupby ? " GROUP BY " + this.groupby : "");
        completeExecuteSpatialQuery(this.req, this.res, sql, this.geom_fields_array);
    }
);



//List available raster operations
routes['rasterOps'] = function (req, res) {

    var opslist = [{ link: 'zonalstatistics', name: 'Zonal Statistics' }];

    res.render('rasterops', { baseURL: req.url, title: 'pGIS Server', opslist: opslist, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, { link: "", name: "Raster Ops" }] })

};

//Allow for Zonal Statistics Definition
routes['zonalStats'] = function (req, res) {
    //If the querystring is empty, just show the regular HTML form.

    if (JSON.stringify(req.body) != '{}') {

        //Get POST parameters
        var empty = JSON.stringify(req.body);

        //Setup Connection to PG
        var client = new pg.Client(conString);
        client.connect();

        var statType = (req.body.statType ? req.body.statType : "sum");

        //Add in WKT, if specified
        var wkt = "";
        if (req.body.wkt) {
            wkt = " " + req.body.wkt;
        }

        if (wkt.length == 0) {
            //Respond with friendly message
            res.render('zonalstatistics', { message: "You must specify an input polygon in WKT format.", title: 'pGIS Server', table: req.params.table, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, { link: "/services/" + req.params.table + "/rasterOps", name: "Raster Ops" }, { link: "", name: "Zonal Statistics" }] })
        }

        //build SQL query for zonal stats - TODOD: make rast name dynamic
        var sql = "SELECT SUM((ST_SummaryStats(ST_Clip(rast,1,ST_GeomFromText('" +
        req.body.wkt +
        "', 4326))))." + statType + ")" +
        "FROM " + req.params.table +
        " WHERE ST_Intersects(ST_GeomFromText('" + req.body.wkt +
        "', 4326),rast)";

        //Log the query to the console, for debugging
        console.log("Query: " + sql);
        var query = client.query(sql);

        //Loop thru results
        var results_list = [];
        query.on('row', function (row) {
            results_list.push(row);
        });

        //Handle query error - fires before end event
        query.on('error', function (error) {
            req.params.errorMessage = error;
        });

        //On last result, decide how to write out results.
        query.on('end', function () {
            if (!req.body.format) {
                //if no format specified, render html
                res.render('zonalstatistics', { title: 'pGIS Server', table: req.params.table, query_results: results_list, format: req.body.format, where: req.body.where, returnGeometry: req.body.returnGeometry, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, { link: "", name: "Query" }] })
            }
            else {
                //Check which format was specified
                if (req.body.format && req.body.format == "html") {
                    //Render HTML page with results at bottom
                    res.render('zonalstatistics', { title: 'pGIS Server', table: req.params.table, query_results: results_list, format: req.body.format, where: req.body.where, returnGeometry: req.body.returnGeometry, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, { link: "", name: "Query" }] })
                }
                else if (req.body.format && req.body.format == "GeoJSON") {
                    //Respond with JSON
                    res.header("Content-Type:", "application/json");
                    res.end(JSON.stringify(results_list));
                }
            }
            //End PG connection
            client.end();
        });
    }
    else {
        //Render Query Form without any results.
        res.render('zonalstatistics', { title: 'pGIS Server', table: req.params.table, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, {link: "/services/" + req.params.table + "/rasterOps", name: "Raster Ops" },{ link: "", name: "Zonal Statistics" }] })
    }
};

//A route to handle an error.  Pass in req, res, and the view you'd like to write to.
routes['onError'] = function (req, res, view, message) {
    if (view == "table_query") {
        res.render('table_query', { title: 'pGIS Server', infoMessage: message, format: req.body.format, where: req.body.where, groupby: req.body.groupby, statsdef: req.body.statsdef, returnfields: req.body.returnfields, returnGeometry: req.body.returnGeometry, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, { link: "", name: "Query" }] })
    }
    else if (view == "print") {
        res.render('print', { errorMessage: message, format: req.body.format, url: req.body.url, delay: req.body.delay, selector: req.body.selector, codeblock: req.body.codeblock, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "", name: "Print" }] })
    }
};

routes['print'] = function (req, res) {
    if (JSON.stringify(req.body) != '{}') {

        //Gather options
        var url = "";
        if (req.body.url) {
            url = req.body.url;
        }
        else {
            routes['onError'](req, res, "print", "You must specify a URL.");
        }

        var delay = 1000;
        if (req.body.delay) {
            delay = req.body.delay;
            if (IsNumeric(delay)) {
                delay = parseInt(delay);
            }
            else {
                delay = 1000;
                req.params.infoMessage = "Delay was non-numeric.  Defaulting to 1000 ms";
            }
        }
        else {
            delay = 1000;
        }

        var imageformat = "png"; //default
        if (req.body.imageformat) {
            imageformat = req.body.imageformat;
        }

        var format = "html"; //default
        if (req.body.format) {
            format = req.body.format;
        }

        var selector = ""; //default - nothing
        if (req.body.selector) {
            selector = req.body.selector;
        }

        var codeblock = ""; //default - nothing
        if (req.body.codeblock) {
            codeblock = req.body.codeblock;
        }

        //DO IT
        console.log("Creating Phantom Instance...");
        phantom.create(function (err, ph) {
            console.log("Creating Page Object...");
            return ph.createPage(function (err, page) {
                //set size
                console.log("Setting Page size...");
                page.set('viewportSize', { width: 1200, height: 800 }, function (err) {
                    console.log("Opening Page...");
                    return page.open(url, function (status) {
                        console.log("Opened Page...");

                        //Let page render before continuing
                        setTimeout(function () {
                            console.log("inside of settimeout");
                            page.onConsoleMessage = function (msg) { console.log(msg); };
                            return page.evaluate(function (args) {
                                
                                console.log("Codeblock: " + args.codeblock);
                                console.log("Evaluating js...");
                                console.log("selector: " + args.selector);
                                console.log("args: " + args);

                                //Execute any pre-rendering javascript here
                                if (args.codeblock) {
                                    console.log("About to execute pre-render logic.");
                                    var preFunk;
                                    try {
                                        preFunk = (new Function("return function() {" + args.codeblock + "};"))();
                                        console.log(preFunk);
                                        preFunk();
                                    } catch (e) {
                                        
                                    }
                                    console.log("Executed pre-render logic.");
                                }

                                if (args.selector) {
                                    console.log("Getting clip extent");

                                    var clipRect = document.querySelector(args.selector).getBoundingClientRect();
                                    console.log(clipRect);

                                    return { "clipRect": clipRect };
                                }
                                else {
                                    return {};
                                }

                            }, function (err, result) {
                                setTimeout(function () {
                                    var outputURL = req.protocol + "://" + req.get('host') + "/output/";
                                    if (result && result.clipRect) {
                                        //Clip
                                        page.set('clipRect', { width: result.clipRect.width, height: result.clipRect.height, top: result.clipRect.top, left: result.clipRect.left }, function (err) {
                                            return page.render('output/phantomoutput.' + imageformat, function () {
                                                console.log('Page Rendered - ' + (err || result));
                                                ph.exit();
                                                //Render
                                                var imageLink = 'phantomoutput.' + imageformat;
                                                if (format == "html") {
                                                    res.render('print', { imageLink: imageLink, errorMessage: err, imageformat: req.body.imageformat, format: req.body.format, url: req.body.url, delay: req.body.delay, selector: req.body.selector, codeblock: req.body.codeblock, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "", name: "Print" }] })
                                                }
                                                else if (format == "json") {
                                                    //Respond with JSON
                                                    res.header("Content-Type:", "application/json");
                                                    res.end(JSON.stringify({ image: outputURL + imageLink }));
                                                }
                                            });
                                        });
                                    }
                                    else {
                                        //Don't clip                                 
                                        return page.render('output/phantomoutput.' + imageformat, function () {
                                            console.log('Page Rendered - ' + (err || result));
                                            ph.exit();
                                            //Render
                                            var imageLink = 'phantomoutput.' + imageformat;
                                            if (format == "html") {

                                                res.render('print', { imageLink: imageLink, errorMessage: err, imageformat: req.body.imageformat, format: req.body.format, url: req.body.url, delay: req.body.delay, selector: req.body.selector, codeblock: req.body.codeblock, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "", name: "Print" }] })
                                            }
                                            else if (format == "json") {
                                                //Respond with JSON
                                                res.header("Content-Type:", "application/json");
                                                res.end(JSON.stringify({ image: outputURL + imageLink }));
                                            }
                                        });
                                    }
                                }, 3000); //wait a sec


                            }, { codeblock: codeblock, selector: selector}); //arguments to be passed to page.evaluate

                        }, delay);
                    });
                });
            });
        });
    }
    else {
        //Render Query Form without any results.
        res.render('print', { breadcrumbs: [{ link: "/services", name: "Home" }, { link: "", name: "Print" }] });
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

//Print API
app.get('/print', routes['print']);

//Post Options
app.post('/print', routes['print']);



http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});



//pass in a table, and a comma separated list of fields to NOT select
function createSelectAllStatementWithExcept(table, except_list, callback) {

    var client = new pg.Client(conString);
    client.connect();
    
    var sql = "SELECT c.column_name::text FROM information_schema.columns As c WHERE table_name = '" + table + "' AND  c.column_name NOT IN(" + except_list + ")";

    var query = client.query(sql);

    console.log("field sql: " + sql);

    var fields = [];
    query.on('row', function (row) {
        console.log(row);
        fields.push(row.column_name);
    });

    //Handle query error - fires before end event
    query.on('error', function (error) {
        req.params.errorMessage = error;
    });

    query.on('end', function () {
        client.end();
        console.log(fields.join(","));
        callback(fields.join(","));
    });
}

//pass in a table, get an array of geometry columns
function getGeometryFieldNames(table, callback) {

    console.log("table: " + table);
    if (table == '') callback([]); //If no table, return empty array

    console.log("still here");

    var client = new pg.Client(conString);
    client.connect();

    var sql = "select column_name from INFORMATION_SCHEMA.COLUMNS where (data_type = 'USER-DEFINED' AND udt_name = 'geometry') AND table_name = '" + table + "'";

    var query = client.query(sql);
    console.log("swl: " + sql);

    var geom_fields = [];
    query.on('row', function (row) {
        console.log("geom_names: " + row.column_name);
        geom_fields.push(row.column_name);
    });

    //Handle query error - fires before end event
    query.on('error', function (error) {
        req.params.errorMessage = error;
    });

    query.on('end', function () {
        client.end();
        callback(geom_fields);
    });
}


//After getting fields for a query, finish executing it and write results accordingly.
function completeExecuteSpatialQuery(req, res, sql, geom_fields_array){

    //Setup Connection to PG
    var client = new pg.Client(conString);
    client.connect();

    //Log the query to the console, for debugging
    console.log("Query: " + sql);
    var query = client.query(sql);

    //formatting
    var rows = [];
    query.on('row', function (row) {
        rows.push(row);
    });

    //Handle query error - fires before end event
    query.on('error', function (error) {
        req.params.errorMessage = error;
    });

    //On last result, decide how to write out results.
    query.on('end', function () {
        //End PG connection
        client.end();

        //Check which format was specified
        if (!req.body.format || req.body.format == "html") {
            var formatted = geoJSONFormatter(rows, geom_fields_array); //The page will parse the geoJson to make the HTMl
            //Render HTML page with results at bottom
            res.render('table_query', { title: 'pGIS Server', errorMessage: req.params.errorMessage, infoMessage: req.params.infoMessage, table: req.params.table, featureCollection: formatted, format: req.body.format, wkt: req.body.wkt, where: req.body.where, groupby: req.body.groupby, statsdef: req.body.statsdef, returnfields: req.body.returnfields, returnGeometry: req.body.returnGeometry, breadcrumbs: [{ link: "/services", name: "Home" }, { link: "/services/" + req.params.table, name: req.params.table }, { link: "", name: "Query" }] })
        }
        else if (req.body.format && req.body.format == "GeoJSON") {
            //Respond with JSON
            var formatted = geoJSONFormatter(rows, geom_fields_array);
            res.header("Content-Type:", "application/json");
            res.end(JSON.stringify(formatted));
        }
        else if (req.body.format && req.body.format == "ESRI JSON") {
            //Respond with ESRI JSON
            var formatted = ESRIFeatureSetJSONFormatter(rows, geom_fields_array);
            res.header("Content-Type:", "application/json");
            res.end(JSON.stringify(formatted));
        }
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
        }
        else {
            var geom_query_array = [];
            geom_fields_array.forEach(function (item) {
                geom_query_array.push("ST_AsGeoJSON(st_geometryn(" + item + ", 1), 5)::json As " + item);
            });
            this.callback(geom_fields_array, geom_query_array);
        }
    }
 );


function geoJSONFormatter(rows, geom_fields_array) {
    //Take in results object, return GeoJSON

    //Loop thru results
    var featureCollection = { "type": "FeatureCollection", "features": [] };

    rows.forEach(function(row){
        var feature = { "type": "Feature", "properties": {} };
        //Depending on whether or not there is geometry properties, handle it.  If multiple geoms, use a GeometryCollection output for GeoJSON.

        if (geom_fields_array && geom_fields_array.length == 1) {
            //single geometry
            if (row[geom_fields_array[0]]) {
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
                if(row[geom_fields_array[0]].type == "Polygon") featureSet.geometryType = "esriGeometryPolygon";
                else if(row[geom_fields_array[0]].type == "Point") featureSet.geometryType = "esriGeometryPoint";
                else if(row[geom_fields_array[0]].type == "Line") featureSet.geometryType = "esriGeometryLine";
                else if(row[geom_fields_array[0]].type == "Polyline") featureSet.geometryType = "esriGeometryPolyline";
                //TODO - add the rest
                //TODO - support all types below
                feature.geometry = {};

                if(featureSet.geometryType = "esriGeometryPolygon"){
                    feature.geometry.rings = row[geom_fields_array[0]].coordinates;
                }
                else{
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

//Utilities

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

function functionFromString(funcDef) {
    if (!funcDef) funcDef = "";
    try {
        return (new Function("return function() {" + funcDef + "};"))();
    } catch (e) {
        alert(e);
        return (function () { });
    }
}