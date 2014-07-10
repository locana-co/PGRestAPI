//Express, Common and settings should be used by all sub-modules
var express = require('express'), common = require("../../common"), settings = require('../../settings');

//These next requires are specific to this module only
var path = require('path'), flow = require('flow');

var tilelive = require('tilelive');
var MMLBuilder = require("../tiles/cartotomml/mml_builder");
var fs = require("fs");
if (tilelive) {
  tilelive.protocols['mbtiles:'] = require('mbtiles');
}


exports.app = function (passport) {
  var app = express();

  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');

  //Show List of each .mbtiles file
  app.all('/services/vector-tiles', function (req, res) {

    var args = {};
    args.view = "vector_tile_list";
    args.breadcrumbs = [
      {
        link: "/services/tables",
        name: "Home"
      },
      {
        link: "",
        name: "Vector Tiles List"
      }
    ];
    args.url = req.url;
    args.opslist = [];

    if (mbTileFiles && mbTileFiles.length > 0) {
      mbTileFiles.forEach(function (item) {
        args.opslist.push({
          name: item,
          link: "dataset?name=" + item
        });
      });
    }

    //Render HTML page with results at bottom
    common.respond(req, res, args);
  });

  //Show example of how to all this dataset
  app.all('/services/vector-tiles/dataset', flow.define(function (req, res) {
    this.args = {};
    this.req = req;
    this.res = res;

    //Grab POST or QueryString args depending on type
    if (req.method.toLowerCase() == "post") {
      //If a post, then arguments will be members of the this.req.body property
      this.args = req.body;
    } else if (req.method.toLowerCase() == "get") {
      //If request is a get, then args will be members of the this.req.query property
      this.args = req.query;
    }

    if (JSON.stringify(this.args) != '{}') {
      //User passed in some args.
      this.args.view = "dataset";
      this.args.breadcrumbs = [
        {
          link: "/services/tables",
          name: "Home"
        },
        {
          link: "/services/vector-tiles",
          name: "Vector Tiles List"
        },
        {
          link: "",
          name: "Vector Tile dataset"
        }
      ];
      this.args.url = req.url;
      this.args.path = this.req.path;
      this.args.host = this.req.headers.host;

      if (this.args.name) {
        //The name of the mbtiles dataset
        this.args.description = "";
        this.args.requestSample = ((req.secure ? "https:" : "http:") + "//" + this.args.host + this.args.path + "/{z}/{x}/{y}.pbf").replace("/dataset/", "/" + this.args.name.split(".")[0] + "/");
        common.respond(this.req, this.res, this.args);
      } else {
        this.args.view = "dataset";
        this.args.breadcrumbs = [
          {
            link: "/services/tables",
            name: "Home"
          },
          {
            link: "/services/vector-tiles",
            name: "Vector Tiles List"
          },
          {
            link: "",
            name: "Vector Tile dataset"
          }
        ];
        this.args.errorMessage = "Must include parameter name";
        this.args.url = req.url;
        common.respond(this.req, this.res, this.args);
      }

    } else {
      //Page initial load.  No results
      this.args.view = "dataset";
      this.args.breadcrumbs = [
        {
          link: "/services/tables",
          name: "Home"
        },
        {
          link: "/services/vector-tiles",
          name: "Vector Tiles List"
        },
        {
          link: "",
          name: "Vector Tile dataset"
        }
      ];
      this.args.url = req.url;
      common.respond(this.req, this.res, this.args);
    }

  }));

  loadPBFMBTilesRoutes(app);

  loadPNGMBTilesRoutes(app);

  return app;
};


function loadPNGMBTilesRoutes(app){
  var PNGmbtilesLocation = path.join(__dirname, "../../data/png_mbtiles");
  var PNGmbTileFiles = [];

  //Load mbtiles from mbtiles folder.
  require("fs").readdirSync(PNGmbtilesLocation).forEach(function (file) {
    var ext = path.extname(file);
    if (ext == ".mbtiles") {
      PNGmbTileFiles.push(file);
    }
  });

  //Create endpoint for mbtiles server, 1 for each source
  PNGmbTileFiles.forEach(function (filename) {

    var PNGroute = ""; //store the route name

    var mbtilespath = 'mbtiles://' + path.join(PNGmbtilesLocation, filename);

    tilelive.load(mbtilespath, function (err, source) {
      if (err)
        throw err;

      PNGroute = '/services/tiles/' + filename.split('.')[0] + '/:z/:x/:y.png';

      app.get(PNGroute, function (req, res) {
        source.getTile(req.param('z'), req.param('x'), req.param('y'), function (err, tile, headers) {
          // `err` is an error object when generation failed, otherwise null.
          // `tile` contains the compressed image file as a Buffer
          // `headers` is a hash with HTTP headers for the image.
          res.setHeader('content-type', 'image/png');
          if (!err) {
            res.send(tile);
          } else {
            res.send("problem.");
          }
        });
      });

      console.log("Created PNG .mbtiles service: " + PNGroute);

    });
  });
}

