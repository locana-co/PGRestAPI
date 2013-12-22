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

operation.inputs["height"] = {};
operation.inputs["width"] = {};
operation.inputs["cell_size"] = [];
operation.inputs["values"] = [];
operation.inputs["upper_left_x"] = [];
operation.inputs["upper_left_y"] = [];
operation.inputs["srid"] = [];




//This will execute just for Land Use and buffers - ~ 18 seconds for all points in bangladesh
operation.Query = "DO $$DECLARE " +
"orig_srid int; " +
"BEGIN " +
"drop table if exists _tempraster; " + //TODO - make this unique
"CREATE TABLE _tempraster (id integer, rast raster); " +
"INSERT INTO _tempraster(id,rast) VALUES(1, ST_MakeEmptyRaster({width}, {height}, {upper_left_x}, {upper_left_y}, {cellsize}, -{cellsize}, 0, 0, {srid}) );  " + //
"UPDATE _tempraster SET rast = ST_AddBand(rast,'32BF'::text,0) WHERE id = 1; " +
"UPDATE _tempraster SET rast = ST_SetValues(rast, 1, 1, 1, ARRAY{values}::double precision[][], 0.0, false) WHERE id = 1; " +
"END$$; " +
"SELECT val, ST_AsText(ST_Transform(geom, 4326)) as wkt FROM (SELECT (ST_DumpAsPolygons(rast)).* from _tempraster) as a where val = 1"



operation.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;
        //Step 1
        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(args) === true) {
            operation.inputs["height"] = args.height;
            operation.inputs["width"] = args.width;
            operation.inputs["cell_size"] = args.cell_size;
            operation.inputs["values"] = args.values;
            operation.inputs["upper_left_x"] = args.upper_left_x;
            operation.inputs["upper_left_y"] = args.upper_left_y;
            operation.inputs["srid"] = args.srid;

            //Take the point and buffer it in PostGIS
            var query = { text: operation.Query.replace("{width}", operation.inputs["width"]).split("{cellsize}").join(operation.inputs["cell_size"]).replace("{srid}", operation.inputs["srid"]).replace("{height}", operation.inputs["height"]).replace("{upper_left_x}", operation.inputs["upper_left_x"]).replace("{upper_left_y}", operation.inputs["upper_left_y"]).replace("{values}", operation.inputs["values"]), values: [] };
            common.executePgQuery(query, this);//Flow to next function when done.

        }
        else {
            //Invalid arguments
            //return message
            callback({ status: "Missing required arguments", rows: [] });
        }
    },
    function (results) {
        //Step 2 - get the results and pass back to calling function
        this.callback(results);
    }
)

//Make sure arguments are tight before executing
operation.isInputValid = function (input) {
    //Test to see if inputs are specified
    var isValid = false;

    if (input) {
        //make sure we have a where clause, buffer disatance and the country code is found in the country object.
        if (input["height"] && input["width"] && input["srid"] && input["cell_size"] && input["values"] && input["upper_left_x"] && input["upper_left_y"]) {
            //It's got everything we need.
            return true;
        }
    }

    return isValid;
}

module.exports = operation;