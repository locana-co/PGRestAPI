//4.3.2014 - Ryan Whitley
var flow = require('flow');
var common = require("../../../common"),settings = require('../../../settings'),shortid = require('shortid');

var operation = {};

/* METADATA */
operation.name = "GetFeaturesByID";
operation.description = "Gets GADM boundaries based on an ID.";
operation.inputs = {};

operation.outputImage = false;

operation.inputs["ids"] = {}; //comma separated list of ids
operation.inputs["gadm_level"] = {}; //gadm_level to search thru
operation.inputs["simplification_level"] = {}; //How much to simplify the feature by (in degrees)

operation.Query = "SELECT ST_AsGeoJSON(geom_simplify_med) as geom, guid FROM gadm{{gadm_level}} WHERE guid IN ({{ids}})";
operation.ARCQuery = "SELECT ST_AsGeoJSON(geom) as geom, gid FROM arc_regions_dissolved WHERE gid IN ({{ids}})";

operation.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;
        //Step 1

        //Generate UniqueID for this Task
        operation.id = shortid.generate();

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(args) === true) {
            //prepare bbox string as WKT
            operation.inputs["ids"] = args.ids;
            operation.inputs["gadm_level"] = args.gadm_level;
            operation.inputs["simplification_level"] = args.simplification_level; //currently not using

            //need to wrap ids in single quotes
            //Execute the query
            var query;
					  if(args.gadm_level == -1){
							query = { text: operation.ARCQuery.replace("{{ids}}", operation.wrapIdsInQuotes(args.ids)) };
						}
					else {
							query = { text: operation.Query.replace("{{gadm_level}}", args.gadm_level).replace("{{ids}}", operation.wrapIdsInQuotes(args.ids)) };
						}
            common.executePgQuery(query, this);//Flow to next function when done.
        }
        else {
            //Invalid arguments
            //return message
            callback("Missing or invalid required arguments: gadm_level or ids"); //err is first argument
        }
    },
    function (err, results) {
        //Step 2 - get the results and pass back to calling function
        this.callback(err, results);
    }
)

//Make sure arguments are tight before executing
operation.isInputValid = function (input) {
    //Test to see if inputs are specified
    var isValid = false;

    if (input) {
        //make sure we have a bbox.  Other args are optional
        if (input["ids"] && input["gadm_level"]) {
            //It's got everything we need.
            return true;
        }
    }

    //TODO - check that the ST_Extent of the input WKT at least touches the BBox of the country specified.
    //If not, then respond accordingly.

    return isValid;
}

operation.wrapIdsInQuotes = function(ids){
    return ids.split(',').map(function(item){
        return "'" + item + "'";
    });
}

module.exports = operation;