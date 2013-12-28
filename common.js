//common.js is a collection of commonly used functions by the main app.js and all submodules.
var pg = require('pg'),
    querystring = require('querystring'),
    http = require("http");

var common = {};
common.formatters = {};

common.respond = function (req, res, args, callback) {
    //Write out a response as JSON or HTML with the appropriate arguments.  Add more formats here if desired
    if (!args.format || args.format.toLowerCase() == "html") {
        //Determine sample request based on args
        res.render(args.view, args);
    }
    else if (args.format && (args.format.toLowerCase() == "json" || args.format.toLowerCase() == "geojson" || args.format.toLowerCase() == "esrijson" || args.format.toLowerCase() == "j")) {
        //Responsd with GeoJSON (or JSON if there is no geo)
        if (args.errorMessage) {
            res.jsonp({ error: args.errorMessage });
        }
        else {
            res.jsonp(args.featureCollection);
        }
    }
    else if(args.format && (args.format.toLowerCase() == "shapefile")){
    	//Requesting Shapefile Format.
    	//If there's an error, return a json
        if (args.errorMessage) {
            res.jsonp({ error: args.errorMessage });
        }
        else {
        	//Send back a shapefile
            res.download(args.file, function(){
                callback(args.file)
            });
        }
    }
    else {
        //If unrecognized format is specified
        if (args.errorMessage) {
            res.jsonp({ error: args.errorMessage });
        }
        else {
            res.jsonp(args.featureCollection);
        }
    }
}

common.executePgQuery = function (query, callback) {
    var result = { status: "success", rows: [] }; //object to store results, and whether or not we encountered an error.

    //Just run the query
    //Setup Connection to PG
    var client = new pg.Client(global.conString);
    client.connect();

    //Log the query to the console, for debugging
    common.log("Executing query: " + query.text + (query.values && query.values.length > 0 ?  ", " + query.values : ""));
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
        common.log("Error executing query: " + result.message);
    });

    //end is called whether successfull or if error was called.
    query.on('end', function () {
        //End PG connection
        client.end();
        callback(result); //pass back result to calling function
    });
}

//Utilities
common.log = function(message) {
    //Write to console
    console.log(message);
}

common.vacuumAnalyzeAll = function(){
	var query = { text: "VACUUM ANALYZE;", values: [] };
	common.executePgQuery(query, function (result) {
		console.log("Performed VACUUM ANALYZE on ALL;")
	});
}

//Determine if a string contains all numbers.
common.IsNumeric = function (sText) {
    var ValidChars = "0123456789";
    var IsNumber = true;
    var Char;
    
    sText.toString().replace(/\s+/g, '')

    for (i = 0; i < sText.length && IsNumber == true; i++) {
        Char = sText.charAt(i);
        if (ValidChars.indexOf(Char) == -1) {
            IsNumber = false;
        }
    }
    return IsNumber;
}


