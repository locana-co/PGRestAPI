/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 5/14/14.
 */

var flow = require('flow');
var common = require("../../../common"),
  settings = require('../../../settings'),
  shortid = require('shortid');

var operation = {};

/* METADATA */
operation.name = "projecttotalbudget";
operation.description = "Gets the min, mean, and max values of the total_budget__c field in sf_project";
operation.inputs = {};

operation.outputImage = false;

operation.Query = "select min(total_budget__c), avg(total_budget__c), max(total_budget__c) from sf_project;";

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

    this.callback(err, results); //caller wants to see a property called rows that is an array.

  }
);

//Make sure arguments are tight before executing
operation.isInputValid = function (input) {
  //Test to see if inputs are specified
  //no inputs
  var isValid = true;
  return isValid;
}

module.exports = operation;
