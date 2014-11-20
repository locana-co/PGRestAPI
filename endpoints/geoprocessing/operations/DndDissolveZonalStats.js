//12.23.2013 - Ryan Whitley
var flow = require('flow');
var pg = require('pg'),
        common = require("../../../common"),
        settings = require('../../../settings/settings'),
        shortid = require('shortid');

//Takes in a set of lat/longs, buffers, dissolves and zonal stats.  Return table of zonal stats.
//Arguments are:
//1. The points.
//2. Buffer Radius
//3. Country Code

var operation = {};
var countries = { 'TZA': { name: 'tanzania', srid: '32736' }, 'BGD': { srid: '32645', name: 'bangladesh' }, 'UGA': { srid: '32635', name: 'uganda' }, 'NGA': { name: 'nigeria', srid: '32632' }, 'KEN': { name: 'kenya', srid: '32636' } };
//SRIDs from http://www.sumapa.com/crsxpais.cfm
/* METADATA */

operation.name = "DnDAccessSummary";
operation.description = "Calculates the number of people living within a certain radius of given access ponits, broken down by urban and rural locations.";
operation.inputs = {};

operation.outputImage = true;

operation.inputs["geojson"] = { value: "", required: true, help: "input geometry as geojson" };
operation.inputs["buffer_distance"] = { value: "", required: true, help: "point buffer distance, in meters" };
operation.inputs["country_code"] = { value: [], required: true, help: "TZA, BGD, UGA, NGA, KEN, IND" };


operation.Query = "DO $$DECLARE " +
"BEGIN " +
"drop table if exists \"_gptemp{gpid}\"; " +
"create temporary table \"_gptemp{gpid}\" as  " +
"select a.landuse, a.name, a.total, " +
"ST_UNION(st_intersection(a.geom,b.geom)) as geom " +
"from {country}_district_landuse a " +
"inner join (SELECT ST_Union(ST_transform( ST_BUFFER( ST_transform(ST_GeomFromGeoJson('{geojson}'), {srid}), {buffer_distance}), 4326 )) as geom " +
") b on " +
"st_intersects(a.geom, b.geom) " +
"GROUP BY a.landuse, a.name, a.total; " +
"CREATE INDEX \"_gptemp{gpid}_gix\" ON \"_gptemp{gpid}\" USING GIST (geom); " +
"END$$; " +
"SELECT SUM((_st_summarystats(ST_Clip(rast,c.geom, true), 1, true, 1)).sum) as  sum, c.landuse, c.name, c.total, ST_AsGeoJSON(c.geom) as geom " +
"FROM {country}_population_raster, \"_gptemp{gpid}\" c " +
"WHERE ST_Intersects(c.geom,rast) " +
"GROUP BY c.landuse, c.geom, c.name, c.total; ";



operation.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;
        //Step 1

        //Generate UniqueID for this GP Task
        operation.id = shortid.generate();


        operation.inputs["geojson"].value = args.geojson;
        operation.inputs["buffer_distance"].value = args.buffer_distance;
        operation.inputs["country_code"].value = args.country_code ? args.country_code.toUpperCase() : "";

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(operation.inputs) === true) {
            //Take the point and buffer it in PostGIS
            var query = {
                text: operation.Query.replace("{geojson}", operation.inputs["geojson"].value).split("{gpid}").join(operation.id).replace("{buffer_distance}", operation.inputs["buffer_distance"].value).split("{country}").join(countries[operation.inputs["country_code"].value].name).replace("{srid}", countries[operation.inputs["country_code"].value].srid),
                values: []
            };
            common.executePgQuery(query, this);//Flow to next function when done.

        }
        else {
            //Invalid arguments
            //return message
            callback({text: "Missing required arguments"}); //err is first argument
        }
    },
    function (err, results) {
        //Step 2 - get the results and pass back to calling function
        this.callback(err, results);
    }
)

//Make sure arguments are tight before executing
operation.isInputValid = function(input) {
    //Check inputs
    if(input){
        for (var key in input) {
            if (input.hasOwnProperty(key)) {
                if (input[key].required && (!input[key].value || input[key].value.length == 0)) {
                    //Required but not present.
                    return false;
                }
            }
        }
    }

    return true;
};

module.exports = operation;