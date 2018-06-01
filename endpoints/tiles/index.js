//Common and settings should be used by all sub-modules
var express = require('express'), common = require("../../common"), settings = require('../../settings/settings');

//Module-specific requires:
var mapnik = require('mapnik'),
  mercator = require('../../utils/sphericalmercator.js'), // 3857
  geographic = require('../../utils/geographic.js'), //4326
  mappool = require('../../utils/pool.js'),
  parseXYZ = require('../../utils/tile.js').parseXYZ,
  path = require('path'),
  fs = require("fs"),
  flow = require('flow'),
  zlib = require("zlib"),
  MMLBuilder = require("./cartotomml/mml_builder"),
  crypto = require("crypto"),
  carto = require("carto"),
  mbtileserver = require("./mbtileserver.js");

//Caching
var CCacher = require("../../lib/ChubbsCache");
var cacher = new CCacher();


var TMS_SCHEME = false;
var _styleExtension = '.mss';
var _defaultMSS = "default" + _styleExtension;

var PGTileStats = {
  SingleTiles: { times: [] },
  MultiTiles: { times: [] },
  VectorTiles: { times: [] }
};

var ShapeTileStats = {
  SingleTiles: { times: [] },
  MultiTiles: { times: [] },
  VectorTiles: { times: [] }
};

var GeoJSONTileStats = {
  SingleTiles: { times: [] },
  MultiTiles: { times: [] },
  VectorTiles: { times: [] }
};


var MemoryShapeTileStats = {
  SingleTiles: { times: [] },
  MultiTiles: { times: [] },
  VectorTiles: { times: [] }
};

var RasterTileStats = {
  SingleTiles: { times: [] },
  MultiTiles: { times: [] },
  VectorTiles: { times: [] }
};


//Store a list of Shapefiles stored in the Mapnik/data/shapefiles folder.
var shapefiles = []; //a list of shapefiles that will be dynamically read
var memoryShapefileList = []; //a list of shapefile names to be loaded into memory
var memoryShapefiles = {}; //Store the memory datasources here
var geojsonfiles = []; //a list of geojson files to be dynamically read
var rasters = []; //a list of rasters that will be dynamically read
var tileRoutes = []; //Keep a list of image tile routes
var VectorTileRoutes = []; //Keep a list of vector tile routes

// register shapefile plugin
if (mapnik.register_default_input_plugins)
  mapnik.register_default_input_plugins();

//Use pooling to handle concurrent map requests
//var maps = mappool.create_pool(10);
//TODO: Determine the best value for this


