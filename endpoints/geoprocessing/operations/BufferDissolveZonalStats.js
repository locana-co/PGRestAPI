//10.17.2013 - Ryan Whitley
var flow = require('flow');
var pg = require('pg'),
        common = require("../../../common"),
        settings = require('../../../settings');

//Takes in a where clause, buffers, dissolves and zonal stats.  Return table of zonal stats.
//Arguments are:
//1. The points (or at least a where clause to query a particular table).
//2. Buffer Radius

var operation = {};
var countries = { 'TZA': { name: 'tanzania', srid: '32736' }, 'BGD': { srid: '32645', name: 'bangladesh' }, 'UGA': { srid: '32635', name: 'uganda' }, 'NGA': { name: 'nigeria', srid: '32632' }, 'KEN': { name: 'kenya', srid: '32636' } };
//SRIDs from http://www.sumapa.com/crsxpais.cfm
/* METADATA */

operation.name = "AccessSummary";
operation.description = "Calculates the number of people living within a certain radius of given access ponits, broken down by urban and rural locations.";
operation.inputs = {};

operation.outputImage = true;

operation.inputs["where_clause"] = {};
operation.inputs["buffer_distance"] = { value: 0, units: "" }; //how far and what units?
operation.inputs["country_code"] = []; //Let user specify input country code

//This will execute just for Land Use and buffers - ~ 4 seconds for all points in Uganda, minus rural
operation.Query = "DO $$DECLARE " +
"BEGIN " +
"drop table if exists _gptemp; " +
"create temporary  table _gptemp as  " +
"select a.landuse, a.name, " +
"ST_UNION(st_intersection(a.geom,b.geom)) as geom " +
"from {country}_district_landuse a " +
"inner join (SELECT ST_Union(ST_transform( ST_BUFFER( ST_transform(geom, {srid}), {buffer_distance}), 4326 )) as geom " +
"FROM {country}_cicos " +
"WHERE {where_clause} " +
") b on " +
"st_intersects(a.geom, b.geom) " +
"GROUP BY a.landuse, a.name; " +
"CREATE INDEX _gptemp_gix ON _gptemp USING GIST (geom); " +
"END$$; " +
"SELECT SUM((_st_summarystats(ST_Clip(rast,_gptemp.geom, true), 1, true, 1)).sum) as  sum, _gptemp.landuse, _gptemp.name, ST_AsGeoJSON(_gptemp.geom) as geom " +
"FROM {country}_population_raster, _gptemp " +
"WHERE ST_Intersects(_gptemp.geom,rast) " +
"GROUP BY _gptemp.landuse, _gptemp.geom, _gptemp.name; ";



operation.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;
        //Step 1

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(args) === true) {
            operation.inputs["where_clause"] = args.where_clause;
            operation.inputs["buffer_distance"] = args.buffer_distance;
            operation.inputs["country_code"] = args.country_code.toUpperCase();

            //Take the point and buffer it in PostGIS
            var query = { text: operation.Query.replace("{where_clause}", operation.inputs["where_clause"]).replace("{buffer_distance}", operation.inputs["buffer_distance"]).split("{country}").join(countries[operation.inputs["country_code"]].name).replace("{srid}", countries[operation.inputs["country_code"]].srid), values: [] };
            common.executePgQuery(query, this);//Flow to next function when done.

        }
        else {
            //Invalid arguments
            //return message
            callback({ status: "Missing required arguments", rows: [] });
        }
    },
    function (results) {
        //Step 2 - get the results and pass back to calling function
        this.callback(results);
    }
)

//Make sure arguments are tight before executing
operation.isInputValid = function (input) {
    //Test to see if inputs are specified
    var isValid = false;

    if (input) {
        //make sure we have a where clause, buffer disatance and the country code is found in the country object.
        if (input["where_clause"] && input["buffer_distance"] && countries[input["country_code"].toUpperCase()]) {
            //It's got everything we need.
            return true;
        }
    }

    return isValid;
}

module.exports = operation;