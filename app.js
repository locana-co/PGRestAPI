
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
	res.render('index', { title: 'pGIS Server', list: table_list })
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
        res.render('table_details', { title: 'pGIS Server', table_details: table_list })
        client.end();
    });
};


//Allow for Table Query
routes['tableQuery'] = function (req, res) {

    //If the querystring is empty, just show the regular HTML form.
    if (JSON.stringify(res.query)) {
        //debugger;
        var empty = JSON.stringify(res.query);
        res.write(empty);
        //var client = new pg.Client(conString);
        //client.connect();

        //var sql = "select column_name, CASE when data_type = 'USER-DEFINED' THEN udt_name ELSE data_type end as data_type from INFORMATION_SCHEMA.COLUMNS where table_name = '" + req.params.table + "'";

        //var query = client.query(sql);

        ////Response
        //res.header("Content-Type:", "application/json");


        //var table_list = [];
        //query.on('row', function (row) {
        //    table_list.push(row);
        //});

        //query.on('end', function () {
        //    res.render('table_details', { title: 'pGIS Server', query: table_list })
        //    client.end();
        //});
        res.end(req.query.length);
    }
    else {
        res.render('table_query', { title: 'pGIS Server', table: req.params.table })
    }
};




//Define Paths
//Root Request
app.get('/', function (req, res){
	res.render('index', { title: 'pGIS Server' })
});

//List All Tables
app.get('/services/', routes['listTables']);

//Table Detail
app.get('/services/:table', routes['tableDetail']);

//Table Query
app.get('/services/:table/query/', routes['tableQuery']);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
