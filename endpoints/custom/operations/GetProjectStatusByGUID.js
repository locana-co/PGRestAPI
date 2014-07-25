//6.19.2014 - Ryan Whitley
var flow = require('flow');
var common = require("../../../common"), settings = require('../../../settings'), shortid = require('shortid');

var operation = {};

/* METADATA */
operation.name = "GetProjectHealthByGUID";
operation.description = "Gets ECOS Projects/Status for a given GADM boundary based on a GUID.";
operation.inputs = {};

operation.outputImage = false;

operation.inputs["guids"] = {}; //comma separated list of guids
operation.inputs["gadm_level"] = {}; //gadm_level to search thru
operation.inputs["filters"] = ""; //string - sql WHERE clause, minus the 'WHERE'

operation.ProjectQuery = "SELECT sf_project.* " +
  "FROM sf_aggregated_gadm_project_counts, sf_project " +
  "WHERE sf_aggregated_gadm_project_counts.sf_id = sf_project.sf_id " +
  "AND guid{{gadm_level}} = {{guids}} {{filters}}; ";

operation.StatusQuery = "SELECT * " +
  "FROM sf_project_status " +
  "WHERE project__c = {{guid}}; " ;

operation.execute = flow.define(
  function (args, callback) {
    this.args = args;
    this.callback = callback;
    //Step 1

    //Generate UniqueID for this Task
    operation.id = shortid.generate();

    //If theme is project, projectRisk, or projectHealth, add to the filters where phase is 1 - 5, which equates to Active projects.
    //In SalesForce, the phase__c column is text and has delimited values in the cells.  So, we'll do a 'like' operator instead of =
    var activeProjectWhereClause = " AND (sf_project.phase__c LIKE '%1%' OR sf_project.phase__c LIKE '%2%' OR sf_project.phase__c LIKE '%3%' OR sf_project.phase__c LIKE '%4%' OR sf_project.phase__c LIKE '%5%')";


    //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
    if (operation.isInputValid(args) === true) {
      //prepare bbox string as WKT
      operation.inputs["guids"] = args.guids;
      operation.inputs["gadm_level"] = args.gadm_level;
      operation.inputs["filters"] = args.filters;

      var filters = '';

      if (operation.inputs["gadm_level"] == -1) {
        operation.inputs["gadm_level"] = "arc";
      }
      if(operation.inputs["filters"] && operation.inputs["filters"] !== 'null'){
        var inputFilters = operation.inputs["filters"].replace(/%20/g, ' ').replace(/%25/g,'%').replace(/%27/g,"'");
        filters = " AND (" + inputFilters + ")";
        filters += activeProjectWhereClause;
      }
      else{
        //Add where clause to only show active projects
        filters = activeProjectWhereClause;
      }

      //need to wrap ids in single quotes
      //Execute the query
      var projectQuery = { text: operation.ProjectQuery.replace("{{guids}}", operation.wrapIdsInQuotes(operation.inputs["guids"])).replace("{{gadm_level}}", operation.inputs["gadm_level"]).replace("{{filters}}", filters)};
      common.executePgQuery(projectQuery, this); //Flow to next function when done.
    }
    else {
      //Invalid arguments
      //return message
      callback("Missing or invalid required arguments: guids"); //err is first argument
    }
  },
  function (err, results) {
    if (err) {
      this.callback(err);
      return;
    }
    var projects = this.projects = results.rows;
    for (var i = 0, len = projects.length; i < len; i++) {
      var proj = projects[i];
      var projId = proj.sf_id;
      var statusQuery = { text: operation.StatusQuery.replace("{{guid}}", operation.wrapIdsInQuotes(projId)) };
      common.executePgQuery(statusQuery, this.MULTI(projId));
    }
  },
  function (args) {
    for (var i = 0, len = this.projects.length; i < len; i++) {
      var proj = this.projects[i];
      var projId = proj.sf_id;
      for (var key in args) {
        if (key === projId) {
          var indicRes = args[key];
          // if there is an error for the status query
          if (indicRes[0] !== null) {
            this.callback(indicRes[0]);
          } else {
            // apply risks data to project
            proj.statuses = indicRes[1].rows;
            if (proj.statuses.length === 0) {
              proj.statuses = 'none';
            }
          }
          break;
        }
      }
    }
    var results = { rows: this.projects };

    this.callback(null, results);
  }
);

//Make sure arguments are tight before executing
operation.isInputValid = function (input) {
  //Test to see if inputs are specified
  var isValid = false;

  if (input) {
    //make sure we have a bbox.  Other args are optional
    if (input["guids"] && input["gadm_level"]) {
      //It's got everything we need.
      return true;
    }
  }

  return isValid;
};

operation.wrapIdsInQuotes = function (ids) {
  return ids.split(',').map(function (item) {
    return "'" + item + "'";
  });
};

module.exports = operation;