var flow = require('flow');
var pg = require('pg');
var common = require("../../../common");

var operation = {};


/* METADATA */

operation.name = "FilterGadmChildrenByParent";
operation.description = "Takes a GADM id and gadm child layer, and returns a list of gadm records that have GADM parent with submitted parent id.";
operation.inputs = {};


operation.inputs["gadmParentId"] = { value: "", required: true, help: "A GADM feature ID; GADM source layer must have finer-grained GADM child layers (e.g., GADM0)." };
operation.inputs["gadmChildTable"] = { value: "", required: true, help: "A GADM table name; Table must have coarser-grained GADM parent table (e.g., GADM1" };

operation.execute = flow.define(
    function(args, callback) {

        //The query to be executed
        var query = "SELECT {{idField}} AS id, {{nameField}} AS name, ST_AsGeoJSON(ST_ENVELOPE(geom)) AS extent FROM {{gadmChildTable}} WHERE {{parentIdField}} =  {{gadmParentId}}";

        this.args = args;
        this.callback = callback;

        var gadmParentId = operation.inputs["gadmParentId"].value = args.gadmParentId;
        var gadmChildTable = operation.inputs["gadmChildTable"].value = args.gadmChildTable;
        var idField = 'id_';
        var parentIdField = 'id_';
        var nameField = 'name_';

        if(/^\s*(\+|-)?\d+\s*$/.test(gadmParentId) === false){
            return callback({text: "GADM parent ID is not an integer."});
        };


        if(gadmChildTable === 'gadm1') {
            idField += '1';
            parentIdField += '0';
            nameField += '1'
        } else if (gadmChildTable === 'gadm2'){
            idField += '2';
            parentIdField += '1';
            nameField += '2'
        } else if (gadmChildTable === 'gadm3'){
            idField += '3';
            parentIdField += '2';
            nameField += '3'
        } else {
            return callback({text: "Invalid GADM table name."});
        }


        //Step 1

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(operation.inputs) === true) {

            var sql = { text: query.replace("{{idField}}", idField)
                .replace("{{nameField}}", nameField)
                .replace("{{gadmChildTable}}", gadmChildTable)
                .replace("{{parentIdField}}", parentIdField)
                .replace("{{gadmParentId}}", gadmParentId), values: []};

            common.executePgQuery(sql, this);//Flow to next function when done.

        }
        else {
            //Invalid arguments
            //return message
            callback({text: "Missing required arguments."});
        }
    },
    function(err, results) {
        //Step 2 - get the results and pass back to calling function
        this.callback(err, results);
    }
);

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