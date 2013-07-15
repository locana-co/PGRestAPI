var express = require('express');
var pg = require('pg');
var app = express();
var routes = [];

//Define routes
routes['root'] = function(req, res){
  res.send('Welcome to the Spatial Dev GP REst API.');
};

routes['getDistrict'] = function (req, res) {
    var conString = "postgres://postgres:p0stgr3s*1@localhost:5434/crs";

    var client = new pg.Client(conString);
    client.connect();

    var sql = "SELECT row_to_json(fc) " +
     "FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features " +
     "FROM (SELECT 'Feature' As type " +
     "   , ST_AsGeoJSON(st_geometryn(lg.geom, 1), 5)::json As geometry " +
     "   , row_to_json(lp) As properties " +
     "  FROM bihar As lg " +
     "        INNER JOIN (SELECT gid, district, total_popu FROM bihar) As lp " +
     "      ON lg.gid = lp.gid WHERE lg.gid = " + req.params.id + "  ) As f )  As fc;"

    var query = client.query(sql);

    //Response
    res.header("Content-Type:", "application/json");

    query.on('row', function (row) {
        //console.log(JSON.stringify(row));
        res.write(JSON.stringify(row));
    });

    query.on('end', function () {
        res.end("");
        client.end();
    });

};

routes['getAllDistricts'] = function (req, res) {
    var conString = "postgres://postgres:p0stgr3s*1@localhost:5434/crs";

    var client = new pg.Client(conString);
    client.connect();

    var sql = "SELECT row_to_json(fc) " +
     "FROM ( SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features " +
     "FROM (SELECT 'Feature' As type " +
     "   , ST_AsGeoJSON(st_geometryn(lg.geom, 1), 5)::json As geometry " +
     "   , row_to_json(lp) As properties " +
     "  FROM bihar As lg " +
     "        INNER JOIN (SELECT gid, district, total_popu FROM bihar) As lp " +
     "      ON lg.gid = lp.gid  ) As f )  As fc;"

    var query = client.query(sql);

    //Response
    res.header("Content-Type:", "application/json");

    query.on('row', function (row) {
        //console.log(JSON.stringify(row));
        res.write(JSON.stringify(row));
    });

    query.on('end', function () {
        res.end("");
        client.end();
    });
};





//Define paths
app.get('/', routes['root']);

app.get('/hello.txt', function(req, res){
  res.send('Hello World');
});

//Get All Districts
app.get('/entities/bihar', routes['getAllDistricts']);

//Get Specific District
app.get('/entities/bihar/:id', routes['getDistrict']);


app.listen(3000);
console.log('Listening on port 3000');