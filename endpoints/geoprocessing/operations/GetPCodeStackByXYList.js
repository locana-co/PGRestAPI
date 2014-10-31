//8.31.2013 - Ryan Whitley
//9.17.2014 - Nicholas Hallahan <nhallahan@spatialdev.com>

//Starting a Plug and Play GP Workflow
var flow = require('flow');
var pg = require('pg');
var common = require("../../../common");

//Takes in a POINT (X Y) List and returns JSON object containing the intersected boundaries along with pcodes if applicable.
//Arguments are:
//1. X (Longitude)
//2. Y (Latitude)


var operation = {};


/* METADATA */

operation.name = "GetPCodeStackByXYList";
operation.description = "Takes an X,Y coordinate list in the form X Y,X Y,X Y,X Y,X Y, returns JSON object with intersected GADM boundaries with any pcodes that are available. Example coords: -11.648737 8.280284,-12.077204 9.539293,-10.637995 8.236794";
operation.inputs = {};


operation.inputs["coords"] = { value: "", required: true, help: "coordinate list X Y,X Y,X Y,X Y,X Y, decimal degrees" };
operation.inputs["returnGeometry"] = { value: "", required: false, default_value: false, help: "true or false"}; //default value = false

operation.execute = flow.define(
  function(args, callback) {

    //The query to be executed

    //This contains Geom, but doesn't output in the HTML correctly.
    //var query = "select name0,guid0,ST_AsGeoJSON(geom0) as geom0,pcode0,name1,guid1,ST_AsGeoJSON(geom1) as geom1,pcode1,name2,guid2,ST_AsGeoJSON(geom2) as geom2,pcode2,name3,guid3,ST_AsGeoJSON(geom3) as geom3,pcode3,name4,guid4,ST_AsGeoJSON(geom4) as geom4,pcode4,name5,guid5,ST_AsGeoJSON(geom5) as geom5,pcode5  from gadmrollup where ST_Intersects(ST_GeomFromText('POINT({{x}} {{y}})', 4326), geom3);";
    var query = "select name0,guid0,pcode0,name1,guid1,pcode1,name2,guid2,pcode2,name3,guid3,pcode3,name4,guid4,pcode4,name5,guid5,pcode5 {{geometry}} from gadmrollup where ST_Intersects(ST_GeomFromText('MULTIPOINT({{coords}})', 4326), geom3);";


    this.args = args;
    this.callback = callback;
    //Step 1

    var coords = operation.inputs["coords"].value = args.coords;
    var returnGeometry = operation.inputs["returnGeometry"].value = (args.returnGeometry == 'true');

    //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
    if (operation.isInputValid(operation.inputs) === true) {

      if(returnGeometry == true){
        //Geometry, replace the geometry placeholder with the geometry columns.
        query = query.replace('{{geometry}}', ', ST_AsGeoJSON(geom0) as geom0,ST_AsGeoJSON(geom1) as geom1,ST_AsGeoJSON(geom2) as geom2,ST_AsGeoJSON(geom3) as geom3,ST_AsGeoJSON(geom4) as geom4,ST_AsGeoJSON(geom5) as geom5')
        //List the expected geom columns that come back from this query, so the formatters know which geoms to convert to GeoJSON
        operation.geom_columns = ['geom0', 'geom1', 'geom2', 'geom3', 'geom4', 'geom5']; //List the expected geom columns that come back from this query, so the formatters know which geoms to convert to GeoJSON
      }else{
         //no geometry.  Replace the placeholder with empty string
        query = query.replace('{{geometry}}', '');
        operation.geom_columns = [];
      }

      var sql = { text: query.replace("{{coords}}", coords), values: []};

      common.executePgQuery(sql, this);//Flow to next function when done.

    }
    else {
      //Invalid arguments
      //return message
      callback({text: "Missing required arguments: x, y"});
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