exports.app = function (passport) {

  var app = express();

  //Load mbtile server
  app.use(mbtileserver.app(passport));

  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');

  var shpLocation = path.join(__dirname, "../../data/shapefiles");
  var geojsonLocation = path.join(__dirname, "../../data/geojson");
  var memoryShpLocation = path.join(__dirname, "../../data/inmemory-shapefiles");
  var rasterLocation = path.join(__dirname, "../../data/rasters");

  //Find Shapefiles
  shapefiles = getShapeFilePaths(shpLocation);

  //Find GeoJSON files
  //geojsonfiles = getGeoJSONFilePaths(geojsonLocation);

  //Find shapefiles to be loaded into memory
  memoryShapefileList = getMemoryShapeFilePaths(memoryShpLocation);

  //Find Rasters
  rasters = getRasterPaths(rasterLocation);

  //Return json of found shapefiles - setting this to /services/shapefiles causes all requests to /services/shapefiles/name/dynamicMap to simply revert to this.
  //Probably has to do with the fact that endpoints below use this.app.use instead of this.app.all (which doesn't work for some reason')
  app.get('/shapefiles', function (req, res) {

    var resultSet = [];

    var args = req.query;
    if (args && args.limit) {
      resultSet = shapefiles.splice(0, args.limit);
    }
    else {
      resultSet = shapefiles;
    }

    res.json({
      shapefiles: resultSet
    });
  });


  //TODO:  Treat the in-memory shapefiles the same as non-memory shapefiles.  Use the same endpoints, but use a flag of some sort to determine which are in and out of memory.
  app.get('/memshapefiles', function (req, res) {

    var resultSet = [];

    var args = req.query;
    if (args && args.limit) {
      resultSet = memoryShapefiles.splice(0, args.limit);
    }
    else {
      resultSet = memoryShapefiles;
    }

    res.json({
      shapefiles: resultSet
    });
  });

  //Return json of found rasters - setting this to /services/rasters causes all requests to /services/rasters/name/dynamicMap to simply revert to this.
  //Probably has to do with the fact that endpoints below use this.app.use instead of this.app.all (which doesn't work for some reason')
  app.get('/rasters', function (req, res) {

    var resultSet = [];

    var args = req.query;
    if (args && args.limit) {
      resultSet = rasters.splice(0, args.limit);
    }
    else {
      resultSet = rasters;
    }

    res.json({
      rasters: resultSet
    });
  });


  // listen for events to track cache rate and errors
  cacher.on("hit", function (key) {
    console.log("Using Cached response for: " + key)
  });
  cacher.on("miss", function (key) {
    console.log("No cached response for: " + key + ".  Generating.")
  });
  cacher.on("error", function (key) {
    console.log("Error with cache. " + err)
  });

  var shpName = "";
  //Loop thru shapes and spin up new routes
  shapefiles.forEach(function (item) {
    shpName = item.split('.')[0];

    var tileSettings = { mapnik_datasource: {}, tileSize: { height: 256, width: 256}, routeProperties: { name: "", source: "", geom_field: "", srid: "", cartoFile: "" }};

    tileSettings.mapnik_datasource = {
      type: 'shape',
      file: path.join(shpLocation, item)
    };
    tileSettings.routeProperties.name = shpName;
    tileSettings.routeProperties.table = shpName;
    tileSettings.routeProperties.srid = 4326;
    tileSettings.routeProperties.cartoFile = "";
    tileSettings.routeProperties.source = "shapefile";
    tileSettings.routeProperties.defaultStyle = "";//The name of the style inside of the xml file
    tileSettings.routeProperties.performanceObject = ShapeTileStats;

    //createMultiTileRoute(app, tileSettings, MemoryShapeTileStats.MultiTiles);
    createVectorTileRoute(app, tileSettings, ShapeTileStats.VectorTiles);
  });

  //var geojsonName = "";
  ////Loop thru geojson and spin up new routes
  //geojsonfiles.forEach(function (item) {
  //  geojsonName = item.split('.')[0];
  //
  //  var tileSettings = { mapnik_datasource: {}, tileSize: { height: 256, width: 256}, routeProperties: { name: "", source: "", geom_field: "", srid: "", cartoFile: "" }};
  //
  //  tileSettings.mapnik_datasource = {
  //    type: 'geojson',
  //    file: path.join(geojsonLocation, item)
  //  };
  //
  //  tileSettings.routeProperties.name = geojsonName;
  //  tileSettings.routeProperties.table = geojsonName;
  //  tileSettings.routeProperties.srid = 4326;
  //  tileSettings.routeProperties.cartoFile = "";
  //  tileSettings.routeProperties.source = "geojson";
  //  tileSettings.routeProperties.defaultStyle = "";//The name of the style inside of the xml file
  //  tileSettings.routeProperties.performanceObject = GeoJSONTileStats;
  //
  //  //createMultiTileRoute(app, tileSettings, MemoryShapeTileStats.MultiTiles);
  //  createVectorTileRoute(app, tileSettings, GeoJSONTileStats.VectorTiles);
  //});

  var memoryShpName = "";
  memoryShapefileList.forEach(function (item) {
    //Also (for performance testing puproses, create in-memory versions of the .shp datasources and spin up a new route for those)
    memoryShpName = item.split('.')[0];
    memoryShapefiles[memoryShpName] = createInMemoryDatasource(memoryShpName, memoryShpLocation + "/" + item);

    var tileSettings = { mapnik_datasource: {}, tileSize: { height: 256, width: 256}, routeProperties: { name: "", source: "", geom_field: "", srid: "", cartoFile: "" }};

    tileSettings.mapnik_datasource = memoryShapefiles[memoryShpName];
    tileSettings.mapnik_datasource.geometry_type = "point"; //TODO.  Figure this out.
    tileSettings.mapnik_datasource.type = "point"; //Adding type to maintain consistency with other types.

    tileSettings.routeProperties.name = memoryShpName;
    tileSettings.routeProperties.table = memoryShpName;
    tileSettings.routeProperties.srid = 4326;
    tileSettings.routeProperties.cartoFile = "";
    tileSettings.routeProperties.source = "shapefile";
    tileSettings.routeProperties.defaultStyle = "";//The name of the style inside of the xml file


    //createMultiTileRoute(app, tileSettings, MemoryShapeTileStats.MultiTiles);
    //createSingleTileRoute(app, tileSettings, MemoryShapeTileStats.SingleTiles);
    createVectorTileRoute(app, tileSettings, MemoryShapeTileStats.VectorTiles);
  });

  var rasterName = "";
  //Loop thru rasters and spin up new routes
  rasters.forEach(function (item) {
    rasterName = item.split('.')[0];
    //createRasterTileRenderer(app, rasterName, rasterLocation + "/" + item, 4326, null);
  });


  //Load PG Tables
  //look thru all tables in PostGres with a geometry column, spin up dynamic map tile services for each one
  //common.vacuumAnalyzeAll();

  common.findSpatialTables(app, function (error, tables) {
    if (error) {
      console.log(error);
    } else {
      if (tables) {
        Object.keys(tables).forEach(function (key) {
          var item = tables[key];

          (function (item) {

            var tileSettings = { mapnik_datasource: {}, tileSize: { height: 256, width: 256}, routeProperties: { name: "", source: "", geom_field: "", srid: "", cartoFile: "" }};

            tileSettings.mapnik_datasource = {
              'host': settings.pg.server,
              'port': settings.pg.port,
              'dbname': settings.pg.database,
              //'table': item.table,
              'table': ('(SELECT ' + item.geometry_column + ' from "' + item.table + '"' + ') as "' + item.table + '"'),

              'user': settings.pg.username,
              'password': settings.pg.password,
              'type': 'postgis',
              'estimate_extent': 'false',
              'geometry_field': item.geometry_column,
              'srid': item.srid,
              'geometry_type': item.type
            };
            tileSettings.routeProperties.name = key;
            tileSettings.routeProperties.table = item.table;
            tileSettings.routeProperties.srid = item.srid;
            tileSettings.routeProperties.cartoFile = "";
            tileSettings.routeProperties.source = "postgis";
            tileSettings.routeProperties.geom_field = item.geometry_column;
            tileSettings.routeProperties.defaultStyle = "";//The name of the style inside of the xml file

            createMultiTileRoute(app, tileSettings, PGTileStats.MultiTiles);
            createSingleTileRoute(app, tileSettings, PGTileStats.SingleTiles);
            createVectorTileRoute(app, tileSettings, PGTileStats.VectorTiles);

          })(item);
        });
      }
    }
  });

  var sessionStart = new Date().toLocaleString();

  //Load tile rendering statistics
  app.get('/admin', function (req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/plain'
    });

    var resultString = "Active Session started at: " + sessionStart + "\n\n\nUse ?reset=true to reset the stats\n\n\n";

    var args = req.query;
    if (args.reset) {
      //Reset the stats.
      clearStatsObject(PGTileStats);
      clearStatsObject(MemoryShapeTileStats);
      clearStatsObject(RasterTileStats);
      clearStatsObject(RasterTileStats);
      //clearStatsObject(GeoJSONTileStats);

      resultString += "Session Stats reset by user. \n\n\n";
    }


    //Get the average render time for each type
    resultString += generateStatsString(PGTileStats, "PostGIS");
    resultString += generateStatsString(ShapeTileStats, "Shapefile");
    //resultString += generateStatsString(GeoJSONTileStats, "GeoJSON");
    resultString += generateStatsString(RasterTileStats, "Raster");

    var cacheLength = (cacher.client.keys().length / 2);
    var cacheSize = common.roughSizeOfObject(cacher.client.values()) / 1000;

    resultString += cacheLength.toString() + " tiles stored in cache, with a size of roughly " + cacheSize + " KB.";
    resultString += "\n...That's an average of " + (cacheSize / cacheLength || 0) + "KB/tile. (This is usually too high)."


    res.end(resultString);
  });

  //Testing to see if carto will work.
  app.get('/css', function (req, res) {
    //CartoCSS Converter
    var optional_args = optional_args || {};
    if (!optional_args.cachedir) optional_args.cachedir = '/tmp/millstone';
    var MMLConverter = new MMLBuilder({ table: 'my_table' }, optional_args, function (err, payload) {
    });
    //Do a conversion with an incoming file.
    MMLConverter.render("#my_table{polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}", function (a, b) {
      //done.
      res.end("<![CDATA[" + b + "]>");
    });
  });

