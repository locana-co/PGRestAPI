var flow = require('flow');
var pg = require('pg');
var emailValidator = require("email-validator");
var fs = require('fs');
var json2csv = require('json2csv');
//var common = require("../../../common");
var tableviewsRaw = require("./tableviews.json");
var tableviewDictionary = {};

tableviewsRaw.forEach(function(tableview){
    tableviewDictionary[tableview.survey] = tableview;
});

var operation = {};


/* METADATA */

operation.name = "ExportTableview";
operation.description = "Takes an email address, survey id, and set of respondent ids, then creates and emails a CSV file.";
operation.inputs = {};


operation.inputs["survey_id"] = { value: "", required: false, help: "A valid survey id." };
operation.inputs["email_address"] = { value: "", required: false, help: "A email address to send zipped csv to." };
operation.inputs["respondent_ids"] = { value: "", required: false, help: "An array of respondent ids to limit CSV rows." };

operation.execute = flow.define(
    function(args, callback) {



        this.args = args;
        this.callback = callback;

        var surveyId = operation.inputs["survey_id"].value = args.survey_id;
        var emailAddress = operation.inputs["email_address"].value = args.email_address;
        var respondentIds = [915, 916, 917];//operation.inputs["respondent_ids"].value = args.respondent_ids;

        if(/^\s*(\+|-)?\d+\s*$/.test(surveyId) === false){
            return callback({text: "survey_id is not an integer."});
        };


        if(!respondentIds instanceof Array) {
            return callback({respondent_ids: "respondent_ids is not an array."});
        }

        var surveyData = tableviewDictionary['ftc'].data;
        var headersObj = tableviewDictionary['ftc'].header;

        var fields = [];
        var fieldnames = [];

        for(var i in headersObj) {
            fields.push(i);
            fieldnames.push(headersObj[i]);
        }

        // Limit to the submitted respondentIDs

        var filteredRecords = surveyData.filter(function(rec){

            return respondentIds.indexOf(rec.respondent_id) > -1;
        })

        json2csv({ data: filteredRecords, fields: fields, fieldNames: fieldnames }, function(err, csv) {
            if (err) console.log(err);
            console.log(csv);

            callback(null, {response: "success"});
        });

       // callback(null, { rows: filteredRecords});
        /*



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
        */
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