//////////Nodetiles

//Common and settings should be used by all sub-modules
var express = require('express'), common = require("../../common"), settings = require('../../settings');

//Module-specific requires:
var mapnik = require('mapnik'), mercator = require('./utils/sphericalmercator.js'), // 3857
geographic = require('./utils/geographic.js'), //4326
mappool = require('./utils/pool.js'),
parseXYZ = require('./utils/tile.js').parseXYZ, path = require('path'), fs = require("fs"), flow = require('flow'), carto = require('carto');

var TMS_SCHEME = false;
var styleExtension = '.xml';

var TileStats = {
	times : []
};
var SingleTileStats = {
	times : []
};
var ShapeStats = {
	times : []
};
var ShapeSingleTileStats = {
	times : []
};

var shapefiles = []; //Store a list of Shapefiles stored in the Mapnik/data/shapefiles folder.

// register shapefile plugin
if (mapnik.register_default_input_plugins)
	mapnik.register_default_input_plugins();

//Use pooling to handle concurrent map requests
var maps = mappool.create_pool(10); //TODO: Determine the best value for this

var aquire = function(id,options,callback) {
    methods = {
        create: function(cb) {
                var obj = new mapnik.Map(options.width || 256, options.height || 256, mercator.proj4);
                obj.load(id, {strict: true},function(err,obj) {
                    if (options.bufferSize) {
                        obj.bufferSize = options.bufferSize;
                    }
                    cb(err,obj);
                });
            },
            destroy: function(obj) {
                delete obj;
            }
    };
    maps.acquire(id,methods,function(err,obj) {
      callback(err, obj);
    });
};

//Find all shapefiles in the ./endpoints/Mapnik/data/Shapefiles folder.
//Spin up a new endpoint for each one of those.
function getShapeFilePaths(shpLocation){
	var items = [];
	//Load mbtiles from mbtiles folder.
	require("fs").readdirSync(shpLocation).forEach(function(file) {
		var ext = path.extname(file);
		if (ext == ".shp") {
			items.push(file);
		}
	});
	
	return items;
}

exports.app = function(passport) {
	var app = express();
	
	var shpLocation = path.join(__dirname,"/data/shapefiles");
	
	//Find Shapefiles
	shapefiles = getShapeFilePaths(shpLocation);
	
	//Return json of found shapefiles - setting this to /services/shapefiles causes all requests to /services/shapefiles/name/dynamicMap to simply revert to this.
	//Probably has to do with the fact that endpoints below use this.app.use instead of this.app.all (which doesn't work for some reason')
	app.get('/shapefiles', function(req, res) {
		res.json({ shapefiles: shapefiles});
	});

	//Loop thru shapes and spin up new routes
	shapefiles.forEach(function(item){
		createShapefileTileRenderer(app, item.split('.')[0], shpLocation + "/" + item, 4326, null);
		createShapefileSingleTileRenderer(app, item.split('.')[0], shpLocation + "/" + item, 4326, null);
	});
	
	var sessionStart = new Date().toLocaleString();
	
	//Load tile rendering statistics
	app.get('/admin', function(req, res) {
		res.writeHead(200, {
			'Content-Type' : 'text/plain'
		});
		
		var resultString = "Active Session started at: " + sessionStart + "\n\n\n";
		
		//Get the average render time for each type
		if (TileStats.times.length > 0) {
			var totalTime = TileStats.times.reduce(function(previousValue, currentValue, index, array) {
				return previousValue + currentValue;
			});
			totalTime = totalTime / 1000;
			var averageTime = totalTime / TileStats.times.length;
			resultString += "Tiles (256px) - PostGIS: For this session, " + TileStats.times.length + " tiles were generated in " + totalTime + " seconds with an average time of " + averageTime + " seconds/tile.\n";
		}
		else{
			resultString += "Tiles (256px) - PostGIS: 0 tiles rendered.\n";
		}
		
		if (SingleTileStats.times.length > 0) {
			var totalTime = SingleTileStats.times.reduce(function(previousValue, currentValue, index, array) {
				return parseInt(previousValue) + parseInt(currentValue);
			});
			totalTime = totalTime / 1000;
			var averageTime = totalTime / SingleTileStats.times.length;
			resultString += "Tiles (BBox View) - PostGIS: For this session, " + SingleTileStats.times.length + " tiles were generated in " + totalTime + " seconds with an average time of " + averageTime + " seconds/tile.\n\n";
		}
		else{
			resultString += "Tiles (BBox View) - PostGIS: 0 tiles rendered.\n\n";
		}
		
		if (ShapeStats.times.length > 0) {
			var totalTime = ShapeStats.times.reduce(function(previousValue, currentValue, index, array) {
				return parseInt(previousValue) + parseInt(currentValue);
			});
			totalTime = totalTime / 1000;
			var averageTime = totalTime / ShapeStats.times.length;
			resultString += "Tiles (256px) - Shapefiles: For this session, " + ShapeStats.times.length + " tiles were generated in " + totalTime + " seconds with an average time of " + averageTime + " seconds/tile.\n";
		}
		else{
			resultString += "Tiles (256px) - Shapefiles: 0 tiles rendered.\n";
		}
		
		if (ShapeSingleTileStats.times.length > 0) {
			var totalTime = ShapeSingleTileStats.times.reduce(function(previousValue, currentValue, index, array) {
				return parseInt(previousValue) + parseInt(currentValue);
			});
			totalTime = totalTime / 1000;
			var averageTime = totalTime / ShapeSingleTileStats.times.length;
			resultString += "Tiles (BBox View) - Shapefiles: For this session, " + ShapeSingleTileStats.times.length + " tiles were generated in " + totalTime + " seconds with an average time of " + averageTime + " seconds/tile.\n";
		}
		else{
			resultString += "Tiles (BBox View) - Shapefiles: 0 tiles rendered.\n";
		}
		
		

		res.end(resultString);
	});
	


	return app;
};

