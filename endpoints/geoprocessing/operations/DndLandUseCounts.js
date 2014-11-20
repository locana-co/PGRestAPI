//1.6.2014 - Ryan Whitley
var flow = require('flow');
var pg = require('pg'),
        common = require("../../../common"),
        settings = require('../../../settings/settings'),
        shortid = require('shortid');

//Takes in geojson parts, returns counts by landuse type.
//Arguments are:
//1. The points
//3. Country Code

var operation = {};
var countries = { 'TZA': { name: 'tanzania', srid: '32736' }, 'BGD': { srid: '32645', name: 'bangladesh' }, 'UGA': { srid: '32635', name: 'uganda' }, 'NGA': { name: 'nigeria', srid: '32632' }, 'KEN': { name: 'kenya', srid: '32636' } };
//SRIDs from http://www.sumapa.com/crsxpais.cfm
/* METADATA */

operation.name = "DnDLandUseCounts";
operation.description = "Calculates the counts of input features by a country's land use designations.";
operation.inputs = {};

operation.outputImage = true;

operation.inputs["geojson"] = { value: "", required: true, help: "input geometry as geojson" };
operation.inputs["buffer_distance"] = { value: "", required: true, help: "point buffer distance, in meters" };
operation.inputs["country_code"] = { value: [], required: true, help: "TZA, BGD, UGA, NGA, KEN, IND" };


operation.Query = "DO $$DECLARE " +
"BEGIN " +
"drop table if exists \"_gptemp{gpid}\"; " +
"create temporary table \"_gptemp{gpid}\" as  " +
"select a.landuse, count(b.*) as count " +
"from {country}_district_landuse a " +
"inner join (SELECT (ST_Dump(ST_CollectionExtract(ST_GeomFromGeoJson('{geojson}'), 1))).geom as geom " +
") b on " +
"st_intersects(a.geom, b.geom) " +
"GROUP BY a.landuse; " +
"END$$; " +
"SELECT * " +
"FROM \"_gptemp{gpid}\" c ";

operation.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;

        //Generate UniqueID for this GP Task
        operation.id = shortid.generate();

        operation.inputs["geojson"].value = args.geojson;
        operation.inputs["buffer_distance"].value = args.buffer_distance;
        operation.inputs["country_code"].value = args.country_code ? args.country_code.toUpperCase() : "";

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(operation.inputs) === true) {

            //Take the point and buffer it in PostGIS
            var query = {
                text: operation.Query.replace("{geojson}", operation.inputs["geojson"].value).split("{gpid}").join(operation.id).replace("{buffer_distance}", operation.inputs["buffer_distance"].value).split("{country}").join(countries[operation.inputs["country_code"].value].name),
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