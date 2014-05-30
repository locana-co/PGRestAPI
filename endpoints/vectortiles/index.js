//////////Vector Tiles////////////

//Express, Common and settings should be used by all sub-modules
var express = require('express'), common = require("../../common"), settings = require('../../settings');

//These next requires are specific to this module only
var path = require('path'), flow = require('flow');

var zlib = require('zlib');
var crypto = require('crypto');
var tilelive = require('tilelive');
if (tilelive) {
	require("tilelive-tmsource")(tilelive);
	require("mbtiles").registerProtocols(tilelive);
}


exports.app = function(passport) {
	var app = express();

	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');

	var mbtilesLocation = __dirname + "/mbtiles";
	var mbTileFiles = [];

	//Load mbtiles from mbtiles folder.
	require("fs").readdirSync(mbtilesLocation).forEach(function(file) {
		var ext = path.extname(file);
		if (ext == ".mbtiles") {
			mbTileFiles.push(file);
		}
	});

	//Show List of each .mbtiles file
	app.all('/services/vector-tiles', function(req, res) {

		var args = {};
		args.view = "vector_tile_list";
		args.breadcrumbs = [{
			link : "/services/tables",
			name : "Home"
		}, {
			link : "",
			name : "Vector Tiles List"
		}];
		args.url = req.url;
		args.opslist = [];

		if (mbTileFiles && mbTileFiles.length > 0) {
			mbTileFiles.forEach(function(item) {
				args.opslist.push({
					name : item,
					link : "dataset?name=" + item
				});
			});
		}

		//Render HTML page with results at bottom
		common.respond(req, res, args);

	});

	//Create endpoint for mbtiles server, 1 for each source
	mbTileFiles.forEach(function(filename) {

			tilelive.load('mbtiles://' + path.join(mbtilesLocation,filename), function(err, source) {
                if (err)
                    throw err;
                app.get('/services/vector-tiles/' + filename.split('.')[0] + '/:z/:x/:y.*', function (req, res) {
                    source.getTile(req.param('z'), req.param('x'), req.param('y'), function (err, tile, headers) {
                        // `err` is an error object when generation failed, otherwise null.
                        // `tile` contains the compressed image file as a Buffer
                        // `headers` is a hash with HTTP headers for the image.
                        if (!err) {
                            res.setHeader('content-encoding', 'deflate');
                            res.setHeader('content-type', 'application/octet-stream');
                            res.send(tile);
                        } else {
                            res.send('Tile rendering error: ' + err + '\n');
                        }
                    });
                });

            });

	});

	//Show example of how to all this dataset
	app.all('/services/vector-tiles/dataset', flow.define(function(req, res) {
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
			this.args.breadcrumbs = [{
				link : "/services/tables",
				name : "Home"
			}, {
				link : "/services/vector-tiles",
				name : "Vector Tiles List"
			}, {
				link : "",
				name : "Vector Tile dataset"
			}];
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
				this.args.breadcrumbs = [{
					link : "/services/tables",
					name : "Home"
				}, {
					link : "/services/vector-tiles",
					name : "Vector Tiles List"
				}, {
					link : "",
					name : "Vector Tile dataset"
				}];
				this.args.errorMessage = "Must include parameter name";
				this.args.url = req.url;
				common.respond(this.req, this.res, this.args);
			}

		} else {
			//Page initial load.  No results
			this.args.view = "dataset";
			this.args.breadcrumbs = [{
				link : "/services/tables",
				name : "Home"
			}, {
				link : "/services/vector-tiles",
				name : "Vector Tiles List"
			}, {
				link : "",
				name : "Vector Tile dataset"
			}];
			this.args.url = req.url;
			common.respond(this.req, this.res, this.args);
		}

	}));

	return app;
};
