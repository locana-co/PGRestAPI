var flow = require('flow');
var pg = require('pg');
var email   = require('emailjs');
var fs = require('fs');
var path = require('path');
var json2csv = require('json2csv');
var AdmZip = require('adm-zip');
var CronJob = require('cron').CronJob;

// Email settings
var settings = require('../../../settings/settings');
var server  = email.server.connect(settings.emailConfig);

// Static table view data
var tableviewsRaw = require("./tableviews.json");
var tableviewDictionary = {};

tableviewsRaw.forEach(function(tableview){
    tableviewDictionary[tableview.survey] = tableview;
});


// Cron job to clear out export folder;  files should get deleted, but if operation has an exception it might not
new CronJob('00 00 00 * * *', function(){

    var files = fs.readdirSync('export', function(err, files) {});

    files.filter(function(filename) {

        return path.extname(filename) === '.zip';

    }).forEach(function(filename) {
        // Delete file
        fs.unlink('export/' + filename, function (err) {
            if (err) throw err;
            console.log('successfully deleted ' + filename);
        });
    });

}, null, true, "America/Los_Angeles");

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


        if(respondentIds === null) {
            return callback({text: "respondent_ids is not an array."});
        }

        if(emailAddress === null) {
            return callback({text: "email address cannot be null."});
        }

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

        if(allIdAreInts === false) {
            callback({text: "at least on respondent id is not an integer."});
            return;
        }

        respondentIds = respondentIds.map(function(id){ return Number(id)});

        var surveyData = tableviewsRaw.filter(function(tableview){
            return tableview.survey_id === surveyId;
        });

        if(surveyData.length === 0) {
            callback({text: "Invalid survey id."});
            return;
        }
        var tableData = surveyData[0].data;
        var headersObj = surveyData[0].header_map;

        var fields = [];
        var fieldnames = [];

        for(var i in headersObj) {
            fields.push(i);
            fieldnames.push(headersObj[i]);
        }

        // Limit to the submitted respondentIDs

        var filteredRecords = tableData.filter(function(rec){

            return respondentIds.indexOf(rec.respondent_id) > -1;
        })

        if(filteredRecords.length === 0) {
            console.error('No records for export!!!!');
        }
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