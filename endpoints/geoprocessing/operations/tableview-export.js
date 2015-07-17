var flow = require('flow');
var pg = require('pg');
var emailValidator = require("email-validator");
var email   = require('emailjs');
var fs = require('fs');
var json2csv = require('json2csv');
var AdmZip = require('adm-zip');
var settings = require('../../../settings/settings');
var server  = email.server.connect(settings.emailConfig);
var tableviewsRaw = require("./tableviews.json");
var tableviewDictionary = {};

tableviewsRaw.forEach(function(tableview){
    tableviewDictionary[tableview.survey_id] = tableview;
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
        var respondentIds = operation.inputs["respondent_ids"].value = args.respondent_ids;

        if(/^\s*(\+|-)?\d+\s*$/.test(surveyId) === false){
            return callback({text: "survey_id is not an integer."});
        };


        if(!Array.isArray(respondentIds)) {

            // handle if a comma delimited string was submitted
            respondentIds = respondentIds.split(',');

            if(!Array.isArray(respondentIds)) {
                return callback({text: "respondent_ids is not an array."});
            }

        }

        // make sure all ids are integers
        var allIdAreInts = true;

        respondentIds.every(function(id){

            if(/^\s*(\+|-)?\d+\s*$/.test(id) === false){
                allIdAreInts = false;
                return false;
            };

        });

        respondentIds = respondentIds.map(function(id){ return Number(id)});

        if(allIdAreInts === false) {
            callback({text: "at least on respondent id is not an integer."});
            return;
        }

        var surveyData = tableviewDictionary[surveyId].data;
        var headersObj = tableviewDictionary[surveyId].header_map;

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

            if (err) {
                callback({text:err});
                return;
            }

            var fileName = 'export/_' + Math.random().toString(36).substr(2, 9) + '.zip';
            var zip = new AdmZip();
            zip.addFile("ata-table-export.csv", new Buffer(csv), "table export");
            zip.writeZip(fileName);

            var message = {
                text:    "Your ATA table export is attached",
                from:    "noreply@ata.gov.et",
                to:      "<" + emailAddress + ">",
                subject: "ATA table export",
                attachment:
                    [
                        {path:fileName, type:"application/zip", name:"ata-table-export.zip"}
                    ]
            };

            // send the message and get a callback with an error or details of the message that was sent
            server.send(message, function(err, message) {

                if(err){
                    callback({text: "failure to send email; " + err});
                    return;
                }

                callback(null, {rows: [{response: "success"}]});

                // Delete file
                fs.unlink(fileName, function (err) {
                    if (err) throw err;
                    console.log('successfully deleted ' + fileName);
                });


            });



        });

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