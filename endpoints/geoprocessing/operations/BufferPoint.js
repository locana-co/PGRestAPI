//8.31.2013 - Ryan Whitley
//Starting a Plug and Play GP Workflow
var flow = require('flow');
var pg = require('pg');

//Takes in a POINT (X Y) and returns a WKT representation of the buffer.
//Arguments are:
//1. The POINT
//2. Buffer Radius

var Buffer = {};

/* METADATA */

Buffer.name = "Buffer";
Buffer.description = "Buffers a point and returns the geometry as WKT.";
Buffer.inputs = {};

Buffer.inputs["input_geometry"] = { wkt: "", srid: ""};
Buffer.inputs["buffer_distance"] = { value: 0, units: ""}; //how far and what units?


//Since we don't want to be writing functions, use this anonymous code block in postgres.
Buffer.bufferQuery = "DO $$DECLARE " + 
"orig_srid int; " +
"utm_srid int; " +
"input geometry := ST_GeomFromText('{wkt}', 4326); " +
"geomgeog geometry; " +
"zone int; " +
"pref int; " +
"BEGIN " +
"geomgeog:= ST_Transform(input,4326); " +
"IF (ST_Y(geomgeog))>0 THEN " +
"pref:=32600; " +
"ELSE " +
"pref:=32700; " +
"END IF; " +
"zone:=floor((ST_X(geomgeog)+180)/6)+1; " +
"orig_srid:= ST_SRID(input); " +
"utm_srid:= zone+pref; " +
"drop table if exists _temp; " +
"create temporary table _temp as " +
"SELECT ST_AsGeoJSON(ST_transform(ST_Buffer(ST_transform(input, utm_srid), 2000), orig_srid)) as geom; " +
"END$$; " +
"select * from _temp;"



Buffer.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;
        //Step 1
        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (Buffer.isInputValid(args) === true) {
            Buffer.inputs["input_geometry"] = args.input_geometry;
            Buffer.inputs["buffer_distance"] = args.buffer_distance;

            //Take the point and buffer it in PostGIS
            var query = { text: "", values: []};
            Buffer.executePgQuery(Buffer.bufferQuery.replace("{wkt}", Buffer.inputs["input_geometry"]), this);//Flow to next function when done.

        }
        else {
            //Invalid arguments
            //return message
            callback({ status: "Missing arguments", rows: []});
        }
    },
    function (results) {
        //Step 2 - get the results and pass back to calling function
        this.callback(results);
    }
)

//Make sure arguments are tight before executing
Buffer.isInputValid = function (input) {
    //Test to see if inputs are specified
    var isValid = false;

    if (input) {
        if (input["input_geometry"] && input["buffer_distance"]) {
            //It's got everything we need.
            return true;
        }
    }

    return isValid;
}


Buffer.executePgQuery = function(query, callback) {
    var result = { status: "success", rows: [] }; //object to store results, and whether or not we encountered an error.

    //Just run the query
    //Setup Connection to PG
    var client = new pg.Client(global.conString); //global.conString stores the default connection string to postgres.  Change it if you want to connect to a different DB.
    client.connect();

    var query = client.query(query);

    //If query was successful, this is iterating thru result rows.
    query.on('row', function (row) {
        result.rows.push(row);
    });

    //Handle query error - fires before end event
    query.on('error', function (error) {
        //req.params.errorMessage = error;
        result.status = "error";
        result.message = error;
    });

    //end is called whether successfull or if error was called.
    query.on('end', function () {
        //End PG connection
        client.end();
        callback(result); //pass back result to calling function
    });
}


module.exports = Buffer;