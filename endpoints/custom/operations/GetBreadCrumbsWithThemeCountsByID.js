//4.3.2014 - Ryan Whitley
var flow = require('flow');
var common = require("../../../common"),settings = require('../../../settings'),shortid = require('shortid');
var operation = {};

/* METADATA */
operation.name = "GetBreadCrumbsWithThemeCountsByID";
operation.description = "Gets full stack for breadcrumbs (including theme counts at each level) based on GADM ID and level.";
operation.inputs = {};

operation.outputImage = false;

operation.inputs["ids"] = {}; //comma separated list of ids
operation.inputs["theme"] = {}; //string - theme name
operation.inputs["gadm_level"] = {}; //string - gadm_level (0 -5)

//operation.Query = "SELECT sum(count{{gadm_level}}) as project_count, guid{{gadm_level}} as guid, ST_ASGeoJSON(geom{{gadm_level}}) as geom FROM sf_aggregated_gadm_{{theme}}_counts WHERE guid{{gadm_level}} IN ({{ids}}) GROUP BY guid{{gadm_level}}, geom{{gadm_level}}";

//SELECT guid2, name2, guid1, name1, guid0, name0, guidarc, namearc, guidarc FROM sf_gadm_guids WHERE guid2 IN ('ca4f7dd8-3023-4e18-b644-13449e14b4b3')

operation.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;
        //Step 1

        //Generate UniqueID for this Task
        operation.id = shortid.generate();

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(args) === true) {
            operation.inputs["ids"] = args.ids;
            operation.inputs["theme"] = args.theme.toLowerCase();
					  operation.inputs["gadm_level"] = args.gadm_level.toLowerCase();

            //need to wrap ids in single quotes
            //Execute the query
            var query;
						query = { text: operation.BuildSQLQuery(operation.inputs["gadm_level"]).split("{{ids}}").join(operation.wrapIdsInQuotes(args.ids)) };
            common.executePgQuery(query, this);//Flow to next function when done.
        }
        else {
            //Invalid arguments
            //return message
            callback("Missing or invalid required arguments: theme or ids or gadm_level"); //err is first argument
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
        if (input["ids"] && input["theme"] && input["gadm_level"]) {
            //It's got everything we need.
            return true;
        }
    }

    return isValid;
}

operation.BuildSQLQuery = function(deepestLevel) {
	//given a level, build the select statement for columns related to that level as well as levels 'above' it.
	var sql = "SELECT ";
	var whereArray = [];
	for (var i = deepestLevel; i >= -1; i--) {
		//guid0, name0
		if (i == -1) {
			whereArray.push("guidarc");
			whereArray.push("namearc");
		}
		else {
			whereArray.push("guid" + i);
			whereArray.push("name" + i);
		}
	}

	sql += whereArray.join(", ") + " FROM sf_gadm_guids WHERE guid" + deepestLevel + " IN ({{ids}}) GROUP BY " + whereArray.join(", ");
	return sql;
}

operation.wrapIdsInQuotes = function(ids){
    return ids.split(',').map(function(item){
        return "'" + item + "'";
    });
}

module.exports = operation;