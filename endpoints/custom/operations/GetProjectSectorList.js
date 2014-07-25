//5.6.2014 - Ryan Whitley

/**
 * NH Note: We are not using this anymore, because we get all of the project sectors
 * via the Succubus, thus one less hit on the db... This is here for future reference.
 *
 * @type {exports}
 */

var flow = require('flow');
var common = require("../../../common"),
    settings = require('../../../settings'),
    shortid = require('shortid');

var operation = {};

/* METADATA */
operation.name = "GetProjectSectorList";
operation.description = "Gets List of ECOS Project Sectors.";
operation.inputs = {};

operation.outputImage = false;

operation.Query = "SELECT DISTINCT ON (sector__c) sector__c as sector FROM sf_aggregated_gadm_project_counts where sector__c is not null;";

operation.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;
        //Step 1

        //Generate UniqueID for this Task
        operation.id = shortid.generate();

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(args) === true) {
            //Execute the query
            common.executePgQuery({text: operation.Query}, this);//Flow to next function when done.
        }
        else {
            //Invalid arguments
            //return message
            callback("Unknown error."); //err is first argument
        }
    },
    function (err, results) {
        //Step 2 - get the results and pass back to calling function
        //Wait just a second.  ECOS Sectors are semi-colon delimited.  Break up by semicolons and return the unique list.
        var output = [];
        results.rows.forEach(function(item){
            var split = item.sector.split(";");
            split.forEach(function(sector){
                if(output.indexOf(sector) == -1){
                    output.push(sector);
                }
            });
        })

        this.callback(err, { rows: output }); //caller wants to see a property called rows that is an array.
    }
)

//Make sure arguments are tight before executing
operation.isInputValid = function (input) {
    //Test to see if inputs are specified
    //no inputs
    var isValid = true;
    return isValid;
}

module.exports = operation;
