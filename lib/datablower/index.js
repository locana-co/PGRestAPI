//Datablower should load a .js mapping file and be mapped to a table or specific type of data.
//for example, a table with district names and various numeric and tabular values would be mapped to different output static JSON structures.
///now.  How to do this?
//Start by defining which tables will be available in which formats.


//////////CodeBlower

//Express, Common and settings should be used by all sub-modules
var express = require('express'),
    common = require("../../common"),
    settings = require('../../settings');

//custom requires


var app = exports.app = express();


//Let's start with an actual case I'm dealing with.

//The vw_fertilizer_query view contains values by district.
//Blower should aggregate the values by district, then offer it in the way(s) I need it on the client.
//So:  
//1. define the view to operate on
//2. define the post params?
//3. define the column on which to slice by (in this case, by district).
//4. specify if we want separate files, or a single .js file with multiple objects
//5. handle/transform return objects into JSON that we actually want
//6. write file(s)
//7.  create index.js file to be downloaded by the client that will inform the client how to get what they want.
//8. enjoy

//Kick off the process for a particular table
exports.blow = function (tablename, mapper, callback) {
    //For now, keep hardcoded
    tablename = "tanzania_distritcs";
    var postArgs = {
        format: "GeoJSON",
        where: "1=1", //instead of passing in a particular where clause, use the break fields to loop thru all possibilities.
        groupby: 'adm2_name',
        statsdef: "avg:population", //probably specify, but maybe could get numeric types and have user just specify if they want averages or sums, etc.
        returnGeometry: "no"
    };
    var break_column = "district, crop"; //select distinct district and crop from the table.  Loop thru every combo and write out all possiblities.
    var output_options = { singleFile: true };

    //Execute call
    common.executeSelfRESTRequest(tablename, postArgs, function (err, result) {
        //done
        console.log("transforming.");
        //handle err.  If no error, proceed

        //transform data
        //Pass in data, the transformer and the callback
        transformData(result, function (input) {
            //the transform
            //Take the input and do something
            //for this GeoJSON object, make an array of values that only start with M

            var outArray = [];
            //Loop features in GeoJSON object
            input.features.forEach(function (item) {
                if (item.properties.adm2_name.toLowerCase().indexOf("m") == 0) {
                    outArray.push({ name: item.properties.adm2_name, value: item.properties.avg_population });
                }
            });

            return outArray;

        }, function (err, transformed_result) {
            console.log("Finished the transform.");
            //Write file
            //handle err


            //Done
            callback(err, transformed_result);
        });


    });
}

//Take the transformer and the data and get to work
transformData = function (data, transformer, callback) {
    //Take the data, apply the transform
    var transformed = transformer(data);
    //handle err here
    var err = null;
    callback(err, transformed);
}

//A particular endpoint may need multiple queries to get data in different slices
exports.sendQuery = function () {

}


//Write out the JSON file to the disk
exports.writeOutput = function () {

}