//  //Tile endpoint, display all tile routes
//  app.all('/services/image-tiles', function (req, res) {
//
//    var args = common.getArguments(req);
//
//    args.view = "tile_list";
//    args.breadcrumbs = [{
//      link : "/services",
//      name : "Services"
//    },{
//      link : "",
//      name : "Image Tile Services"
//    }];
//    args.path = req.path;
//    args.host = settings.application.publichost || req.headers.host;
//    args.featureCollection = tileRoutes.concat(mbtileserver.getImageTileRoutes());;
//
//    common.respond(req, res, args);
//  });
//
//  //Tile endpoint, display all tile routes
//  app.all('/services/vectortiles', function (req, res) {
//
//    var args = common.getArguments(req);
//
//    args.view = "tile_list";
//    args.breadcrumbs = [{
//      link : "/services",
//      name : "Services"
//    },{
//      link : "",
//      name : "Vector Tile Services"
//    }];
//    args.path = req.path;
//    args.host = settings.application.publichost || req.headers.host;
//    args.featureCollection = VectorTileRoutes.concat(mbtileserver.getVectorTileRoutes());
//
//    common.respond(req, res, args);
//  });

  return app;
};




function generateStatsString(statsObject, sourceName) {
  var message = "";
  var tileType;

  Object.keys(statsObject).forEach(function (source) {
    switch (source) {
      case "SingleTiles":
        tileType = "Single Tile";
        break;
      case "MultiTiles":
        tileType = "Multi Tiles";
        break;
      case "VectorTiles":
        tileType = "Vector Tiles";
        break;
    }

    var StatTypeObject = statsObject[source];

    if (StatTypeObject.times.length > 0) {
      var totalTime = StatTypeObject.times.reduce(function (previousValue, currentValue, index, array) {
        return parseInt(previousValue) + parseInt(currentValue);
      });
      totalTime = totalTime / 1000;
      var averageTime = totalTime / StatTypeObject.times.length;
      message += tileType + " - " + sourceName + ": For this session, " + StatTypeObject.times.length + " tiles were generated in " + totalTime + " seconds with an average time of " + averageTime + " seconds/tile.\n";
    } else {
      message += tileType + " - " + sourceName + ": 0 tiles rendered.\n";
    }
  });

  //New section
  message += "\n\n";

  return message;
}

function clearStatsObject(performanceObject) {
  performanceObject.SingleTiles.times = [];
  performanceObject.MultiTiles.times = [];
  performanceObject.VectorTiles.times = [];
}

//Create a renderer that will accept dynamic GeoJSON Objects and styling and bring back a single image to fit the map's extent.
exports.createGeoJSONQueryRenderer = flow.define(function (app, geoJSON, epsgSRID, cartoFile, id, callback) {

  this.app = app;
  this.geoJSON = geoJSON;
  //this.geom_field = geom_field;
  this.epsg = epsgSRID;

  var _self = this;
  var dynamicURL = '/services/GeoJSONQueryMap/' + id;

  //Create Route for this table - TODO:  Figure out how/when to kill this endpoint
  this.app.all(dynamicURL, function (req, res) {

    //Check for correct args
    //Needs: width (px), height (px), bbox (xmin, ymax, xmax, ymin), where, optional styling
    var args = common.getArguments(req);

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
          'Content-Type': 'text/plain'
        });
        res.end(missing);
        return;
      }

      //If user passes in geojson
      if (args.geojson) {
        //Validate where - TODO
      }

      //make a temporary geojson file for mapnik (until I figure out how to pass in an object)
      common.writeGeoJSONFile(geoJSON, id, function (err, filename, fullpath) {

        if (err) {
          //TODO: Handle this.
          return;
        }

        if (fullpath) {

          var geojson_settings = {
            type: 'geojson',
            file: fullpath
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
            layer.styles = [id, 'default'];

            map.bufferSize = 64;

            var stylepath = __dirname + '/cartocss/default.xml';

            map.load(path.join(stylepath), {
              strict: true
            }, function (err, map) {

              if (err)
                throw err;
              map.add_layer(layer);

              console.log(map.toXML());
              // Debug settings

              map.extent = bbox;
              var im = new mapnik.Image(map.width, map.height);
              map.render(im, function (err, im) {

                if (err) {
                  throw err;
                } else {
                  res.writeHead(200, {
                    'Content-Type': 'image/png'
                  });
                  res.end(im.encodeSync('png'));
                }
              });
            });
          } catch (err) {
            res.writeHead(500, {
              'Content-Type': 'text/plain'
            });
            res.end(err.message);
          }
        }

      });

    } else {
      //if no args, pass to regular tile renderer
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      });
      res.end("Need to supply height, width and bbox arguments.");
    }
  });

  console.log("Created dynamic query service: " + dynamicURL);
  callback({
    imageURL: dynamicURL
  });
});

