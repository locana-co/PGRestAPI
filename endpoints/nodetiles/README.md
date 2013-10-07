Nodetiles-init
================

This is an example webserver for use with the **[nodetiles-core](http://github.com/nodetiles/nodetiles-core)** library, a fully-featured map rendering library for Node.js. This code is meant to be a convenient starting place for using Nodetiles to build a slippy-map &mdash; including Leaflet, Wax, and default asset/image routes &mdash; but is by no means only way to use the nodetiles-core library.

![Screenshot of nodetiles-server](https://raw.github.com/nodetiles/nodetiles-init/master/screenshot.png)

Installation
-------------

After downloading, be sure to install the dependencies (this may require installing cairo and pixman):

```bash
$ npm install
```

Then start the server:

```bash
$ node server.example.js
```

And visit the webpage: [http://localhost:3000](http://localhost:3000)

Configuration
-------------
This Nodetiles example can be easily configured by modifying the `node.server.js` file; the map configuration starts around `line 30`:

```javascript

// Create the new map
var map = new nodetiles.Map();

// Add a datasource named 'world" from the countries.geojson file
map.addData(new GeoJsonSource({ 
  name: "world",
  path: __dirname + '/map/data/countries.geojson', 
  projection: "EPSG:900913"
}));

// Add a 2nd geojson datasource
map.addData(new GeoJsonSource({ 
  name: "example",
  path: __dirname + '/map/data/example.geojson', 
  projection: "EPSG:4326"
}));

// Link to your Mapnik style sheet
map.addStyle(fs.readFileSync('./map/theme/style.mss','utf8'));

```

This data is then rendered into map tiles on-the-fly when the web map framework (Wax+Leaflet) make a GET request to the appropriate map tile URL: `/:row/:column/:zoom.png`.

You can easily add new GeoJSON files… or PostGIS files via the PostGIS data connector:

```javascript

map.addData(newPostGISSource({
  connectionString: "tcp://postgres@localhost/postgis", // required
  tableName: "ogrgeojson",                              // required
  geomField: "wkb_geometry",                            // required
  fields: "map_park_n, ogc_fid",                        // optional, speeds things up
  name: "sf_parks",                                     // optional, uses table name otherwise
  projection: 900913,                                   // optional, defaults to 4326
});

```

Data
----

example data
[Natural Earth](http://naturalearth.org)
projected to 900913 with [zipit](https://github.com/nvkelso/natural-earth-vector/blob/master/tools/make-web-mercator-900913-ready/zip-it.sh)

