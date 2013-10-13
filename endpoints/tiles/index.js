//////////Tiles////////////

//Express, Common and settings should be used by all sub-modules
var express = require('express'),
    common = require("../../common"),
    settings = require('../../settings');

//These next requires are specific to this module only
var http = require('http');

var app = module.exports = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

//If tilestream endpoint is provided
if (settings.tilestream && settings.tilestream.host && settings.tilestream.path) {
    //List All TileStream
    app.all('/services/tiles', function (req, res) {

        var args = {};

        //Grab POST or QueryString args depending on type
        if (req.method.toLowerCase() == "post") {
            //If a post, then arguments will be members of the this.req.body property
            args = req.body;
        }
        else if (req.method.toLowerCase() == "get") {
            //If request is a get, then args will be members of the this.req.query property
            args = req.query;
        }

        args.view = "tile_list";
        args.breadcrumbs = [{ link: "/services", name: "Home" }, { link: "/services", name: "Services" }, { link: "", name: "Tile List" }];
        args.path = req.path;
        args.host = req.headers.host;

        try {
            var options = {
                host: settings.tilestream.host,
                path: settings.tilestream.path
            };


            //add port if specified
            if (settings.tilestream.port) options.port = settings.tilestream.port;

            http.request(options, function (response) {
                var str = '';

                //another chunk of data has been recieved, so append it to `str`
                response.on('data', function (chunk) {
                    str += chunk;
                });

                //the whole response has been recieved, so we just print it out here
                response.on('end', function () {
                    var obj = JSON.parse(str);
                    //This is an array of tilestream layers.  break it apart so it's easier to parse for the UI
                    args.featureCollection = [];
                    obj.forEach(function (layer) {
                        args.featureCollection.push({ name: layer.name, preview: "http://" + settings.tilestream.host + ":" + (settings.tilestream.port ? settings.tilestream.port : 80) + "/#!/map/" + layer.name });
                    });

                    common.respond(req, res, args);

                });
            }).end();

        } catch (e) {
            common.respond(req, res, args);
        }
    });
}