//Create a renderer that will accept dynamic GeoJSON Objects and styling and bring back a single image to fit the map's extent.
exports.createImageFromGeoJSON = flow.define(function (geoJSON, bbox, epsgSRID, cartoFile, callback) {

  this.geoJSON = geoJSON;
  //this.geom_field = geom_field;
  this.epsg = epsgSRID;

  var _self = this;

  //Check for correct args
  //Needs: geojson, bbox (xmin, ymax, xmax, ymin)
  var args = {
    width: 500,
    height: 500
  };

  //make a temporary geojson file for mapnik (until I figure out how to pass in an object)
  common.writeGeoJSONFile(geoJSON, "geojson", function (err, filename, fullpath) {

    if (err) {
      //TODO: Handle this.
      return;
    }

    if (fullpath) {

      var geojson_settings = {
        type: 'geojson',
        file: fullpath
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
        layer.styles = ["geojson", 'default'];

        map.bufferSize = 64;

        var stylepath = __dirname + '/cartocss/' + _defaultMSS;

        map.load(path.join(stylepath), {
          strict: true
        }, function (err, map) {

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


//Create a static renderer, using in-memory shapefile
var createMemoryShapefileTileRenderer = exports.createMemoryShapefileTileRenderer = flow.define(
  function (app, table, memoryDatasource, epsgSRID, cartoFile) {

    this.app = app;
    this.table = table;
    this.epsg = epsgSRID;
    this.memoryDatasource = memoryDatasource;

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
    fs.stat(fullpath, function (err, stat) {
      if (err) {
        //No file.  Use defaults.
        fullpath = stylepath + _defaultMSS;
      }

      flo(fullpath);
      //flow to next function
    });
  }, function (fullpath) {
    //Flow from after getting full path to Style file

    var _self = this;

    //Create Route for this table
    this.app.all('/services/memshapefiles/' + _self.table + '/dynamicMap', function (req, res) {
      //Start Timer to measure response speed for tile requests.
      var startTime = Date.now();

      parseXYZ(req, TMS_SCHEME, function (err, params) {
        if (err) {
          res.writeHead(500, {
            'Content-Type': 'text/plain'
          });
          res.end(err.message);
        } else {
          try {

            var map = new mapnik.Map(256, 256, mercator.proj4);

            var layer = new mapnik.Layer(_self.table, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));

            var bbox = mercator.xyz_to_envelope(parseInt(params.x), parseInt(params.y), parseInt(params.z), false);

            layer.datasource = _self.memoryDatasource;
            layer.styles = [_self.table, 'default'];

            map.bufferSize = 64;
            map.load(path.join(fullpath), {
              strict: true
            }, function (err, map) {
              if (err)
                throw err;

              map.add_layer(layer);

              console.log(map.toXML());
              // Debug settings

              map.extent = bbox;
              var im = new mapnik.Image(map.width, map.height);
              map.render(im, function (err, im) {
                if (err) {
                  throw err;
                } else {
                  var duration = Date.now() - startTime;
                  MemShapeStats.times.push(duration);
                  res.writeHead(200, {
                    'Content-Type': 'image/png'
                  });
                  res.end(im.encodeSync('png'));
                }
              });

            });

          } catch (err) {
            res.writeHead(500, {
              'Content-Type': 'text/plain'
            });
            res.end(err.message);
          }
        }
      });
    });

    console.log("Created in-memory shapefile service: " + '/services/memshapefiles/' + _self.table + '/dynamicMap');
  });


//Create a renderer that will  bring back a single image to fit the map's extent, using in-memory features read from a shapefile.
var createMemoryShapefileSingleTileRenderer = exports.createMemoryShapefileSingleTileRenderer = flow.define(function (app, table, memoryDatasource, epsgSRID, cartoFile) {

  this.app = app;
  this.table = table;
  this.memoryDatasource = memoryDatasource;
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
  fs.stat(fullpath, function (err, stat) {
    if (err) {
      //No file.  Use defaults.
      fullpath = stylepath + _defaultMSS;
    }

    flo(fullpath);
    //flow to next function
  });
}, function (fullpath) {
  //Flow from after getting full path to Style file

  var _self = this;

  //Create Route for this table
  this.app.all('/services/memshapefiles/' + _self.table + '/dynamicQueryMap', function (req, res) {
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
          'Content-Type': 'text/plain'
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
        //create map and layer
        var map = new mapnik.Map(parseInt(args.width), parseInt(args.height), mercator.proj4);

        //width, height
        var layer = new mapnik.Layer(_self.table, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));

        var floatbbox = args.bbox.split(",");

        var bbox = [floatbbox[0], floatbbox[1], floatbbox[2], floatbbox[3]];
        //ll lat, ll lon, ur lat, ur lon

        layer.datasource = _self.memoryDatasource;
        layer.styles = [_self.table, 'default'];
        map.bufferSize = 64;

        map.load(path.join(fullpath), {
          strict: true
        }, function (err, map) {

          map.add_layer(layer);

          console.log(map.toXML());
          // Debug settings

          map.extent = bbox;
          var im = new mapnik.Image(map.width, map.height);
          map.render(im, function (err, im) {

            if (err) {
              throw err;
            } else {
              var duration = Date.now() - startTime;
              MemShapeSingleTileStats.times.push(duration);
              res.writeHead(200, {
                'Content-Type': 'image/png'
              });
              res.end(im.encodeSync('png'));
            }
          });
        });

      } catch (err) {
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end(err.message);
      }

    } else {
      //if no args, pass to regular tile renderer
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      });
      res.end("Need to supply width, height and bbox arguments.");

    }
  });

  console.log("Created in-memory shapefile query service: " + '/services/memshapefiles/' + _self.table + '/dynamicQueryMap');
});

function createInMemoryDatasource(name, path_to_shp) {
  var shapefile = new mapnik.Datasource({
    type: 'shape',
    file: path_to_shp
  });

  // get the featureset that exposes lazy next() iterator
  var featureset = shapefile.featureset();

  var mem_datasource = new mapnik.MemoryDatasource(
    {}
  );

  // build up memory datasource
  while (( feat = featureset.next(true))) {
    var e = feat.extent();
    // center longitude of polygon bbox
    var x = (e[0] + e[2]) / 2;
    // center latitude of polygon bbox
    var y = (e[1] + e[3]) / 2;
    var attr = feat.attributes();
    mem_datasource.add({
      'x': x,
      'y': y,
      'properties': {
        'feat_id': feat.id()//,
        //'NAME' : attr.NAME,
        //'POP2005' : attr.POP2005
      }
    });
  }

  return mem_datasource;
}


//Create a static renderer that will always use the default styling
var createRasterTileRenderer = exports.createRasterTileRenderer = flow.define(function (app, table, path_to_raster, epsgSRID, cartoFile) {

  this.app = app;
  this.table = table;
  this.epsg = epsgSRID;
  this.path_to_raster = path_to_raster;

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
  fs.stat(fullpath, function (err, stat) {
    if (err) {
      //No file.  Use defaults.
      fullpath = stylepath + _defaultMSS;
      //Default
    }

    flo(fullpath);
    //flow to next function
  });
}, function (fullpath) {
  //Flow from after getting full path to Style file

  var _self = this;

  //Create Route for this table
  this.app.all('/services/rasters/' + _self.table + '/dynamicMap', function (req, res) {
    //Start Timer to measure response speed for tile requests.
    var startTime = Date.now();

    parseXYZ(req, TMS_SCHEME, function (err, params) {
      if (err) {
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end(err.message);
      } else {
        try {

          var map = new mapnik.Map(256, 256, mercator.proj4);

          var layer = new mapnik.Layer(_self.table, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
          //check to see if 3857.  If not, assume WGS84

          var bbox = mercator.xyz_to_envelope(parseInt(params.x), parseInt(params.y), parseInt(params.z), false);

          var raster = new mapnik.Datasource({
            type: 'gdal',
            file: _self.path_to_raster,
            band: 1
          });

          layer.datasource = raster;
          layer.styles = [_self.table, 'raster'];

          map.bufferSize = 64;
          map.load(path.join(fullpath), {
            strict: true
          }, function (err, map) {
            if (err)
              throw err;

            map.add_layer(layer);

            console.log(map.toXML());
            // Debug settings

            map.extent = bbox;
            var im = new mapnik.Image(map.width, map.height);
            map.render(im, function (err, im) {
              if (err) {
                throw err;
              } else {
                var duration = Date.now() - startTime;
                RasterStats.times.push(duration);
                res.writeHead(200, {
                  'Content-Type': 'image/png'
                });
                res.end(im.encodeSync('png'));
              }
            });

          });

        } catch (err) {
          res.writeHead(500, {
            'Content-Type': 'text/plain'
          });
          res.end(err.message);
        }
      }
    });
  });

  console.log("Created dynamic raster tile service: " + '/services/rasters/' + _self.table + '/dynamicMap');
});


var aquire = function (id, options, callback) {
  methods = {
    create: function (cb) {
      var obj = new mapnik.Map(options.width || 256, options.height || 256, mercator.proj4);
      obj.load(id, {
        strict: true
      }, function (err, obj) {
        if (options.bufferSize) {
          obj.bufferSize = options.bufferSize;
        }
        cb(err, obj);
      });
    },
    destroy: function (obj) {
      delete obj;
    }
  };
  maps.acquire(id, methods, function (err, obj) {
    callback(err, obj);
  });
};

//Find all shapefiles in the ./data/Shapefiles folder.
//Spin up a new endpoint for each one of those.
function getShapeFilePaths(shpLocation) {
  var items = [];
  //Load mbtiles from mbtiles folder.
  require("fs").readdirSync(shpLocation).forEach(function (file) {
    var ext = path.extname(file);
    if (ext == ".shp") {
      items.push(file);
    }
  });

  return items;
}


//Find all geojson files in the ./data/geojson folder.
//Spin up a new endpoint for each one of those.
function getGeoJSONFilePaths(geojsonLocation) {
  var items = [];
  require("fs").readdirSync(geojsonLocation).forEach(function (file) {
    var ext = path.extname(file);
    if (ext == ".geojson" || ext == ".json" || ext == ".js") {
      items.push(file);
    }
  });

  return items;
}

//Find all shapefiles in the ./data/InMemory-Shapefiles folder.
//These are shapefiles that should be loaded into memory when the server starts
function getMemoryShapeFilePaths(shpLocation) {
  var items = [];
  //Load mbtiles from mbtiles folder.
  require("fs").readdirSync(shpLocation).forEach(function (file) {
    var ext = path.extname(file);
    if (ext == ".shp") {
      items.push(file);
    }
  });

  return items;
}

//Find all rasters in the ./data/rasters folder.
//Spin up a new endpoint for each one of those.
function getRasterPaths(rasterLocation) {
  var items = [];
  //Load rasters from rasters folder.
  require("fs").readdirSync(rasterLocation).forEach(function (file) {
    var ext = path.extname(file);
    if (ext == ".tiff" || ext == ".tif" || ext == ".geotiff") {
      items.push(file);
    }
  });

  return items;
};


//Generic implementation of multi-tiles
var createMultiTileRoute = exports.createMultiTileRoute = flow.define(
  function (app, routeSettings, performanceObject) {

    this.app = app;
    this.settings = routeSettings;
    this.performanceObject = performanceObject;

    this._stylepath = path.join(__dirname, 'cartocss');

    //Set the path to the style file
    this.fullpath = (this.settings.routeProperties.cartoFile ? path.join(this._stylepath, this.settings.routeProperties.cartoFile) : path.join(this._stylepath, this.settings.routeProperties.name + _styleExtension));

    //See if there is a <name>.xml file for this table.
    fs.stat(this.fullpath, this);
  },
  function (err, stat) {
    var _self = this;
    //assume not default styling
    _self.isDefault = false;

    if (err) {
      //No file.  Use defaults.
      //it is default styling
      _self.isDefault = true;

      _self.mssGeomType = _self.settings.mapnik_datasource.geometry_type.toLowerCase().indexOf("point") > -1 ? "default_point" : "default";

      _self.fullpath = path.join(_self._stylepath, _self.mssGeomType + _styleExtension);
    }

    _self.mssClass = (_self.isDefault ? _self.mssGeomType : _self.settings.mapnik_datasource.table)


    //Read the file and pass the contents to the next function
    fs.readFile(_self.fullpath, 'utf8', _self);
  },
  function (err, styleString) {
    if (err) {
      this(""); //return nothing
    }
    //CartoCSS Converter
    var optional_args = {};
    optional_args.cachedir = '/tmp/millstone';

    //If no css style is present, then pick a default mss file. Points are treated separately with a different mss file
    this.settings.mapnik_datasource.layerName = this.mssClass;
    this.MMLConverter = new MMLBuilder(this.settings.mapnik_datasource, optional_args, function (err, payload) {
    });
    this.MMLConverter.render(styleString, this);
  },
  function (err, mmlStylesheet) {
    //strip out the Layer & Datasource portions of the mml.
    //this.MMLConverter.stripLayer(mmlStylesheet, this);
    this(null, mmlStylesheet);
  },
  function (err, mmlStylesheet) {
    if (err) {
      //keep going with defaults
    }

    var _self = this;

    var route = '/services/' + _self.settings.routeProperties.source + '/' + _self.settings.routeProperties.table + (_self.settings.mapnik_datasource.type.toLowerCase() == 'postgis' ? '/' + _self.settings.mapnik_datasource.geometry_field : '') + '/dynamicMap/:z/:x/:y.*';

    //Create Route for this table
    this.app.get(route, cacher.cache('day'), function (req, res) {

      //Start Timer to measure response speed for tile requests.
      var startTime = Date.now();

      //Check for correct args
      //Optional: where clause for postgis type
      var args = common.getArguments(req);

      //If user passes in where clause, then build the query here and set it with the table property of postgis_settings
      if (args.where) {
        //Validate where - TODO

        //If a where clause was passed in, and we're using a postgis datasource, allow it
        if (_self.settings.mapnik_datasource.type.toLowerCase() == 'postgis') {
          _self.settings.mapnik_datasource.table = (args.where ? '(SELECT ' + _self.settings.routeProperties.geom_field + ' from "' + _self.settings.routeProperties.name + '" WHERE ' + args.where + ') as "' + _self.settings.routeProperties.name + '"' : '"' + _self.settings.routeProperties.name + '"');
        }
      }

      //Optional CartoCSS classes and styles may be passed in
//            if(args.style){
//                //Transform the style to a style tag.
//                //_self.MMLConverter.render(args.style, this);
//                var tag = carto.Parser().parse(args.style);
//            }

      try {
        //create map
        var map = new mapnik.Map(256, 256, mercator.proj4);

        var bbox = mercator.xyz_to_envelope(+req.param('x'), +req.param('y'), +req.param('z'), false);

        map.bufferSize = 64;

        map.fromString(mmlStylesheet, {
          strict: true
        }, function (err, map) {
          if (err){
            //Bad connection to PG possibly
            res.writeHead(500, {
              'Content-Type': 'text/plain'
            });
            res.end(err.message);
            return;
          }


          map.extent = bbox;
          //Write out the map xml
          console.log(map.toXML());


          var im = new mapnik.Image(map.width, map.height);
          map.render(im, function (err, im) {

            if (err) {
              throw err;
            } else {
              var duration = Date.now() - startTime;
              _self.performanceObject.times.push(duration);
              res.writeHead(200, {
                'Content-Type': 'image/png'
              });
              res.end(im.encodeSync('png'));
            }
          });
        });

      } catch (err) {
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end(err.message);
      }


    });

    console.log("Created multi tile service (" + _self.settings.routeProperties.source + "): " + route);
    tileRoutes.push({ name: _self.settings.routeProperties.name, route: route, type: "Multi Tile", source: _self.settings.routeProperties.source});
  }
);


//Generic implementation of single-tiles
var createSingleTileRoute = exports.createSingleTileRoute = flow.define(
  function (app, routeSettings, performanceObject) {

    this.app = app;
    this.settings = routeSettings;
    this.performanceObject = performanceObject;

    var _stylepath = path.join(__dirname, 'cartocss');

    //Set the path to the style file
    var fullpath = (this.settings.routeProperties.cartoFile ? path.join(_stylepath, this.settings.routeProperties.cartoFile) : _stylepath + this.settings.routeProperties.name + _styleExtension);

    //Save the flow
    var flo = this;

    //See if there is a <name>.xml file for this table.
    fs.stat(fullpath, function (err, stat) {
      if (err) {
        //No file.  Use defaults.
        fullpath = path.join(_stylepath, _defaultMSS);
      }
      flo(fullpath);
    });
  }, function (fullpath) {
    //Flow in from getting full path to Style file

    var _self = this;

    var route = '/services/' + _self.settings.routeProperties.source + '/' + _self.settings.routeProperties.table + (_self.settings.mapnik_datasource.type.toLowerCase() == 'postgis' ? '/' + _self.settings.mapnik_datasource.geometry_field : '') + '/dynamicSingleMap/*';

    //Create Route for this table
    this.app.all(route, cacher.cache('days', 1), function (req, res) {

      //Start Timer to measure response speed for tile requests.
      var startTime = Date.now();

      //Check for correct args
      //Needs: width (px), height (px), bbox (xmin, ymax, xmax, ymin), where, optional styling
      var args = common.getArguments(req);

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
            'Content-Type': 'text/plain'
          });
          res.end(missing);
          return;
        }

        //If user passes in where clause, then build the query here and set it with the table property of postgis_settings
        if (args.where) {
          //Validate where - TODO

          //If a where clause was passed in, and we're using a postgis datasource, allow it
          if (_self.settings.mapnik_datasource.type.toLowerCase() == 'postgis') {
            _self.settings.mapnik_datasource.table = (args.where ? '(SELECT ' + _self.settings.routeProperties.geom_field + ' from "' + _self.settings.routeProperties.name + '" WHERE ' + args.where + ') as "' + _self.settings.routeProperties.name + '"' : '"' + _self.settings.routeProperties.name + '"');
          }
        }

        //We're all good. Make the picture.
        try {
          //create map and layer
          var map = new mapnik.Map(parseInt(args.width), parseInt(args.height), mercator.proj4);

          //width, height
          var layer = new mapnik.Layer(_self.settings.routeProperties.name, ((_self.settings.routeProperties.srid && (_self.settings.routeProperties.srid == 3857 || _self.settings.routeProperties.srid == 3587)) ? mercator.proj4 : geographic.proj4));

          var floatbbox = args.bbox.split(",");

          //ll lat, ll lon, ur lat, ur lon
          var bbox = [floatbbox[0], floatbbox[1], floatbbox[2], floatbbox[3]];

          var datasource = new mapnik.Datasource(_self.settings.mapnik_datasource);

          layer.datasource = datasource;
          layer.styles = [_self.settings.routeProperties.name, _self.settings.routeProperties.defaultStyle || 'default'];

          map.bufferSize = 64;
          map.load(path.join(fullpath), {
            strict: true
          }, function (err, map) {
            if (err)
              throw err;

            map.add_layer(layer);

            //Write out the map xml
            console.log(map.toXML());

            map.extent = bbox;
            var im = new mapnik.Image(map.width, map.height);
            map.render(im, function (err, im) {

              if (err) {
                throw err;
              } else {
                var duration = Date.now() - startTime;
                _self.performanceObject.times.push(duration);
                res.writeHead(200, {
                  'Content-Type': 'image/png'
                });
                res.end(im.encodeSync('png'));
              }
            });
          });

        } catch (err) {
          res.writeHead(500, {
            'Content-Type': 'text/plain'
          });
          res.end(err.message);
        }
      }
      else {
        //No args provided
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end("Needs args width, height and bbox.");
        return;
      }
    });

    console.log("Created single tile service (" + _self.settings.routeProperties.source + "): " + route);
    tileRoutes.push({ name: _self.settings.routeProperties.name, route: route, type: "Single Tile", source: _self.settings.routeProperties.source});
  });


