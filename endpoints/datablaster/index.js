//Datablaster should load a .js mapping file and be mapped to a table or specific type of data.
//for example, a table with district names and various numeric and tabular values would be mapped to different output static JSON structures.
///now.  How to do this?
//Start by defining which tables will be available in which formats.


//////////DataBlaster

//Express, Common and settings should be used by all sub-modules
var express = require('express'),
    common = require("../../common"),
    settings = require('../../settings/settings');

//custom requires
var querystring = require('querystring'),
    flow = require('flow'),
    fs = require("fs"),
    blastConfig = require('./blast_config'),
    http = require("http");


//End module specific requires
exports.app = function(passport) {
	var app = express();

	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');

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


//blaster route
app.all("/services/blaster", function(req, res) {
	batchBlast(function (err, blastCount) {
		//Finished blasting.
		//say so.
		res.end("Done blasting. Finished " + blastCount + " blast(s).");
	});
});

//Kick off the process for a particular table
function blast (tablename, mapper, callback) {
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
    executeRESTRequest(tablename, postArgs, function (err, result) {
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

//Batch blast based on blast_config file.
var batchBlast = flow.define(

    function (pageCallback) {
        this.rootRelativePath = "."; //TODO - make this more dynamic.  It's how we'll know how to find the 'root' + public/foo to write the output files.
        this.pageCallback = pageCallback;

        if (blastConfig && blastConfig.sources && blastConfig.sources.length > 0) {
            //First - check to see if JSON output folder exists - use the same folder for all.
            console.log("checking for folder: " + this.rootRelativePath + settings.application.jsonOutputFolder);
            fs.exists(this.rootRelativePath + settings.application.jsonOutputFolder, this);
        }
        else {
            //What to do?
            pageCallback({error: "No blast configuration or configuration sources."}, 0);
        }
    },
    function (exists) {
        //Coming from flow - check if geojson output folder exists
        if (exists === false) {
            //make it
            console.log("Didn't find it.  Tyring to make folder: " + this.rootRelativePath + settings.application.jsonOutputFolder);
            fs.mkdirSync(this.rootRelativePath + settings.application.jsonOutputFolder); //Synch
        }

        //Keep  track of counts
        var receiveCount = 0;

        //copy for internal
        var pageCallback = this.pageCallback;
        var indexArray = [];//Keep a list of all of the json files being created.


        //Loop thru sources and blast.
        blastConfig.sources.forEach(function (source, idx) {
            //Execute call - use setTimeout to avoid too many simultaneous blasts.
            setTimeout(function () {
                executeRESTRequest(source.options.tablename, source.options.postArgs, function (err, result) {
                    //done with request.

                    //handle err.  If no error, proceed
                    if (err) {
                        source.options.callback(err, null);
                        return;
                    }

                    //if Transform exists, then do it.
                    console.log("transforming.");

                    //transform data
                    //Pass in data, the transformer and the callback
                    transformData(result, source.options.transformer, function (err, transformed_data) {
                        //After data is transformed, write it out to files.
                        //For now, 1 file per response.
                        var fileType = source.options.fileType || ".js"; //Use .js if no fileType is specified.

                        var jsonOutFile = source.options.name + '.' + fileType;
                        fs.writeFile("." + settings.application.jsonOutputFolder + "/" + jsonOutFile, JSON.stringify(transformed_data), function (err) {
                            if (err) {
                                console.log(err.message);
                            }
                            else {
                                indexArray.push(jsonOutFile); //TODO:  get the filename as the output of 
                                console.log("blasted JSON file.");
                            }

                            receiveCount++;
                            console.log("Processed blast: Count " + receiveCount);

                            if (receiveCount == blastConfig.sources.length) {
                                //We've got all of the responses.
                                console.log("Done with all " + blastConfig.sources.length + " blast(s). Writing index.js.");

                                //Write Index.js file
                                fs.writeFile("." + settings.application.jsonOutputFolder + "/index.js", "var _blasterindex = " + JSON.stringify(indexArray) + ";", function (err) {
                                    if (err) {
                                        console.log(err.message);
                                    }
                                    else {
                                        console.log("blasted index.js file.");
                                    }

                                    //pass back err, even if null
                                    //callback(err, geoJsonOutFile, settings.application.jsonOutputFolder + "/" + geoJsonOutFile);
                                });

                                pageCallback(err, receiveCount);
                            }

                            //pass back err, even if null
                            //callback(err, geoJsonOutFile, settings.application.jsonOutputFolder + "/" + geoJsonOutFile);
                        });
                    }); //source.options.callback

                    //TODO:  Need to track when a single blast is complete.  What if there's an error?  How long to wait?
                    //Need to be notified when complete.
                })
            }, 1000 * idx); //TODO: play around with the timing here.  Now it's 1 second delay for each item in the loop.
        })
    }
);

//Take the transformer and the data and get to work
function transformData (data, transformer, callback) {
    //Take the data, apply the transform, if one exists
    var transformed;

    if (transformer) {
        transformed = transformer(data);
    }
    else {
        transformed = data;
    }
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



//Query table's rest endpoint
function executeRESTRequest(table, postargs, callback) {
        //Grab JSON from our own rest service for this table.

        var post_data = querystring.stringify(postargs);
        console.log("Post Data: " + post_data);

        var options = {
            host: "localhost", //TODO - make this point to the environment variable to get the right IP
            path: "/services/tables/" + table + "/query",
            port: settings.application.port || 3000,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                //'Content-Type': 'application/json',
                'Content-Length': post_data.length
            }
        };


        var post_req = http.request(options, function (res) {
            var str = [];

            //res.setEncoding('utf8');  
            res.on('data', function (chunk) {
                str.push(chunk);
                //console.log(chunk.toString());
            });

            //the whole response has been recieved, so we just print it out here
            res.on('end', function () {
                console.log("ended API response");
                console.log("str length: " + str.length);
                callback(null, JSON.parse(str.join("")));
            });
        });

        post_req.write(post_data);
        post_req.end();
    }

	return app;
}
