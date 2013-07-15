
/**
 * Module dependencies.
 */
var pg = require('pg');

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path');

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

    //Response
    res.header("Content-Type:", "application/json");


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

    //Response
    res.header("Content-Type:", "application/json");


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
routes['tableQuery'] = function (req, res) {
    //If the querystring is empty, just show the regular HTML form.

    if (JSON.stringify(req.body) != '{}') {

        //Get POST parameters
        var empty = JSON.stringify(req.body);

        //Setup Connection to PG
        var client = new pg.Client(conString);
        client.connect();

        var requestGeometry = "";

        //Did user specify to returnGeometry
        if (req.body.returnGeometry && req.body.returnGeometry.toLowerCase() == "yes") {
            //request the geometry
               requestGeometry = " , ST_AsGeoJSON(st_geometryn(lg.geom, 1), 5)::json As geometry "
        }
        else if (req.body.returnGeometry && req.body.returnGeometry.toLowerCase() == "no") {
            //Don't request it

        }
        else {
            //just request it
            requestGeometry = " , ST_AsGeoJSON(st_geometryn(lg.geom, 1), 5)::json As geometry "
        }

        //build SQL query
        var sql = "SELECT row_to_json(fc) " +
         "FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features " +
         "FROM (SELECT 'Feature' As type " +
         requestGeometry +
         "   , row_to_json(lp) As properties " +
         "  FROM " + req.params.table + " As lg " +
         "  INNER JOIN (";
        
        //Add in WHERE clause, if specified
        var mods = "";
        if (req.body.where) {
            mods = " " + req.body.where;
        }

        if (mods.length > 0) {
            mods = "WHERE " + mods;
        }

        //Finish building SQL String
        sql += "SELECT gid, district, total_popu FROM " + req.params.table + ") As lp " +
        " ON lg.gid = lp.gid " + mods + ") As f )  As fc;"

        //Log the query to the console, for debugging
        console.log("Query: " + sql);
        var query = client.query(sql);

        //Loop thru results
        var results_list = [];
        query.on('row', function (row) {
            results_list.push(row);
        });

        //On last result, decide how to write out results.
        query.on('end', function () {
            if (!req.body.format) {
                //if no format specified, render html
                res.render('table_query', { title: 'pGIS Server', table: req.params.table, query_results: results_list, format: req.body.format, where: req.body.where, returnGeometry: req.body.returnGeometry });
            }
            else {
                //Check which format was specified
                if (req.body.format && req.body.format == "html") {
                    //Render HTML page with results at bottom
                    res.render('table_query', { title: 'pGIS Server', table: req.params.table, query_results: results_list, format: req.body.format, where: req.body.where, returnGeometry: req.body.returnGeometry });
                }
                else if (req.body.format && req.body.format == "json") {
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
        res.render('table_query', { title: 'pGIS Server', table: req.params.table })
    }
};




//Define Paths
//Root Request
app.get('/', function (req, res) { res.render('index', { title: 'pGIS Server' }) });

//List All Tables
app.get('/services', routes['listTables']);

//Table Detail
app.get('/services/:table', routes['tableDetail']);

//Table Query - get - display page with default form
app.get('/services/:table/query', routes['tableQuery']);

//When a Query gets posted - read attributes from post and render results
app.post('/services/:table/query', routes['tableQuery']);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
