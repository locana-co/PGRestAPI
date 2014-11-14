//8.31.2013 - Ryan Whitley
//9.17.2014 - Nicholas Hallahan <nhallahan@spatialdev.com>

//Starting a Plug and Play GP Workflow
var flow = require('flow');
var pg = require('pg');
var common = require("../../../common");
var csv = require('ya-csv');



var operation = {};


/* METADATA */

operation.name = "UploadCSVToPCode";
operation.description = "Takes an input .csv file, iterates over it, finds pcodes, then returns the csv fields as JSON, including the pcodes. Accepts POST only.";
operation.inputs = {};

operation.latFieldStrings = ["lat", "latitude", "y", "ycenter"];
operation.longFieldStrings = ["lon", "long", "longitude", "x", "xcenter", "lng"];
operation.pCodeFieldStrings = ["pcode", "pcodes", "p-code", "p-codes"];


operation.inputs["csvupload"] = { value: "", required: true, help: "a csv containing an x and y column used to fetch pcodes.  Use HTML <input type='file' /> to POST to this." };

operation.execute = flow.define(
  function(args, callback) {

    this.args = args;
    this.callback = callback;
    var self = this;

    if(!args.files){
      //no file attachments.  Exit.
      this.callback({text: "No file attached."}, { rows: []});
      return;
    }

    var reader = csv.createCsvFileReader(args.files.csvupload.path, {
      'separator': ',',
      'quote': '"',
      'escape': '"',
      'comment': ''
    });

    self.column_names = [];
    self.output = { rows: [] }; //output json object

    var x = 0; //Keep track of how many rows we read.  1st row will be column names.

    self.csv_object = []; //hold the data as it's being read

    //Iterates over each row, which is data
    reader.addListener('data', function(data) {
      //first time thru, grab column names.
      if(x == 0){
         self.column_names = data;
      }
      else{
        if(data[0]){
          self.csv_object.push(data);
        }
      }
      x++;
    });




    reader.addListener('end', function() {
      //When the CSV has been parsed.

      //Now that we have column names, see if we have required incoming names
      self.matchedColumns = findLatLngPcodeFields(self.column_names);

      //loop thru and call the DB
      self.csv_object.forEach(function(data, idx){

        //Lat/Long?
        if(data[self.column_names.indexOf(self.matchedColumns.latField)] && data[self.column_names.indexOf(self.matchedColumns.longField)]){
          //Take the X,Y in the row and get the pcode, add output to json object.
          var xcoord = data[self.column_names.indexOf(self.matchedColumns.longField)];
          var ycoord = data[self.column_names.indexOf(self.matchedColumns.latField)];

          var xyString = xcoord.toString() + ":" + ycoord.toString();
          operation.GetPCodeByXY(xcoord, ycoord, self.MULTI(xyString)); //Pass in X:Y string so we can fetch the results later.
          self.lookupType = "xy";
        }
        else if (data[self.column_names.indexOf(self.matchedColumns.pCodeField)]){
          //If we find a pcode column on the way in, then don't use x,y.
          //Instead, look up the geom by pcode.
          var pcode = data[self.column_names.indexOf(self.matchedColumns.pCodeField)];
          operation.GetGeomByPCode(pcode, self.MULTI(pcode));
          self.lookupType = "pcode";
        }
        else{
          //Didn't find all of the columns we're looking for.
          //Skip
          //Do Nothing
        }
      });

    });

  },
  function(result) {
    //Result contains an object for each csvLoop above.
    //Go thru and add the pcodes to the csv object.
    var self = this;


    if(self.lookupType == "xy"){

      //Push the 3 new column names into the column_name list: pcode0, pcode1, pcode2
      self.column_names.push('pcode0', 'pcode1', 'pcode2');

      this.csv_object.forEach(function (row, i) {

        //GeoJSON contians commas and double quotes.
        //In order to include in an output CSV, need to double-quote the column and escape the double quotes with an extra quote

        var xcoord = row[self.column_names.indexOf(self.matchedColumns.longField)];
        var ycoord = row[self.column_names.indexOf(self.matchedColumns.latField)];

        var record = result[xcoord.toString() + ":" + ycoord.toString()];

        //Add new pcode items
        if(record && record.pcode0){
          row.push(record.pcode0);
        }else{
          row.push("");
        }

        if(record && record.pcode1){
          row.push(record.pcode1);
        }else{
          row.push("");
        }

        if(record && record.pcode2){
          row.push(record.pcode2);
        }else{
          row.push("");
        }


        if (self.args.format == "csv") {
          //Add row to output rows list
          self.output.rows.push(row);
        }
        else {
          var jsonRow = {};
          //Other format.  Use json formatting with property hashes.
          self.column_names.forEach(function (column, idx) {
            //Go thru each column, and add the property name + value
            jsonRow[column] = row[idx];
          });

          //Add row to output rows list
          self.output.rows.push(jsonRow);
        }
      });

      if (self.args.format == "csv") {
        //Prepend the column names to the rows object of this.output (column headers)
        this.output.rows.unshift(this.column_names);
      }

    }
    else if(self.lookupType == "pcode"){

      //Push the 3 new column names into the column_name list: geometry, centroid
      self.column_names.push('geometry', 'centroid');

      this.csv_object.forEach(function (row, i) {

        //GeoJSON contians commas and double quotes.
        //In order to include in an output CSV, need to double-quote the column and escape the double quotes with an extra quote
        var record = result[row[self.column_names.indexOf(self.matchedColumns.pCodeField)]];


        if (self.args.format == "csv") {

          //Add new pcode items - with quoted geom columns and escaped double quotes for CSV
          if(record && record.geom){
            row.push('"' + record.geom.split('"').join('""') + '"');
          }
          else{
            row.push("");
          }
          if(record && record.geom_centroid) {
            row.push('"' + record.geom_centroid.split('"').join('""') + '"');
          }
          else{
            row.push("");
          }

          //Add row to output rows list
          self.output.rows.push(row);
        }
        else {
          //Add new pcode items - not escaped
          if(record && record.geom){
            row.push(record.geom);
          }
          else{
            row.push("");
          }
          if(record && record.geom_centroid) {
            row.push(record.geom_centroid);
          }
          else{
            row.push("");
          }


          var jsonRow = {};
          //Other format.  Use json formatting with property hashes.
          self.column_names.forEach(function (column, idx) {
            //Go thru each column, and add the property name + value
            jsonRow[column] = row[idx];
          });

          //Add row to output rows list
          self.output.rows.push(jsonRow);
        }
      });

      if (self.args.format == "csv") {
        //Prepend the column names to the rows object of this.output (column headers)
        this.output.rows.unshift(this.column_names);
      }
    }

    this();

  },
  function(){
    //Once they're all done, do this.
    this.callback(null, this.output);
  }
);

