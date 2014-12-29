//common.js is a collection of commonly used functions by the main app.js and all submodules.
var pg = require('pg'),
    querystring = require('querystring'),
    http = require("http"),
    settings = require("./settings/settings"),
    fs = require("fs"),
    shortid = require("shortid"),
    mercator = require('./utils/sphericalmercator.js'), // 3857
    geographic = require('./utils/geographic.js'), //4326
    parseXYZ = require('./utils/tile.js').parseXYZ;

var common = {};
common.formatters = {};

common.respond = function (req, res, args, callback) {

    // File name the respondant JSON will be if downloaded.
    var downloadFileName = args.name || args.table || 'download';

    // makes the json pretty if desired. (2 space indent)
    var indent = args.pretty ? 2 : null;

    //Show or hide different NAV elements based on whether the endpoint is installed or not

    //Write out a response as JSON or HTML with the appropriate arguments.  Add more formats here if desired
    if (!args.format || args.format.toLowerCase() == "html") {
        //calculate response time
        args.responseTime = new Date - req._startTime; //ms since start of request

        //Determine sample request based on args
        res.render(args.view, args);
    }
    else if (args.format && (args.format.toLowerCase() == "json" || args.format.toLowerCase() == "esrijson" || args.format.toLowerCase() == "j")) {
        //Respond with JSON
        if (args.errorMessage) {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ error: args.errorMessage }, null, indent));
        }
        else if(args.infoMessage) {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ error: args.infoMessage }, null, indent));
        }
        else {
            //Send back json file
            res.setHeader('Content-disposition', 'attachment; filename=' + downloadFileName + '.json');
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });

            res.end(JSON.stringify(args.featureCollection, null, indent));
            //Determine sample request based on args
            //res.render(args.view, args);
        }
    }
    else if (args.format && (args.format.toLowerCase() == "json" || args.format.toLowerCase() == "esrijson" || args.format.toLowerCase() == "j")) {
        //Respond with JSON
        if (args.errorMessage) {
            res.jsonp({ error: args.errorMessage });
        }
        else {
            //Send back json file
            //res.setHeader('Content-disposition', 'attachment; filename=' + args.table + '.json');
            //res.writeHead(200, {
            //    'Content-Type': 'application/json'
            //});
            //res.end(JSON.stringify(args.featureCollection));
            res.jsonp(args.featureCollection);

        }
    }
    else if (args.format.toLowerCase() == "geojson") {
        //Set initial header
        res.setHeader('Content-disposition', 'attachment; filename=' + downloadFileName + '.geojson');

        //Responsd with GeoJSON
        if (args.errorMessage) {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ error: args.errorMessage }, null, indent));
        }
        else {
            //Send back json file
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify(args.featureCollection, null, indent));
        }
    }
    else if (args.format && (args.format.toLowerCase() == "shapefile")) {
        //Requesting Shapefile Format.
        //If there's an error, return a json
        if (args.errorMessage) {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ error: args.errorMessage }, null, indent));
        }
        else {
            //Send back a shapefile
            res.download(args.file, function () {
                callback(args.file)
            });
        }
    }
    else if (args.format && (args.format.toLowerCase() == "csv")) {
        //Responsd with CSV
        //If there's an error, return a json
        if (args.errorMessage) {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ error: args.errorMessage }, null, indent));
        }
        else {
            var filename = downloadFileName + ".csv";
            //Send back a csv
            res.setHeader('Content-disposition', 'attachment; filename=' + filename);
            res.writeHead(200, {
                'Content-Type': 'text/csv'
            });
            res.end(args.featureCollection);
        }
    }
    else {
        //If unrecognized format is specified
        if (args.errorMessage) {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ error: args.errorMessage }, null, indent));
        }
        else {
            res.writeHead(200, {
                'Content-Type': 'application/json'
            });
            res.end(JSON.stringify(args.featureCollection, null, indent));
        }
    }

}


common.executePgQuery = function (query, callback) {
    //Just run the query
    //Setup Connection to PG
  if(settings.pg && settings.pg.database && settings.pg.server) {
    pg.connect(global.conString, function (err, client, done) {
      if (err) {
        //return an error
        callback(err);
        return;
      }

      //Log the query to the console, for debugging
      common.log("Executing query: " + query.text + (query.values && query.values.length > 0 ? ", " + query.values : ""));

      //execute query
      client.query(query, function (err, result) {
        done();

        //go to callback
        callback(err, result);
      });
    });
  }
  else{
     //no postgres.
    //return empty
    callback(null, { rows: []});
  }
};



