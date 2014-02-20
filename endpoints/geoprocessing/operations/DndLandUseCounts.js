//1.6.2014 - Ryan Whitley
var flow = require('flow');
var pg = require('pg'),
        common = require("../../../common"),
        settings = require('../../../settings'),
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

operation.inputs["geojson"] = {};
operation.inputs["buffer_distance"] = []; //Let user specify input country code
operation.inputs["country_code"] = []; //Let user specify input country code


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
        //Step 1

        //Generate UniqueID for this GP Task
        operation.id = shortid.generate();

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(args) === true) {
            operation.inputs["geojson"] = args.geojson;
            operation.inputs["buffer_distance"] = args.buffer_distance;
            operation.inputs["country_code"] = args.country_code.toUpperCase();

            //Take the point and buffer it in PostGIS
            var query = { text: operation.Query.replace("{geojson}", operation.inputs["geojson"]).split("{gpid}").join(operation.id).replace("{buffer_distance}", operation.inputs["buffer_distance"]).split("{country}").join(countries[operation.inputs["country_code"]].name), values: [] };
            common.executePgQuery(query, this);//Flow to next function when done.

        }
        else {
            //Invalid arguments
            //return message
            callback({ status: "error", message: "Invalid or Missing arguments", rows: [] });
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
        if (input["geojson"] && input["buffer_distance"] && countries[input["country_code"].toUpperCase()]) {
            //It's got everything we need.
            return true;
        }
    }

    //TODO - check that the ST_Extent of the input WKT at least touches the BBox of the country specified.
    //If not, then respond accordingly.

    return isValid;
}

module.exports = operation;