//Given a lat/lng in 4326, get the pcode
operation.GetPCodeByXY = function(x,y, callback){

  var query = "select name0,guid0,pcode0,name1,guid1,pcode1,name2,guid2,pcode2,name3,guid3,pcode3 from gadmrollup where ST_Intersects(ST_GeomFromText('POINT({{x}} {{y}})', 4326), geom3);";
  var sql = { text: query.replace("{{x}}", x).replace("{{y}}", y), values: []};

  common.executePgQuery(sql, function(err, result){
    var stack = {};

    //Get the result and iterate over the results, adding the correct pcode as an output
    if(result){
      if(result.rows){
         result.rows.forEach(function(item, idx){
           //There should only be 1 item in rows array
           stack = item;
         })
      }
    }

    //Callback with either nothing, or the result row
    callback(stack);

  });
};

//Given a pcode, get the Geom and/or centroid as GeoJSON
operation.GetGeomByPCode = function(pcode, callback){

  var query0, query1, query2, query3;

  query3 = "select DISTINCT ON (pcode{{level}}) 3 as level, name{{level}} as name,guid{{level}} as guid, pcode{{level}} as pcode {{geometry}} from gadmrollup where pcode{{level}} = {{list}}".split("{{level}}").join("3");
  query2 = "UNION ALL select DISTINCT ON (pcode{{level}}) 2 as level, name{{level}},guid{{level}},pcode{{level}} {{geometry}} from gadmrollup where pcode{{level}} = {{list}}".split("{{level}}").join("2");
  query1 = "UNION ALL select DISTINCT ON (pcode{{level}}) 1 as level, name{{level}},guid{{level}},pcode{{level}} {{geometry}} from gadmrollup where pcode{{level}} = {{list}}".split("{{level}}").join("1");
  query0 = "UNION ALL select DISTINCT ON (pcode{{level}}) 0 as level, name{{level}},guid{{level}},pcode{{level}} {{geometry}} from gadmrollup where pcode{{level}} = {{list}};".split("{{level}}").join("0");

  //Geometry, replace the geometry placeholder with the geometry columns.
  query3 = query3.split('{{geometry}}').join(', ST_AsGeoJSON(geom{{level}}) as geom, ST_AsGeoJSON(ST_Centroid(geom{{level}})) as geom_centroid').split("{{level}}").join("3");
  query2 = query2.split('{{geometry}}').join(', ST_AsGeoJSON(geom{{level}}) as geom, ST_AsGeoJSON(ST_Centroid(geom{{level}})) as geom_centroid').split("{{level}}").join("2");
  query1 = query1.split('{{geometry}}').join(', ST_AsGeoJSON(geom{{level}}) as geom, ST_AsGeoJSON(ST_Centroid(geom{{level}})) as geom_centroid').split("{{level}}").join("1");
  query0 = query0.split('{{geometry}}').join(', ST_AsGeoJSON(geom{{level}}) as geom, ST_AsGeoJSON(ST_Centroid(geom{{level}})) as geom_centroid').split("{{level}}").join("0");

  var query = [query3, query2, query1, query0].join(" ");

  var sql = { text: query.split("{{list}}").join("'" + pcode + "'"), values: []};

  common.executePgQuery(sql, function(err, result){
    var stack = {};

    //Get the result and iterate over the results, adding the correct geometries as an output
    if(result){
      if(result.rows){
        result.rows.forEach(function(item, idx){
          //There should only be 1 item in rows array
          stack = item;
        })
      }
    }

    //Callback with either nothing, or the result row
    callback(stack);

  });
};

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


//Pass in an array of column names from the CSV.
//Sniff for X, Y and/or PCode column names.
function findLatLngPcodeFields(fieldNames){

  var latField, longField, pCodeField;

  fieldNames.forEach(function (fieldName) {
    var matchId;
    matchId = operation.latFieldStrings.indexOf(fieldName.toLowerCase());
    if (matchId !== -1) {
      latField = fieldName;
    }

    matchId = operation.longFieldStrings.indexOf(fieldName.toLowerCase());
    if (matchId !== -1) {
      longField = fieldName;
    }

    matchId = operation.pCodeFieldStrings.indexOf(fieldName.toLowerCase());
    if (matchId !== -1) {
      pCodeField = fieldName;
    }
  });

  return { latField: latField, longField: longField, pCodeField: pCodeField };
}

module.exports = operation;