//Find all PostGres tables with a geometry column.  Return the table names, geom column name(s) and SRID
common.findSpatialTables = function (app, callback) {
    var spatialTables = {};

    //Todo: separate views and tables with a property name, since mapnik can't render views (since no stats with analyze)
    //TODO: text : "select f_geometry_column, srid, f_table_name from geometry_columns where f_table_name NOT IN (select table_name from INFORMATION_SCHEMA.views WHERE table_schema = ANY (current_schemas(false))) and f_table_catalog = $1",
    //Add a property to deliniate tables vs. views.
    var query = {
        text: "select * from geometry_columns where f_table_catalog = $1",
        values: [settings.pg.database]
    };

    //TODO - add options to specify schema and database.  Right now it will read all
    this.executePgQuery(query, function (err, result) {
        if (err) {
            //Report error and exit.
            console.log("Error in reading spatial tables from DB.  Can't load dynamic tile endopints. Message is: " + err.text);
        } else {

            //Add to list of tables.
            result.rows.forEach(function (item) {
                var spTable = {
                    table: item.f_table_name,
                    geometry_column: item.f_geometry_column,
                    srid: item.srid,
                    type: item.type
                };

                spatialTables[item.f_table_name + "_" + item.f_geometry_column] = spTable;
                //Keep a copy in tables for later.
            });
        }

        //Set spatialTables in express app
        app.set('spatialTables', spatialTables);

        //return to sender
        callback(err, spatialTables);
    });
};

//Utilities
common.log = function (message) {
    //Write to console
    console.log(message);
}

common.vacuumAnalyzeAll = function () {
    var query = { text: "VACUUM ANALYZE;", values: [] };
    this.executePgQuery(query, function (err, result) {
        console.log("Performed VACUUM ANALYZE on ALL;")
    });
}

//Determine if a string contains all numbers.
common.IsNumeric = function (sText) {
    var ValidChars = "0123456789";
    var IsNumber = true;
    var Char;

    sText.toString().replace(/\s+/g, '')

    for (var i = 0; i < sText.length && IsNumber == true; i++) {
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

    if(!items) return "";

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
};

common.getArguments = function (req) {
    var args;

    //Grab POST or QueryString args depending on type
    if (req.method.toLowerCase() == "post") {
        //If a post, then arguments will be members of the this.req.body property
        args = req.body;
    } else if (req.method.toLowerCase() == "get") {
        //If request is a get, then args will be members of the this.req.query property
        args = req.query;
    }
    return args;
}

common.getProtocol = function(req){
  return ((req.secure ? "https:" : "http:") + "//");
}

common.roughSizeOfObject = function(object) {

    var objectList = [];
    var stack = [ object ];
    var bytes = 0;

    while ( stack.length ) {
        var value = stack.pop();

        if ( typeof value === 'boolean' ) {
            bytes += 4;
        }
        else if ( typeof value === 'string' ) {
            bytes += value.length * 2;
        }
        else if ( typeof value === 'number' ) {
            bytes += 8;
        }
        else if
            (
            typeof value === 'object'
            && objectList.indexOf( value ) === -1
            )
        {
            objectList.push( value );

            for( var i in value ) {
                stack.push( value[ i ] );
            }
        }
    }
    return bytes;
}


//Take a tile bounds (along with a z) and create a bounding box for PostGIS queries.
//Tile bounds coordinates, zlevel, xmin, xmax, ymin, ymax example: 8, 44, 48, 28, 30
common.convertTileBoundsToBBoxWKT = function (bbox) {
    var bboxcoords = bbox.split(',');
    var z = bboxcoords[0];
    var xmin = bboxcoords[1];
    var xmax = bboxcoords[2];
    var ymin = bboxcoords[3];
    var ymax = bboxcoords[4];

    var boundsObj = { z: z, xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax };
    var TopLeftTile = { z: z, y: ymin, x: xmin};
    var TopRightTile = { z: z, y: ymin, x: xmax};
    var BottomLeftTile = { z: z, y: ymax, x: xmin};
    var BottomRightTile = { z: z, y: ymax, x: xmax};

    //Get the upper left tile, upper right tile, lower left tile, lower right tile and convert to WGS84, then use the maxes and mins to create the bbox.
    var bboxTopLeft = mercator.xyz_to_envelope(parseInt(TopLeftTile.x), parseInt(TopLeftTile.y), parseInt(TopLeftTile.z), false, true);
    //var bboxTopRight = mercator.xyz_to_envelope(parseInt(TopRightTile.x), parseInt(TopRightTile.y), parseInt(TopRightTile.z), false, true);
    //var bboxBottomLeft = mercator.xyz_to_envelope(parseInt(BottomLeftTile.x), parseInt(BottomLeftTile.y), parseInt(BottomLeftTile.z), false, true);
    var bboxBottomRight = mercator.xyz_to_envelope(parseInt(BottomRightTile.x), parseInt(BottomRightTile.y), parseInt(BottomRightTile.z), false, true);

    //Had to reverse the indices here, they were backwards from what I thought they should be.
    var corners = { minx: bboxTopLeft[0], miny: bboxTopLeft[3], maxx: bboxBottomRight[2], maxy: bboxBottomRight[1]};
    return "POLYGON((minx miny, minx maxy, maxx maxy, maxx miny, minx miny))".split('minx').join(corners.minx).split('miny').join(corners.miny).split('maxx').join(corners.maxx).split('maxy').join(corners.maxy);
}


var getFilesRecursively = common.getFilesRecursively = function (dir, done) {
    var results = [];
    var fullPath;
    fs.readdir(dir, function (err, list) {
        if (err) return done(err);
        var pending = list.length;
        if (!pending) return done(null, results);
        list.forEach(function (file) {
            fullPath = dir + '/' + file;
            fs.stat(fullPath, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    getFilesRecursively(fullPath, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    results.push({file: file, fullpath: fullPath});
                    if (!--pending) done(null, results);
                }
            });
        });
    });
};