function loadPBFMBTilesRoutes(app){
  var mbtilesLocation = path.join(__dirname, "../../data/pbf_mbtiles");
  var mbTileFiles = [];

  //Load mbtiles from mbtiles folder.
  require("fs").readdirSync(mbtilesLocation).forEach(function (file) {
    var ext = path.extname(file);
    if (ext == ".mbtiles") {
      mbTileFiles.push(file);
    }
  });

  //Create endpoint for mbtiles server, 1 for each source
  mbTileFiles.forEach(function (filename) {

    var PBFroute = ""; //store the route name

    var mbtilespath = 'mbtiles://' + path.join(mbtilesLocation, filename);

    tilelive.load(mbtilespath, function (err, source) {
      if (err)
        throw err;

      PBFroute = '/services/vector-tiles/' + filename.split('.')[0] + '/:z/:x/:y.pbf';

      app.get(PBFroute, function (req, res) {
        source.getTile(req.param('z'), req.param('x'), req.param('y'), function (err, tile, headers) {
          // `err` is an error object when generation failed, otherwise null.
          // `tile` contains the compressed image file as a Buffer
          // `headers` is a hash with HTTP headers for the image.
          res.setHeader('content-type', 'application/octet-stream');
          if (!err) {
            res.setHeader('content-encoding', 'deflate');
            res.send(tile);
          } else {
            res.send(new Buffer(''));
          }
        });
      });

      console.log("Created PBF .mbtiles service: " + PBFroute);

    });
  });

}

//Experiments.
function loadTM2ZSources(){

  var tm2zLocation = __dirname + "/tm2z";
  var tm2zFiles = [];

  //Load mbtiles from mbtiles folder.
  require("fs").readdirSync(tm2zLocation).forEach(function (file) {
    var ext = path.extname(file);
    if (ext == ".tm2z") {
      tm2zFiles.push(file);
    }
  });

  tm2zFiles.forEach(function (filename) {

    var tm2zpath = 'tm2z://' + path.join(tm2zLocation, filename);

    tilelive.load(tm2zpath, function (err, source) {
      if (err)
        throw err;

      //Handle PNG requests.
      var PNGroute = '/services/vector-tiles/' + filename.split('.')[0] + '/:z/:x/:y.png';

      app.get(PNGroute, function (req, res) {
        source.getTile(req.param('z'), req.param('x'), req.param('y'), function (err, tile, headers) {
          // `err` is an error object when generation failed, otherwise null.
          // `tile` contains the compressed image file as a Buffer
          // `headers` is a hash with HTTP headers for the image.
          if (!err) {

            res.setHeader('content-type', 'image/png');
            res.send(tile);
          } else {
            res.send('Tile rendering error: ' + err + '\n');
          }
        });
      });
      console.log("Created PNG .mbtiles service: " + PNGroute);
    });
  });


}

function getDefaultStyle(cb){

  //Set the path to the style file
  var fullpath =  path.join(__dirname, "default.mss");

  //Save the flow
  var flo = this;

  //See if there is a <name>.xml file for this table.
  fs.stat(fullpath, function (err, stat) {
    if (err) {
      //No file.  Use defaults.
      //fullpath = path.join(_stylepath, _defaultMSS);
    }

    //Read the file and pass the contents to the next function
    fs.readFile(fullpath, 'utf8', function(err, styleString){
      //CartoCSS Converter
      var optional_args = {};
      optional_args.cachedir = '/tmp/millstone';

      //Convert mss to XML
      var MMLConverter = new MMLBuilder({ table: "default"}, optional_args, function(err, payload){});
      MMLConverter.render(styleString, function(err, mmlStylesheet){

        MMLConverter.stripLayer(mmlStylesheet, function(err, converted){
          cb(converted);
        });

      });
    });

  });
}