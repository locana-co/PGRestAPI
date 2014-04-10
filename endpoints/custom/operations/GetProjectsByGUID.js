//4.9.2014 - Ryan Whitley
var flow = require('flow');
var common = require("../../../common"),settings = require('../../../settings'),shortid = require('shortid');

var operation = {};

/* METADATA */
operation.name = "GetProjectsByGUID";
operation.description = "Gets ECOS Projects for a given GADM boundary based on a GUID.";
operation.inputs = {};

operation.outputImage = false;

operation.inputs["guids"] = {}; //comma separated list of guids

operation.Query = "SELECT * FROM sf_all_projects WHERE gis_geo_id__c IN ({{guids}})";

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
            operation.inputs["guids"] = args.guids;

            //need to wrap ids in single quotes
            //Execute the query
						query = { text: operation.Query.replace("{{guids}}", operation.wrapIdsInQuotes(operation.inputs["guids"])) };
            common.executePgQuery(query, this);//Flow to next function when done.
        }
        else {
            //Invalid arguments
            //return message
            callback("Missing or invalid required arguments: guids"); //err is first argument
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
        if (input["guids"]) {
            //It's got everything we need.
            return true;
        }
    }

    return isValid;
}

operation.wrapIdsInQuotes = function(ids){
    return ids.split(',').map(function(item){
        return "'" + item + "'";
    });
}

module.exports = operation;