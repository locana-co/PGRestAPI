//10.17.2013 - Ryan Whitley
var flow = require('flow');
var pg = require('pg'),
        common = require("../../../common"),
        settings = require('../../../settings/settings'),
        shortid = require('shortid');

//Takes in a where clause, buffers, dissolves and zonal stats.  Return table of zonal stats.
//Arguments are:
//1. The points (or at least a where clause to query a particular table).
//2. Buffer Radius

var operation = {};
var countries = { 'TZA': { name: 'tanzania', srid: '32736' }, 'BGD': { srid: '32645', name: 'bangladesh' }, 'UGA': { srid: '32635', name: 'uganda' }, 'NGA': { name: 'nigeria', srid: '32632' }, 'KEN': { name: 'kenya', srid: '32636' }, 'IND': { name: 'india', srid: '32643'} };
//SRIDs from http://www.sumapa.com/crsxpais.cfm

/* METADATA */
operation.name = "CreateFSPBufferImageService";
operation.description = "Creates a WMS-like image service based on GeoJSON queried out of the DB.";
operation.inputs = {};

operation.outputImage = true;

operation.inputs["where_clause"] = { value: "", required: true, help: "where clause to specify which points to buffer" };
operation.inputs["buffer_distance"] = { value: "", required: true, help: "point buffer distance, in meters" };
operation.inputs["country_code"] = { value: [], required: true, help: "TZA, BGD, UGA, NGA, KEN, IND" }; //Let user specify input country code
operation.inputs["sector_year"] = { value: [], required: true, help: "which year - 2014 or 2013" }; //Let user specify the sector year.  2013 or 2014
operation.inputs["sector"] = { value: "", required: true, help: "agriculture,library,health,cicos" }; //which sector are we processing? agriculture,library,health,cicos


operation.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;
        //Step 1

        //Generate UniqueID for this GP Task
        operation.id = shortid.generate();

        operation.inputs["where_clause"].value = args.where_clause;
        operation.inputs["buffer_distance"].value = args.buffer_distance;
        operation.inputs["country_code"].value = args.country_code ? args.country_code.toUpperCase() : "";
        operation.inputs["sector_year"].value = args.sector_year;
        operation.inputs["sector"].value = args.sector;


        var base_query = "SELECT ST_AsGeoJSON(ST_Union(ST_transform( ST_BUFFER( ST_transform(geom, {srid}), {buffer_distance}), 4326 ))) as geom " +
        "FROM {sector}_{sector_year} " +
        "WHERE lower({sector}_{sector_year}.country) = lower('{country}') " +
        "AND {where_clause};";

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(operation.inputs) === true) {

            //Take the point and buffer it in PostGIS
            var query = {
                text: base_query.replace("{where_clause}", args.where_clause).split("{sector_year}").join(args.sector_year).split("{sector}").join(args.sector).replace("{buffer_distance}", args.buffer_distance).split("{country}").join(countries[args.country_code.toUpperCase()].name).replace("{srid}", countries[args.country_code.toUpperCase()].srid),
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