exports.createCachedFolder = function(table) {
	var folder = './public/cached_nodetiles/' + table;
	//create a folder for this table in public/cached_nodetiles if it doesn't exist
	fs.exists(folder, function(exists) {
		if (exists === false) {
			//make it
			console.log("Didn't find cache folder.  Tyring to make folder: " + folder);
			fs.mkdir(folder, function() {
				console.log("Made " + folder);
			});
			//Synch
		}
	});
};

//Create a static renderer that will always use the default styling
//This only works for tables, not views (since Mapnik requires that VACUUM ANALYZE be run for stats on the table to be rendered)
exports.createPGTileRenderer = flow.define(function(app, table, geom_field, epsgSRID, cartoFile) {

	this.app = app;
	this.table = table;
	this.epsg = epsgSRID;

	var name;
	var stylepath = __dirname + '/cartocss/';
	var fullpath = "";

	//Set the path to the style file
	if (cartoFile) {
		//Passed in
		fullpath = stylepath + cartoFile;
	} else {
		//default
		fullpath = stylepath + table + styleExtension;
	}

	var flo = this;

	//See if there is a <tablename>.mss/xml file for this table.
	//See if file exists on disk.  If so, then use it, otherwise, render it and respond.
	fs.stat(fullpath, function(err, stat) {
		if (err) {
			//No file.  Use defaults.
			fullpath = stylepath + "style.xml";
			//Default
		}

		flo(fullpath);
		//flow to next function
	});
}, function(fullpath) {
	//Flow from after getting full path to Style file

	//Vacuum Analyze needs to be run on every table in the DB.
	//Also, data should be in 3857 SRID
	var postgis_settings = {
		'host' : settings.pg.server,
		'port' : settings.pg.port = '5432',
		'dbname' : settings.pg.database,
		'table' : this.table,
		'user' : settings.pg.username,
		'password' : settings.pg.password,
		'type' : 'postgis',
		'estimate_extent' : 'true'
	};

	var _self = this;
		

	//Create Route for this table
	this.app.use('/services/tables/' + _self.table + '/dynamicMap', function(req, res) {
		
		//Start Timer to measure response speed for tile requests.
		var startTime = Date.now();

		parseXYZ(req, TMS_SCHEME, function(err, params) {
			if (err) {
				res.writeHead(500, {
					'Content-Type' : 'text/plain'
				});
				res.end(err.message);
			} else {
				try {
					var xmlss = path.join(fullpath);
					aquire(xmlss, {bufferSize :64 }, function(err, map) {
						if (err) {
                        	maps.release(xmlss, map);
                        	res.writeHead(500, {
								'Content-Type' : 'text/plain'
							});
							res.end(err.message);
                        }
						//create map and layer
						//var map = new mapnik.Map(256, 256, mercator.proj4);
						var layer = new mapnik.Layer(_self.table, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
						//check to see if 3857.  If not, assume WGS84
						var postgis = new mapnik.Datasource(postgis_settings);
						var bbox = mercator.xyz_to_envelope(parseInt(params.x), parseInt(params.y), parseInt(params.z), false);
	
						layer.datasource = postgis;
						layer.styles = [_self.table, 'style'];
	
						map.add_layer(layer);

						console.log(map.toXML());
						// Debug settings

						map.extent = bbox;
						var im = new mapnik.Image(map.width, map.height);
						map.render(im, function(err, im) {
							maps.release(xmlss, map);
							if (err) {
								throw err;
							} else {
								var duration = Date.now() - startTime;
								TileStats.times.push(duration);
								res.writeHead(200, {
									'Content-Type' : 'image/png'
								});
								res.end(im.encodeSync('png'));
							}
						});
						//});
					});

				} catch (err) {
					res.writeHead(500, {
						'Content-Type' : 'text/plain'
					});
					res.end(err.message);
				}
			}
		});
	});
	

	console.log("Created dynamic service: " + '/services/tables/' + _self.table + '/dynamicMap');
});

//Create a renderer that will accept dynamic queries and styling and bring back a single image to fit the map's extent.
exports.createPGTileQueryRenderer = flow.define(function(app, table, geom_field, epsgSRID, cartoFile) {

	this.app = app;
	this.table = table;
	this.geom_field = geom_field;
	this.epsg = epsgSRID;

	var name;
	var stylepath = __dirname + '/cartocss/';
	var fullpath = "";

	//Set the path to the style file
	if (cartoFile) {
		//Passed in
		fullpath = stylepath + cartoFile;
	} else {
		//default
		fullpath = stylepath + table + styleExtension;
	}

	var flo = this;

	//See if there is a <tablename>.mml file for this table.
	//See if file exists on disk.  If so, then use it, otherwise, render it and respond.
	fs.stat(fullpath, function(err, stat) {
		if (err) {
			//No file.  Use defaults.
			fullpath = stylepath + "style" + styleExtension;
			; //Default
		}

		flo(fullpath);
		//flow to next function
	});
}, function(fullpath) {
	//Flow from after getting full path to Style file

	var _self = this;

	//Create Route for this table
	this.app.use('/services/tables/' + _self.table + '/dynamicQueryMap', function(req, res) {
		//Start Timer to measure response speed for tile requests.
		var startTime = Date.now();

		//Check for correct args
		//Needs: width (px), height (px), bbox (xmin, ymax, xmax, ymin), where, optional styling
		var args = {};

		//Grab POST or QueryString args depending on type
		if (req.method.toLowerCase() == "post") {
			//If a post, then arguments will be members of the this.req.body property
			args = req.body;
		} else if (req.method.toLowerCase() == "get") {
			//If request is a get, then args will be members of the this.req.query property
			args = req.query;
		}

		// check to see if args were provided
		if (JSON.stringify(args) != '{}') {
			//are all mandatory args provided?
			var missing = "Please provide";
			var missingArray = [];
			if (!args.width) {
				missingArray.push("width");
			}

			if (!args.height) {
				missingArray.push("height");
			}

			if (!args.bbox) {
				missingArray.push("bbox");
			}

			if (missingArray.length > 0) {
				missing += missingArray.join(", ");
				//respond with message.
				res.writeHead(500, {
					'Content-Type' : 'text/plain'
				});
				res.end(missing);
				return;
			}

			//If user passes in where clause, then build the query here and set it with the table property of postgis_settings
			if (args.where) {
				//Validate where - TODO
			}

			//Vacuum Analyze needs to be run on every table in the DB.
			//Also, data should be in 3857 SRID
			var postgis_settings = {
				'host' : settings.pg.server,
				'port' : settings.pg.port = '5432',
				'dbname' : settings.pg.database,
				'table' : (args.where ? "(SELECT " + _self.geom_field + " from " + _self.table + " WHERE " + args.where + ") as " + _self.table : _self.table),
				'user' : settings.pg.username,
				'password' : settings.pg.password,
				'type' : 'postgis',
				'estimate_extent' : 'true'
			};

			//We're all good. Make the picture.
			try {
					var xmlss = path.join(fullpath);
					aquire(xmlss, { width: parseInt(args.width), height: parseInt(args.height), bufferSize :64 }, function(err, map) {
						if (err) {
                        	maps.release(xmlss, map);
                        	res.writeHead(500, {
								'Content-Type' : 'text/plain'
							});
							res.end(err.message);
                        }
                        
						//width, height
						var layer = new mapnik.Layer(_self.table, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
						//check to see if 3857.  If not, assume WGS84
						var postgis = new mapnik.Datasource(postgis_settings);
		
						var floatbbox = args.bbox.split(",");
		
						var bbox = [floatbbox[0], floatbbox[1], floatbbox[2], floatbbox[3]];
						//ll lat, ll lon, ur lat, ur lon
		
						layer.datasource = postgis;
						layer.styles = [_self.table, 'style'];
	
						console.log(map.toXML());
						// Debug settings

						map.add_layer(layer);
	
						map.extent = bbox;
						var im = new mapnik.Image(map.width, map.height);
						map.render(im, function(err, im) {
							maps.release(xmlss, map);
							if (err) {
								throw err;
							} else {
								var duration = Date.now() - startTime;
								SingleTileStats.times.push(duration);
								res.writeHead(200, {
									'Content-Type' : 'image/png'
								});
								res.end(im.encodeSync('png'));
							}
						});
                });
				
			} catch (err) {
				res.writeHead(500, {
					'Content-Type' : 'text/plain'
				});
				res.end(err.message);
			}

		} else {
			//if no args, pass to regular tile renderer
				res.writeHead(500, {
					'Content-Type' : 'text/plain'
				});
				res.end("Need to supply height, width and bbox arguments.");
		}
	});

	console.log("Created dynamic query service: " + '/services/tables/' + _self.table + '/dynamicQueryMap');
});

//Create a renderer that will accept dynamic GeoJSON Objects and styling and bring back a single image to fit the map's extent.
exports.createGeoJSONQueryRenderer = flow.define(function(app, geoJSON, epsgSRID, cartoFile, id, callback) {

	this.app = app;
	this.geoJSON = geoJSON;
	//this.geom_field = geom_field;
	this.epsg = epsgSRID;

	var _self = this;
	var dynamicURL = '/services/GeoJSONQueryMap/' + id;

	//Create Route for this table - TODO:  Figure out how/when to kill this endpoint
	this.app.use(dynamicURL, function(req, res) {

		//Check for correct args
		//Needs: width (px), height (px), bbox (xmin, ymax, xmax, ymin), where, optional styling
		var args = {};

		//Grab POST or QueryString args depending on type
		if (req.method.toLowerCase() == "post") {
			//If a post, then arguments will be members of the this.req.body property
			args = req.body;
		} else if (req.method.toLowerCase() == "get") {
			//If request is a get, then args will be members of the this.req.query property
			args = req.query;
		}

		// check to see if args were provided
		if (JSON.stringify(args) != '{}') {
			//are all mandatory args provided?
			var missing = "Please provide";
			var missingArray = [];
			if (!args.width) {
				missingArray.push("width");
			}

			if (!args.height) {
				missingArray.push("height");
			}

			if (!args.bbox) {
				missingArray.push("bbox");
			}

			if (missingArray.length > 0) {
				missing += missingArray.join(", ");
				//respond with message.
				res.writeHead(500, {
					'Content-Type' : 'text/plain'
				});
				res.end(missing);
				return;
			}

			//If user passes in geojson
			if (args.geojson) {
				//Validate where - TODO
			}

			//make a temporary geojson file for mapnik (until I figure out how to pass in an object)
			common.writeGeoJSONFile(geoJSON, id, function(err, filename, fullpath) {

				if (err) {
					//TODO: Handle this.
					return;
				}

				if (fullpath) {

					var geojson_settings = {
						type : 'geojson',
						file : fullpath
					};

					//We're all good. Make the picture.
					try {
						//create map and layer
						var map = new mapnik.Map(parseInt(args.width), parseInt(args.height), mercator.proj4);
						//width, height
						var layer = new mapnik.Layer(id, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
						//check to see if 3857.  If not, assume WGS84
						var geojson_ds = new mapnik.Datasource(geojson_settings);

						var floatbbox = args.bbox.split(",");

						var bbox = [floatbbox[0], floatbbox[1], floatbbox[2], floatbbox[3]];
						//ll lat, ll lon, ur lat, ur lon

						layer.datasource = geojson_ds;
						layer.styles = [id, 'style'];

						map.bufferSize = 64;

						var stylepath = __dirname + '/cartocss/style.xml';

						map.load(path.join(stylepath), {
							strict : true
						}, function(err, map) {

							console.log(map.toXML());
							// Debug settings

							if (err)
								throw err;
							map.add_layer(layer);

							map.extent = bbox;
							var im = new mapnik.Image(map.width, map.height);
							map.render(im, function(err, im) {

								if (err) {
									throw err;
								} else {
									res.writeHead(200, {
										'Content-Type' : 'image/png'
									});
									res.end(im.encodeSync('png'));
								}
							});
						});
					} catch (err) {
						res.writeHead(500, {
							'Content-Type' : 'text/plain'
						});
						res.end(err.message);
					}
				}

			});

		} else {
			//if no args, pass to regular tile renderer
				res.writeHead(500, {
					'Content-Type' : 'text/plain'
				});
				res.end("Need to supply height, width and bbox arguments.");
		}
	});

	console.log("Created dynamic query service: " + dynamicURL);
	callback({
		imageURL : dynamicURL
	});
});

//Create a renderer that will accept dynamic GeoJSON Objects and styling and bring back a single image to fit the map's extent.
exports.createImageFromGeoJSON = flow.define(function(geoJSON, bbox, epsgSRID, cartoFile, callback) {

	this.geoJSON = geoJSON;
	//this.geom_field = geom_field;
	this.epsg = epsgSRID;

	var _self = this;

	//Check for correct args
	//Needs: geojson, bbox (xmin, ymax, xmax, ymin)
	var args = {
		width : 500,
		height : 500
	};

	//make a temporary geojson file for mapnik (until I figure out how to pass in an object)
	common.writeGeoJSONFile(geoJSON, "geojson", function(err, filename, fullpath) {

		if (err) {
			//TODO: Handle this.
			return;
		}

		if (fullpath) {

			var geojson_settings = {
				type : 'geojson',
				file : fullpath
			};

			//We're all good. Make the picture.
			try {
				//create map and layer
				var map = new mapnik.Map(parseInt(args.width), parseInt(args.height), geographic.proj4);
				//width, height
				var layer = new mapnik.Layer("geojson", ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
				//check to see if 3857.  If not, assume WGS84
				var geojson_ds = new mapnik.Datasource(geojson_settings);

				var bboxArray = [bbox.xmin, bbox.ymax, bbox.xmax, bbox.ymin];

				layer.datasource = geojson_ds;
				layer.styles = ["geojson", 'style'];

				map.bufferSize = 64;

				var stylepath = __dirname + '/cartocss/style.xml';

				map.load(path.join(stylepath), {
					strict : true
				}, function(err, map) {

					console.log(map.toXML());
					// Debug settings

					if (err)
						throw err;
					map.add_layer(layer);

					map.extent = bboxArray;
					var im = new mapnik.Image(map.width, map.height);
					map.render(im, callback);
				});
			} catch (err) {
				callback(err, null);
			}
		}

	});
});

//This should take in a geoJSON object and create a new route on the fly - return the URL?
exports.createDynamicGeoJSONEndpoint = function(geoJSON, name, epsgSRID, cartoCssFile) {
	//var map = new nodetiles.Map();

	//map.assetsPath = path.join(__dirname, "cartocss"); //This is the cartoCSS path

	////Adding a static GeoJSON file
	//map.addData(new DynamicGeoJsonSource({
	//	name: "world", //same name used in cartoCSS class (#world)
	//	geoJSONObject: geoJSON,
	//	projection: "EPSG:" + epsgSRID
	//}));

	//map.addStyle(fs.readFileSync(__dirname + '/cartocss/' + cartoCssFile, 'utf8'));

	//app.use('/services/nodetiles/' + name + '/tiles', nodetiles.route.tilePng({ map: map })); // tile.png
	//console.log("Created dynamic service: " + '/services/nodetiles/' + name + '/tiles');
};


//Create a static renderer that will always use the default styling
var createShapefileTileRenderer = exports.createShapefileTileRenderer = flow.define(function(app, table, path_to_shp, epsgSRID, cartoFile) {
	

	this.app = app;
	this.table = table;
	this.epsg = epsgSRID;
	this.path_to_shp = path_to_shp;

	var name;
	var stylepath = __dirname + '/cartocss/';
	var fullpath = "";

	//Set the path to the style file
	if (cartoFile) {
		//Passed in
		fullpath = stylepath + cartoFile;
	} else {
		//default
		fullpath = stylepath + table + styleExtension;
	}

	var flo = this;

	//See if there is a <tablename>.mss/xml file for this table.
	//See if file exists on disk.  If so, then use it, otherwise, render it and respond.
	fs.stat(fullpath, function(err, stat) {
		if (err) {
			//No file.  Use defaults.
			fullpath = stylepath + "style.xml";
			//Default
		}

		flo(fullpath);
		//flow to next function
	});
}, function(fullpath) {
	//Flow from after getting full path to Style file

	var _self = this;

	//Create Route for this table
	this.app.use('/services/shapefiles/' + _self.table + '/dynamicMap', function(req, res) {
		//Start Timer to measure response speed for tile requests.
		var startTime = Date.now();

		parseXYZ(req, TMS_SCHEME, function(err, params) { debugger;
			if (err) {
				res.writeHead(500, {
					'Content-Type' : 'text/plain'
				});
				res.end(err.message);
			} else {
				try {
					var xmlss = path.join(fullpath);
					aquire(xmlss, { bufferSize :64 }, function(err, map) {
						if (err) {
                        	maps.release(xmlss, map);
                        	res.writeHead(500, {
								'Content-Type' : 'text/plain'
							});
							res.end(err.message);
                        }

						var layer = new mapnik.Layer(_self.table, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
						//check to see if 3857.  If not, assume WGS84
						var shapefile = new mapnik.Datasource({
							type : 'shape',
							file : _self.path_to_shp
						});
						var bbox = mercator.xyz_to_envelope(parseInt(params.x), parseInt(params.y), parseInt(params.z), false);
	
						layer.datasource = shapefile;
						layer.styles = [_self.table, 'style']; debugger;

						map.add_layer(layer);

						console.log(map.toXML());
						// Debug settings

						map.extent = bbox;
						var im = new mapnik.Image(map.width, map.height);
						map.render(im, function(err, im) {
							if (err) {
								throw err;
							} else {
								var duration = Date.now() - startTime;
								ShapeStats.times.push(duration);
								res.writeHead(200, {
									'Content-Type' : 'image/png'
								});
								res.end(im.encodeSync('png'));
							}
						});
						
				});
					
				} catch (err) {
					res.writeHead(500, {
						'Content-Type' : 'text/plain'
					});
					res.end(err.message);
				}
			}
		});
	});

	console.log("Created dynamic shapefile service: " + '/services/shapefiles/' + _self.table + '/dynamicMap');
});

//Create a renderer that will  bring back a single image to fit the map's extent.
var createShapefileSingleTileRenderer = exports.createShapefileSingleTileRenderer = flow.define(function(app, table, path_to_shp, epsgSRID, cartoFile) {

	this.app = app;
	this.table = table;
	this.path_to_shp = path_to_shp;
	this.epsg = epsgSRID;

	var name;
	var stylepath = __dirname + '/cartocss/';
	var fullpath = "";

	//Set the path to the style file
	if (cartoFile) {
		//Passed in
		fullpath = stylepath + cartoFile;
	} else {
		//default
		fullpath = stylepath + table + styleExtension;
	}

	var flo = this;

	//See if there is a <tablename>.mml file for this table.
	//See if file exists on disk.  If so, then use it, otherwise, render it and respond.
	fs.stat(fullpath, function(err, stat) {
		if (err) {
			//No file.  Use defaults.
			fullpath = stylepath + "style" + styleExtension;
			; //Default
		}

		flo(fullpath);
		//flow to next function
	});
}, function(fullpath) {
	//Flow from after getting full path to Style file

	var _self = this;

	//Create Route for this table
	this.app.use('/services/shapefiles/' + _self.table + '/dynamicQueryMap', function(req, res) {
		//Start Timer to measure response speed for tile requests.
		var startTime = Date.now();

		//Check for correct args
		//Needs: width (px), height (px), bbox (xmin, ymax, xmax, ymin), where, optional styling
		var args = {};

		//Grab POST or QueryString args depending on type
		if (req.method.toLowerCase() == "post") {
			//If a post, then arguments will be members of the this.req.body property
			args = req.body;
		} else if (req.method.toLowerCase() == "get") {
			//If request is a get, then args will be members of the this.req.query property
			args = req.query;
		}

		// check to see if args were provided
		if (JSON.stringify(args) != '{}') {
			//are all mandatory args provided?
			var missing = "Please provide";
			var missingArray = [];
			if (!args.width) {
				missingArray.push("width");
			}

			if (!args.height) {
				missingArray.push("height");
			}

			if (!args.bbox) {
				missingArray.push("bbox");
			}

			if (missingArray.length > 0) {
				missing += missingArray.join(", ");
				//respond with message.
				res.writeHead(500, {
					'Content-Type' : 'text/plain'
				});
				res.end(missing);
				return;
			}

			//If user passes in where clause, then build the query here and set it with the table property of postgis_settings
			if (args.where) {
				//Validate where - TODO
			}

			//We're all good. Make the picture.
			try {
					var xmlss = path.join(fullpath);
					aquire(xmlss, { width: parseInt(args.width), height: parseInt(args.height), bufferSize :64 }, function(err, map) {
						if (err) {
                        	maps.release(xmlss, map);
                        	res.writeHead(500, {
								'Content-Type' : 'text/plain'
							});
							res.end(err.message);
                        }
                        
						//width, height
						var layer = new mapnik.Layer(_self.table, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
						//check to see if 3857.  If not, assume WGS84
						var shapefile = new mapnik.Datasource({
							type : 'shape',
							file : _self.path_to_shp
						});
						
						var floatbbox = args.bbox.split(",");
		
						var bbox = [floatbbox[0], floatbbox[1], floatbbox[2], floatbbox[3]];
						//ll lat, ll lon, ur lat, ur lon
		
						layer.datasource = shapefile;
						layer.styles = [_self.table, 'style'];
	
						console.log(map.toXML());
						// Debug settings

						map.add_layer(layer);
	
						map.extent = bbox;
						var im = new mapnik.Image(map.width, map.height);
						map.render(im, function(err, im) {
							maps.release(xmlss, map);
							if (err) {
								throw err;
							} else {
								var duration = Date.now() - startTime;
								ShapeSingleTileStats.times.push(duration);
								res.writeHead(200, {
									'Content-Type' : 'image/png'
								});
								res.end(im.encodeSync('png'));
							}
						});
                });
				
			} catch (err) {
				res.writeHead(500, {
					'Content-Type' : 'text/plain'
				});
				res.end(err.message);
			}

		} else {
			//if no args, pass to regular tile renderer
				res.writeHead(500, {
					'Content-Type' : 'text/plain'
				});
				res.end("Need to supply width, height and bbox arguments.");

		}
	});

	console.log("Created dynamic query service: " + '/services/shapefiles/' + _self.table + '/dynamicQueryMap');
});
