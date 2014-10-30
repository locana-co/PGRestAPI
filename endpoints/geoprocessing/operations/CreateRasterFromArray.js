//11.26.2013 - Ryan Whitley
var flow = require('flow');
var pg = require('pg'),
        common = require("../../../common"),
        settings = require('../../../settings');

//Takes in a multidimensional array, or at least an array of strings.
//Arguments are:
//1. height of raster
//2. width of raster
//3. cell size?
//4. the list of values. //[9, 9], [9, 9]
//upper left xcoord
//upper left ycoord
//SRID

var operation = {};

/* METADATA */

operation.name = "ArrayToRasterToPolygon";
operation.description = "Creates an raster from number array, then exports a polygon of the raster's nonzero values.";
operation.inputs = {};

operation.outputImage = false;

operation.inputs["height"] = { value: "", required: true, help: "Height of raster in units of projection" };
operation.inputs["width"] = { value: "", required: true, help: "Width of raster in units of projection" };
operation.inputs["cell_size"] = { value: "", required: true, help: "what is the cell size?" };
operation.inputs["values"] = { value: "", required: true, help: "multidimensional array of values" };
operation.inputs["upper_left_x"] = { value: "", required: true, help: "Top left x coordinate for raster" };
operation.inputs["upper_left_y"] = { value: "", required: true, help: "Top left y coordinate for raster" };
operation.inputs["srid"] = { value: "", required: true, help: "Spatial Reference ID - 4326", default_value: 4326 };


//The bit of SQL that will do the work. Set it up here, and execute it down below
operation.Query = "DO $$DECLARE " +
"orig_srid int; " +
"BEGIN " +
"drop table if exists _tempraster; " + //TODO - make this unique
"CREATE TABLE _tempraster (id integer, rast raster); " +
"INSERT INTO _tempraster(id,rast) VALUES(1, ST_MakeEmptyRaster({width}, {height}, {upper_left_x}, {upper_left_y}, {cellsize}, -{cellsize}, 0, 0, {srid}) );  " + //
"UPDATE _tempraster SET rast = ST_AddBand(rast,'32BF'::text,0) WHERE id = 1; " +
"UPDATE _tempraster SET rast = ST_SetValues(rast, 1, 1, 1, ARRAY{values}::double precision[][], 0.0, false) WHERE id = 1; " +
"END$$; " +
"SELECT val, ST_AsText(ST_Simplify(ST_Transform(geom, 4326), .001)) as wkt, ST_AsGeoJSON(ST_Simplify(ST_Transform(geom, 4326), .001)) as geom FROM (SELECT (ST_DumpAsPolygons(rast)).* from _tempraster) as a where val = 1"
//any geometry that you want to get out should be wrapped in the ST_AsGeoJSON function


operation.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;

        operation.inputs["height"].value = args.height;
        operation.inputs["width"].value = args.width;
        operation.inputs["cell_size"].value = args.cell_size;
        operation.inputs["values"].value = args.values;
        operation.inputs["upper_left_x"].value = args.upper_left_x;
        operation.inputs["upper_left_y"].value = args.upper_left_y;
        operation.inputs["srid"].value = args.srid;

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(operation.inputs) === true) {
            //Take the point and buffer it in PostGIS
            var query = {
                text: operation.Query.replace("{width}", operation.inputs["width"].value).split("{cellsize}").join(operation.inputs["cell_size"].value).replace("{srid}", operation.inputs["srid"].value).replace("{height}", operation.inputs["height"].value).replace("{upper_left_x}", operation.inputs["upper_left_x"].value).replace("{upper_left_y}", operation.inputs["upper_left_y"].value).replace("{values}", operation.inputs["values"].value),
                values: []
            };
            common.executePgQuery(query, this);//Flow to next function when done.

        }
        else {
            //Invalid arguments
            //return message
            callback({text: "Missing required arguments"}); //err is first argument
        }
    },
    function (err, results) {
        //Step 2 - get the results and pass back to calling function
        this.callback(err, results);
    }
)

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