////Take in results object, return GeoJSON (if there is geometry)
common.formatters.geoJSONFormatter = function (rows, geom_fields_array, geom_extent_array) {
    //Take in results object, return GeoJSON
    if (!geom_fields_array || geom_fields_array.length == 0) {
        //See if the extent array is populated
        if (geom_extent_array && geom_extent_array.length > 0) {
            //If no geometry, but extent is defined, just swap out the geom field name for the extent field name
            geom_fields_array = geom_extent_array;
        } else {
            //Use a default if none else are present
            geom_fields_array = ["geom"];
        }
    }

    //Loop thru results
    var featureCollection = { "type": "FeatureCollection", "features": [] };

    rows.forEach(function (row) {

        var feature = { "type": "Feature", "properties": {} };
        //Depending on whether or not there are geometry properties, handle it.  If multiple geoms, use a GeometryCollection output for GeoJSON.

        if (geom_fields_array && geom_fields_array.length == 1) {
            //single geometry
            if (row[geom_fields_array[0]]) {
                feature.geometry = JSON.parse(row[geom_fields_array[0]]);

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

////Take in results object, return CSV (exclude geometry)
common.formatters.CSVFormatter = function (rows, geom_fields_array) {
    //Take in results object, return CSV
    if (!geom_fields_array) geom_fields_array = ["geom"]; //default

    //Loop thru results
    var csvArray = []; //at the end, csvArray will be joined and separated by commas to make the csv

    //Get column names
    if (rows && rows[0]) {
        Object.keys(rows[0]).forEach(function (column_name) {
            if (geom_fields_array.indexOf(column_name) == -1) csvArray.push(column_name + ","); //only add if not a geom column
        });

        //Add newline
        csvArray.push('\r\n');
    }


    rows.forEach(function (row) {
        //Depending on whether or not there is geometry properties, handle it.  If multiple geoms, use a GeometryCollection output for GeoJSON.

        for (var index in row) {
            if (geom_fields_array.indexOf(index) == -1)
                csvArray.push((row[index] || (row[index] == 0 ? row[index] : '')) + ",");
        }
        //Add newline
        csvArray.push('\r\n');
    })

    return csvArray.join("");
}


common.executeSelfRESTRequest = function (table, path, postargs, callback, settings) {
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
            callback(err, null);
            return;
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


//Pass in an object and write out a GeoJSON File
common.writeGeoJSONFile = function (geojson, name, callback) {

    //Write out a GeoJSON file to disk - remove all whitespace
    var geoJsonOutFile = name + '.json';
    var fullPath = "." + settings.application.geoJsonOutputFolder + geoJsonOutFile;
    fs.writeFile(fullPath, JSON.stringify(geojson).replace(/\s+/g, ''), function (err) {
        if (err) {
            console.log(err.message);
        }
        else {
            console.log("created GeoJSON file.");
        }

        //pass back err, even if null
        callback(err, geoJsonOutFile, fullPath);
    });

}

module.exports = common;
