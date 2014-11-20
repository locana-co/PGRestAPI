//4.3.2014 - Ryan Whitley
var flow = require('flow');
var common = require("../../../common"),settings = require('../../../settings/settings'),shortid = require('shortid');

var operation = {};

/* METADATA */
operation.name = "GetIdsByExtent";
operation.description = "Smartly gets GADM IDs associated with Red Cross disasters or projects based on a map viewport (extent).";
operation.inputs = {};

operation.inputs["bbox"] = { value: "", required: true, help: "SW coordiantes, NE coordinates, in lat/lng (4326).  minx, miny, maxx, maxy - example: -127.76000976562501,43.476840397778915,-113.060302734375,49.30363576187125" }; //

operation.outputImage = false;


operation.execute = flow.define(
    function (args, callback) {
        this.args = args;
        this.callback = callback;
        //Step 1

        //Generate UniqueID for this GP Task
        operation.id = shortid.generate();


        //assign parameters to object.
        operation.inputs["bbox"].value = args.bbox;

        //See if inputs are set. Incoming arguments should contain the same properties as the input parameters.
        if (operation.isInputValid(operation.inputs) === true) {
            //Convert bbox to WKT
            args.wkt = operation.convertBBoxToWKT(args.bbox);

            //Execute the query
            var query = {
                text: "select * from udf_getidsbyextent(" + (args.gadm_level || "null") + ", '" + args.wkt + "');",
                values: []
            };
            common.executePgQuery(query, this);//Flow to next function when done.
        }
        else {
            //Invalid arguments
            //return message
            callback({text: "Missing or invalid required arguments: bbox"}, null); //err is first argument
        }
    },
    function (err, results) {
        //Step 2 - get the results and pass back to calling function
        this.callback(err, results);
    }
);


//Make sure arguments are tight before executing
operation.isInputValid = function(input) {

    //make sure we have a bbox.  Other args are optional
    if (input["bbox"].value && input["bbox"].value.split(",").length == 4) {
        //It's got everything we need.
        return true;
    }else{
        return false;
    }

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


operation.convertBBoxToWKT = function(bbox){
   var bboxcoords = bbox.split(',');
   var corners = { minx: bboxcoords[0], miny: bboxcoords[1], maxx: bboxcoords[2], maxy: bboxcoords[3]};
   return "POLYGON((minx miny, minx maxy, maxx maxy, maxx miny, minx miny))".split('minx').join(corners.minx).split('miny').join(corners.miny).split('maxx').join(corners.maxx).split('maxy').join(corners.maxy);
};

module.exports = operation;
