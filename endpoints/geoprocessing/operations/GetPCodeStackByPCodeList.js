//8.31.2013 - Ryan Whitley
//9.17.2014 - Nicholas Hallahan <nhallahan@spatialdev.com>

//Plug and Play GP Workflow
var flow = require('flow');
var pg = require('pg');
var common = require("../../../common");
var _ = require("underscore");

var operation = {};


/* METADATA */

operation.name = "GetPCodeStackByPCodeList";
operation.description = "Takes a p-code list in the form code1,code2,code3,code4 and returns a JSON object with corresponding GADM boundaries.";
operation.inputs = {};


operation.inputs["list"] = { value: "", required: true, help: "p-code list code1,code2,code3,code4" };
operation.inputs["subDistricts"] = { value: "", required: false, default_value: false,  help: "boolean - return full stack?" };
operation.inputs["geometryType"] = { value: "", required: false, default_value: 'polygon', help: "point or polygon"};

operation.execute = flow.define(
  function(args, callback) {

    this.args = args;
    this.callback = callback;
    //Step 1

    var list = operation.inputs["list"].value = args.list;
    var subDistricts = operation.inputs["subDistricts"].value = (args.subDistricts || operation.inputs["subDistricts"].default_value);
    var geometryType = operation.inputs["geometryType"].value = (args.geometryType || operation.inputs["geometryType"].default_value);



    //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
    if (operation.isInputValid(operation.inputs) === true) {

      //Determine the admin level based on the pcode(s)
      //First, Split the incoming list and trim each item.
      var pcodeList = list.split(",").map(function(item){
        return item.trim();
      });

      var pCodeAdminObject = {};

      //Now loop and see what admin levels we're dealing with
      pcodeList.forEach(function(item){

        //See how many characters we have.
        //if length > 3, assume we're not at a level 0, which has either 2 or 3 characters
        if(item){
          if(item.length > 3){
            //Start stripping values off of the end of the string 3 at a time (sub regions below level 0 are 3 digit codes.
            var adminLevel = snipPCodes(item).length - 1;
            pCodeAdminObject[item] = { level: adminLevel };

          }else if(item.length == 2 || item.length == 3){
            //Assume a Level 0
            pCodeAdminObject[item] = { level: 0}
          }
        }

      });

      //The SQL Query to be executed;


      for (var key in pCodeAdminObject){
        if (pCodeAdminObject.hasOwnProperty(key)) {

          var query;
          var level = pCodeAdminObject[key].level;

          if(subDistricts == false){
            query = "select DISTINCT ON (pcode{{level}}) name{{level}},guid{{level}},pcode{{level}} {{geometry}} from gadmrollup where pcode{{level}} = {{list}};";

            if(geometryType == 'polygon'){
              //Geometry, replace the geometry placeholder with the geometry columns.
              query = query.replace('{{geometry}}', ', ST_AsGeoJSON(geom{{level}}) as geom{{level}}');
              //List the expected geom columns that come back from this query, so the formatters know which geoms to convert to GeoJSON
              operation.geom_columns = ['geom' + level]; //List the expected geom columns that come back from this query, so the formatters know which geoms to convert to GeoJSON

            }else{
              //Return the centroid (point) geometry
              //Geometry, replace the geometry placeholder with the geometry columns.
              query = query.replace('{{geometry}}', ', ST_AsGeoJSON(ST_Centroid(geom{{level}})) as geom{{level}}_centroid');
              //List the expected geom columns that come back from this query, so the formatters know which geoms to convert to GeoJSON
              operation.geom_columns = ['geom' + level + '_centroid']; //List the expected geom columns that come back from this query, so the formatters know which geoms to convert to GeoJSON
            }

            query = query.split("{{level}}").join(level);

          }
          else{
            query = "select name0,guid0,pcode0,name1,guid1,pcode1,name2,guid2,pcode2,name3,guid3,pcode3,name4,guid4,pcode4,name5,guid5,pcode5 {{geometry}} from gadmrollup where pcode{{level}} = {{list}};";

            if(geometryType == 'polygon'){
              //Geometry, replace the geometry placeholder with the geometry columns.
              query = query.replace('{{geometry}}', ', ST_AsGeoJSON(geom0) as geom0,ST_AsGeoJSON(geom1) as geom1,ST_AsGeoJSON(geom2) as geom2,ST_AsGeoJSON(geom3) as geom3,ST_AsGeoJSON(geom4) as geom4,ST_AsGeoJSON(geom5) as geom5');
              //List the expected geom columns that come back from this query, so the formatters know which geoms to convert to GeoJSON
              operation.geom_columns = ['geom0', 'geom1', 'geom2', 'geom3', 'geom4', 'geom5']; //List the expected geom columns that come back from this query, so the formatters know which geoms to convert to GeoJSON

            }else{
              //Return the centroid (point) geometry
              //Geometry, replace the geometry placeholder with the geometry columns.
              query = query.replace('{{geometry}}', ', ST_AsGeoJSON(ST_Centroid(geom0)) as geom0_centroid,ST_AsGeoJSON(ST_Centroid(geom1)) as geom1_centroid,ST_AsGeoJSON(ST_Centroid(geom2)) as geom2_centroid,ST_AsGeoJSON(ST_Centroid(geom3)) as geom3_centroid,ST_AsGeoJSON(ST_Centroid(geom4)) as geom4_centroid,ST_AsGeoJSON(ST_Centroid(geom5)) as geom5_centroid');
              //List the expected geom columns that come back from this query, so the formatters know which geoms to convert to GeoJSON
              operation.geom_columns = ['geom0_centroid', 'geom1_centroid', 'geom2_centroid', 'geom3_centroid', 'geom4_centroid', 'geom5_centroid']; //List the expected geom columns that come back from this query, so the formatters know which geoms to convert to GeoJSON
            }

            query = query.split("{{level}}").join(level);

          }

          //Wrap incoming pcodes with single quotes for the SQL IN clause
          var sql = { text: query.split("{{list}}").join("'" + key + "'"), values: []};

          common.executePgQuery(sql, this.MULTI(key));//Flow to next function when ALL are done.
        }
      }




    }
    else {
      //Invalid arguments
      //return message
      callback({text: "Missing required arguments: list of pcodes"});
    }
  },
  function(results) {
    //Step 2 - get the results and pass back to calling function
    var mergedResults = {rows: []};

    results.forEach(function(result){
      mergedResults.rows = mergedResults.rows.concat(result[1].rows);
    });

    this.callback(null, mergedResults);
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

//Take in a string, chop off the last 3 characters.
//Return the chopped portion of the string, plus the leftovers.
function snipPCodes(input){
  var endCode = input.substr(input.length - 3, 3);
  var leftover = input.substr(0, input.length - 3);

  var output = [{ code: endCode, remainder: leftover }];

  if(leftover.length > 3){
    output = output.concat(snipPCodes(leftover));
  }
  else{
    //This is the end (level 0) add it.
    output.push({ code: leftover, leftover: ""});
  }

  return output;
}

module.exports = operation;
