//4.3.2014 - Ryan Whitley
var flow = require('flow');
var common = require("../../../common"),settings = require('../../../settings'),shortid = require('shortid');
var operation = {};

/* METADATA */
operation.name = "GetThemeFeaturesByID";
operation.description = "Gets theme-based features and properties based on GADM ID and level.";
operation.inputs = {};

operation.outputImage = false;

operation.inputs["ids"] = {}; //comma separated list of ids
operation.inputs["theme"] = {}; //string - theme name

//operation.Query = "SELECT ST_AsGeoJSON(geom) as geom, project_count, level FROM vw_theme_{{theme}}_gadm WHERE stack_guid IN ({{ids}})";

operation.Query = "with projects as ( \
SELECT gadm2.guid FROM gadm2, gadm0, vw_sf_all_projects \
WHERE gadm0.id_0 = gadm2.id_0 \
AND gadm2.guid = vw_sf_all_projects.stack_guid \
AND vw_sf_all_projects.level = '2' \
AND gadm0.guid::character varying IN ({{ids}}) \
UNION ALL \
SELECT gadm1.guid FROM gadm1, gadm0, vw_sf_all_projects \
WHERE gadm0.id_0 = gadm1.id_0 \
AND gadm1.guid = vw_sf_all_projects.stack_guid \
AND vw_sf_all_projects.level = '1' \
AND gadm0.guid::character varying IN ({{ids}}) \
UNION ALL \
SELECT gadm0.guid FROM gadm0, vw_sf_all_projects \
WHERE gadm0.guid = vw_sf_all_projects.stack_guid \
AND vw_sf_all_projects.level = '0' \
AND gadm0.guid::character varying IN ({{ids}}) \
) \
SELECT count(guid) as project_count, ST_ASGeoJson((SELECT geom_simplify_med from gadm0 where guid IN ({{ids}}))) as geom \
FROM projects \
GROUP by guid";

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

            //need to wrap ids in single quotes
            //Execute the query
            var query;
						query = { text: operation.Query.replace('{{theme}}', operation.inputs["theme"]).split("{{ids}}").join(operation.wrapIdsInQuotes(args.ids)) };
            common.executePgQuery(query, this);//Flow to next function when done.
        }
        else {
            //Invalid arguments
            //return message
            callback("Missing or invalid required arguments: theme or ids"); //err is first argument
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
        if (input["ids"] && input["theme"]) {
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