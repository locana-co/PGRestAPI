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

      //loop thru and call the DB
      self.csv_object.forEach(function(data, idx){
        if(data[self.column_names.indexOf('x')] && data[self.column_names.indexOf('y')]){
          //Take the X,Y in the row and get the pcode, add output to json object.

          operation.GetPCodeByXY(data[self.column_names.indexOf('x')], data[self.column_names.indexOf('y')], self.MULTI(idx));

        }
      });

    });

  },
  function(result) {
    //Result contains an object for each csvLoop above.
    //Go thru and add the pcodes to the csv object.
    var self = this;

    //Push the 3 new column names into the column_name list: pcode0, pcode1, pcode2
    self.column_names.push('pcode0', 'pcode1', 'pcode2');


    this.csv_object.forEach(function (row, i) {

      //Add new pcode items
      row.push(result[i + 1].pcode0);
      row.push(result[i + 1].pcode1);
      row.push(result[i + 1].pcode2);

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