var escape_columns = function(columns) {
  for(var i=0; i < columns.length; i++){
    columns[i] = '"' + columns[i] + '"';
  }
  return columns;
}

//Generic implementation of vector tiles
var createVectorTileRoute = exports.createVectorTileRoute = flow.define(
  function (app, routeSettings, performanceObject) {

    this.app = app;
    this.settings = routeSettings;
    this.performanceObject = performanceObject
    this();
  },
  function () {

    var _self = this;

    var route = '/services/' + _self.settings.routeProperties.source + '/' + _self.settings.routeProperties.table + (_self.settings.mapnik_datasource.type.toLowerCase() == 'postgis' ? '/' + _self.settings.mapnik_datasource.geometry_field : '') + '/vector-tiles/:z/:x/:y.*';

    //Create Route for this table
    this.app.all(route, cacher.cache('day'), function (req, res) {

      //Start Timer to measure response speed for tile requests.
      var startTime = Date.now();

      var args = common.getArguments(req);

      //If user passes in where clause or fields, then build the query here and set it with the table property of postgis_setting
      if (args.fields || args.where) {
        //Validate where - TODO

        //If a where clause was passed in, and we're using a postgis datasource, allow it
        if (_self.settings.mapnik_datasource.type.toLowerCase() == 'postgis') {
          fields_list = args.fields.split(',');
          args.fields = escape_columns(fields_list).join(",");
          _self.settings.mapnik_datasource.table = (args.fields ? '(SELECT ' + _self.settings.routeProperties.geom_field + (args.fields ? ',' + args.fields : '') + ' from "' + _self.settings.routeProperties.table + '"' + (args.where ? ' WHERE ' + args.where : '') + ') as "' + _self.settings.routeProperties.table + '"' : '"' + _self.settings.routeProperties.table + '"');
        }
      }

      //Make the mapnik datasource.  We wait until now in case the table definition changes if a where clause is passed in above.
      _self.mapnikDatasource = (_self.settings.mapnik_datasource.describe ? _self.settings.mapnik_datasource : new mapnik.Datasource(_self.settings.mapnik_datasource));


      try {
        //create map
        var map = new mapnik.Map(256, 256, mercator.proj4);

        var layer = new mapnik.Layer(_self.settings.routeProperties.name, ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));

        var label_point_layer;
        if(args.labelpoints && _self.settings.mapnik_datasource.type.toLowerCase() == 'postgis') {
          //If user specifies label points to be created, then create another layer in this vector tile that stores the centroid to use as a label point.

          //The only difference in the datasource is the table parameter, which is either a table name, or a sub query that allows you specify a WHERE clause.
          _self.settings.mapnik_datasource.table = (args.fields ? '(SELECT ' + ('ST_PointOnSurface(' + _self.settings.routeProperties.geom_field + ') as geom' ) + (args.fields ? ',' + args.fields : '')  + ' from "' + _self.settings.routeProperties.table + '"' + (args.where ? ' WHERE ' + args.where : '') + ') as "' + _self.settings.routeProperties.table + "_label" + '"' : '"' + _self.settings.routeProperties.table + '"');

          //Make a new Mapnik datasource object
          _self.mapnikDatasource_label = (_self.settings.mapnik_datasource.describe ? _self.settings.mapnik_datasource : new mapnik.Datasource(_self.settings.mapnik_datasource));


          label_point_layer = new mapnik.Layer(_self.settings.routeProperties.name + "_label", ((_self.epsg && (_self.epsg == 3857 || _self.epsg == 3587)) ? mercator.proj4 : geographic.proj4));
          label_point_layer.datasource = _self.mapnikDatasource_label;
          label_point_layer.styles = [_self.settings.routeProperties.table, 'default'];

          //Add label layer
          map.add_layer(label_point_layer);
        }

        var bbox = mercator.xyz_to_envelope(+req.param('x'), +req.param('y'), +req.param('z'), false);

        layer.datasource = _self.mapnikDatasource;
        layer.styles = [_self.settings.routeProperties.table, 'default'];

        map.bufferSize = 10;

        map.add_layer(layer);

        console.log(map.toXML());

        //From Tilelive-Bridge - getTile
        // set source _maxzoom cache to prevent repeat calls to map.parameters
        if (_self._maxzoom === undefined) {
          _self._maxzoom = map.parameters.maxzoom ? parseInt(map.parameters.maxzoom, 10) : 14;
        }

        var opts = {};
        // use tolerance of 32 for zoom levels below max
        opts.tolerance = req.param('z') < _self._maxzoom ? 32 : 0;
        // make larger than zero to enable
        opts.simplify = 0;
        // 'radial-distance', 'visvalingam-whyatt', 'zhao-saalfeld' (default)
        opts.simplify_algorithm = 'radial-distance';

        res.setHeader('Content-Type', 'application/x-protobuf');

        map.extent = bbox;
        // also pass buffer_size in options to be forward compatible with recent node-mapnik
        // https://github.com/mapnik/node-mapnik/issues/175
        opts.buffer_size = map.bufferSize;

        map.render(new mapnik.VectorTile(+req.param('z'), +req.param('x'), +req.param('y')), opts, function (err, image) {

          if (err || !image) {
            res.removeHeader('Content-Encoding');
            res.writeHead(500, {
              'Content-Type': 'application/x-protobuf'
            });
            res.end();
            return;
          }

          // Fake empty RGBA to the rest of the tilelive API for now.
          image.isSolid(function (err, solid, key) {
            if (err) {
              res.writeHead(500, {
                'Content-Type': 'text/plain'
              });

              res.end(err.message);
              return;
            }
            // Solid handling.
            var done = function (err, buffer) {
              if (err) {
                res.writeHead(500, {
                  'Content-Type': 'text/plain'
                });

                res.end(err.message);
                return;
              }

              if (solid === false) {
                var duration = Date.now() - startTime;
                _self.performanceObject.times.push(duration);

                res.send(buffer); //return response
                return;
              }

              // Empty tiles are valid responses.
              if (_self._blank || !key) {
                res.removeHeader('Content-Encoding');
                res.writeHead(200, {
                  'Content-Type': 'application/octet-stream'
                });


                res.end(); //new Buffer('Tile is blank or does not exist', "utf-8")
                return;
              }

              // Fake a hex code by md5ing the key.
              var mockrgb = crypto.createHash('md5').update(buffer).digest('hex').substr(0, 6);
              buffer.solid = [parseInt(mockrgb.substr(0, 2), 16), parseInt(mockrgb.substr(2, 2), 16), parseInt(mockrgb.substr(4, 2), 16), 1].join(',');
              res.send(buffer);

            };

            //Compress if they ask for it.
            if(res.req.headers["accept-encoding"] && res.req.headers["accept-encoding"].indexOf("gzip") > -1){
              res.setHeader('content-encoding', 'gzip');
              zlib.gzip(image.getData(), done);
            }else{
              done(null, image.getData());
            }
          });
        });

      } catch (err) {
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });

        res.end(err.message);
      }
    });

    console.log("Created vector tile service: " + route);
    VectorTileRoutes.push({ name: _self.settings.routeProperties.name, route: route, type: "Multi Tile", source: _self.settings.routeProperties.source});
  });
