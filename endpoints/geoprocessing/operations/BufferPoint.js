//8.31.2013 - Ryan Whitley
//9.17.2014 - Nicholas Hallahan <nhallahan@spatialdev.com>

//Starting a Plug and Play GP Workflow
var flow = require('flow');
var pg = require('pg');
var common = require("../../../common");

//Takes in a POINT (X Y) and returns a WKT representation of the buffer.
//Arguments are:
//1. The POINT
//2. Buffer Radius

var Buffer = {};


/* METADATA */

Buffer.name = "Buffer";
Buffer.description = "Buffers a point and returns the geometry as WKT. `buffer_distance` is the radius of the buffer in meters. `input_format` can be either WKT or GeoJSON.";
Buffer.inputs = {};

Buffer.inputs["input_geometry"] = { wkt: "", srid: ""};
Buffer.inputs["buffer_distance"] = { value: 0, units: ""}; //how far and what units?
Buffer.inputs["input_format"] = '';


//Since we don't want to be writing functions, use this anonymous code block in postgres.
var wktBufferQuery = "DO $$DECLARE " +
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
  "SELECT ST_AsGeoJSON(ST_transform(ST_Buffer(ST_transform(input, utm_srid), {buffer_distance}), orig_srid)) as geom; " +
  "END$$; " +
  "select * from _temp;";


Buffer.execute = flow.define(
  function(args, callback) {
    this.args = args;
    this.callback = callback;
    //Step 1

    //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
    if (Buffer.isInputValid(args) === true) {
      var inputGeometry = Buffer.inputs["input_geometry"] = args.input_geometry;
      var bufferDistance = Buffer.inputs["buffer_distance"] = args.buffer_distance;
      var inputFormat = Buffer.inputs["input_format"] = args.input_format;

      //Take the point and buffer it in PostGIS

      if (inputFormat.toLowerCase() === 'wkt') {
        var sql = wktBufferQuery
          .replace("{wkt}", inputGeometry)
          .replace("{buffer_distance}", bufferDistance);
      }

      else if (inputFormat.toLowerCase() === 'geojson') {
        console.log('geojson');
      }

      common.executePgQuery(sql, this);//Flow to next function when done.

    }
    else {
      //Invalid arguments
      //return message
      callback({text: "Missing required arguments"}); //err is first argument
    }
  },
  function(err, results) {
    //Step 2 - get the results and pass back to calling function
    this.callback(err, results);
  }
);

//Make sure arguments are tight before executing
Buffer.isInputValid = function(input) {

  if (input) {
    if (input["input_geometry"] && input["buffer_distance"] &&
          input["input_format"] && (input["input_format"].toLowerCase() === 'wkt' || input["input_format"].toLowerCase() === 'geojson')) {
      //It's got everything we need.
      return true;
    }
  }

  return false;
};

module.exports = Buffer;