//Take in an array, spit out an array of escaped columns
common.escapePostGresColumns = function (items) {
    //wrap all strings in double quotes
    return items.map(function (item) {
        //remove all quotes then wrap with quotes, just to be sure
        return '"' + item.replace(/"/g, "") + '"';
    });
}

//Take in an array, spit out an array of unescaped columns
common.unEscapePostGresColumns = function (items) {
    //remove all double quotes from strings
    return items.map(function (item) {
        //remove all quotes
        return item.replace(/"/g, "");
    });
}

common.isValidSQL = function (item) {
    //if(!item || item.length == 0) return true;

    //var illegalChars = /[\<\>\;\\\/\"\'\[\]]/;

    //if (illegalChars.test(item)) {
    //    //String contains invalid characters
    //    log("invalid sql: " + item);
    //    return false;
    //} else {
    //    return true;
    //}
    return true;
    //TODO - add validation code.
}

////Take in results object, return GeoJSON (if there is geometry)
common.formatters.geoJSONFormatter = function (rows, geom_fields_array) {
    //Take in results object, return GeoJSON
    if (!geom_fields_array) geom_fields_array = ["geom"]; //default

    //Loop thru results
    var featureCollection = { "type": "FeatureCollection", "features": [] };

    rows.forEach(function (row) {

        var feature = { "type": "Feature", "properties": {} };
        //Depending on whether or not there is geometry properties, handle it.  If multiple geoms, use a GeometryCollection output for GeoJSON.

        if (geom_fields_array && geom_fields_array.length == 1) {
            //single geometry
            if (row[geom_fields_array[0]]) {
                feature.geometry = JSON.parse(row[geom_fields_array[0]]);
                //feature.geometry = row[geom_fields_array[0]];

                //remove the geometry property from the row object so we're just left with non-spatial properties
                delete row[geom_fields_array[0]];
            }
        }
        else if (geom_fields_array && geom_fields_array.length > 1) {
            //if more than 1 geom, make a geomcollection property
            feature.geometry = { "type": "GeometryCollection", "geometries": [] };
            geom_fields_array.forEach(function (item) {
                feature.geometry.geometries.push(row[item]);
                //remove the geometry property from the row object so we're just left with non-spatial properties
                delete row[item];
            });
        }

        feature.properties = row;
        featureCollection.features.push(feature);
    })

    return featureCollection;
}

common.formatters.ESRIFeatureSetJSONFormatter = function (rows, geom_fields_array) {
    //Take in results object, return ESRI Flavor of GeoJSON
    if (!geom_fields_array) geom_fields_array = ["geom"]; //default

    //Loop thru results
    var featureSet = { "features": [], "geometryType": "" };

    rows.forEach(function (row) {
        var feature = { "attributes": {} };
        //Depending on whether or not there is geometry properties, handle it.  
        //Multiple geometry featureclasses don't exist in ESRI-land.  How to handle?  For now, just take the 1st one we come across
        //TODO:  Make user choose what they want

        if (geom_fields_array) {
            //single geometry
            if (row[geom_fields_array[0]]) {
                //manipulate to conform
                if (row[geom_fields_array[0]].type == "Polygon") featureSet.geometryType = "esriGeometryPolygon";
                else if (row[geom_fields_array[0]].type == "Point") featureSet.geometryType = "esriGeometryPoint";
                else if (row[geom_fields_array[0]].type == "Line") featureSet.geometryType = "esriGeometryLine";
                else if (row[geom_fields_array[0]].type == "Polyline") featureSet.geometryType = "esriGeometryPolyline";
                else if (row[geom_fields_array[0]].type == "MultiPolygon") featureSet.geometryType = "esriGeometryPolygon";

                //TODO - add the rest
                //TODO - support all types below
                feature.geometry = {};

                var rowGeom = JSON.parse(row[geom_fields_array[0]]);
                if (featureSet.geometryType = "esriGeometryPolygon") {
                    feature.geometry.rings = rowGeom.coordinates;
                }
                else {
                    feature.geometry = rowGeom;
                }
                //remove the geometry property from the row object so we're just left with non-spatial properties
                delete row[geom_fields_array[0]];
            }
        }


        feature.attributes = row;
        featureSet.features.push(feature);
    })

    return featureSet;
}


common.executeSelfRESTRequest = function(table, path, postargs, callback, settings) {
    //Grab JSON from our own rest service for a table.
    var post_data = querystring.stringify(postargs);
    console.log("Post Data: " + post_data);

    var options = {
        host: settings.application.host,
        path: path.replace("{table}", table), 
        port: settings.application.port,
        method: 'POST', 
        headers: {  
            'Content-Type': 'application/x-www-form-urlencoded',  
            'Content-Length': post_data.length  
        }
    };


    var post_req = http.request(options, function (res) {
        var str = [];

        res.on('error', function (err) {
            console.log("problem");
        });

        //res.setEncoding('utf8');  
        res.on('data', function (chunk) {
            str.push(chunk);  
        });

        //the whole response has been recieved, so we just print it out here
        res.on('end', function () {
            console.log("ended API response");
            callback(null, JSON.parse(str));
        });
    }); 

    //execute
    post_req.write(post_data);
    post_req.end(); 
}

module.exports = common;
