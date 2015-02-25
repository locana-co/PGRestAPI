PGRestAPI - Vector Tiles
=========

During the evolution of this project, Mapbox Vector Tiles have emerged as a compact and quick way to deliver large amounts of geographic data to the browser.

Focus changed from GeoJSON to supporting Vector Tile output.

PGRestAPI supports Vector Tiles in the following ways:

* On-the-fly tile creation from PostGIS tables or shapefiles
* Serving of .mbtiles exports from Mapbox Studio/TileMill 2

Our client side Leaflet library ([Leaflet.MapboxVectorTile](https://github.com/SpatialServer/Leaflet.MapboxVectorTile)) consumes these vector tiles and renders them in Canvas on top of Leaflet.

They also will work with [MapboxGL](https://www.mapbox.com/mapbox-gl/)

# Creating Vector Tiles dynamically from PostGIS

PostGIS tables with geometry columns (with SRID 4326 or 3857) are sniffed out on startup, and dynamic endpoints created for each.
If a single table has more than 1 geometry column, a vector tiles endpoint will be created for each column.

After [installation](https://github.com/spatialdev/PGRestAPI#installation), specify your Postgres connection settings in the settings/settings.js file.

** Example dynamic PostGIS Vector Tile URL

	http://spatialserver.spatialdev.com/services/tables/india_urbanareas/geom/vector-tiles

The form of the URL is http://<host>/services/tables/<table_name>/<geometry column name>/vector-tiles.


To consume this endpoint in Leaflet using the ([Leaflet.MapboxVectorTile](https://github.com/SpatialServer/Leaflet.MapboxVectorTile)) library,
provide this url `http://spatialserver.spatialdev.com/services/postgis/india_urbanareas/geom/vector-tiles/{z}/{x}/{y}.pbf` to the MVTSource [config object](https://github.com/SpatialServer/Leaflet.MapboxVectorTile/blob/master/docs/configuration.md#config).


Note: By default, dynamic vector tile endpoints pulling from PostGIS *only* pulls the geometry column, and the resulting .pbf (vector tile) will contain NO properties/attributes.

# Specifying additional properties to be pulled from PostGIS

When vector tiles get cut from PostGIS, you can optionally specify more postgres columns to come along for the ride and be returend as properties in the vector tile.

To do this, alter the querystring in the vector tile URL to add `?fields=foo`

This is a comma separated list of fields you wish to return as properties in the vector tile.

Example of specifying the columns `gid` and `landuse` to be added to the properties of the vector tile:

	`http://spatialserver.spatialdev.com/services/postgis/india_urbanareas/geom/vector-tiles/{z}/{x}/{y}.pbf?fields=gid,landuse`

# Filtering PostGIS tables on-the-fly

It is also possible to append a `where` querystring to the end of the url to specify a SQL where clause.

Example of specifying a where clause to cut down the number of features returned in the vector tile:

	`http://spatialserver.spatialdev.com/services/postgis/india_urbanareas/geom/vector-tiles/{z}/{x}/{y}.pbf?where=gid%3d5`

This translates to the where clause `WHERE gid=5`.  Only feature(s) where gid equals 5 will be returned.

Note - This should be used sparingly, or in conjunction with a cache (like an NGINX reverse proxy cache) as to not overwhelm the database with requests. (Remember, the database executes the same query for every tile requested).


# Pre-created .mbtiles Mapbox Vector Tiles from Mapbox Studio

In order to reduce strain on the DB, or if you don't feel like implementing a caching scheme, or if your data doesn't change much (or for other reasons), you might consider just making your vector tiles up front using [Mapbox Studio](https://www.mapbox.com/mapbox-studio/#darwin).

The user interface is admittedly not the most intuitive, but we'll walk thru a few common scenarios to get you going.

Mapbox has some documentation regarding creating vector tiles from PostGIS in Mapbox Studio [here](https://www.mapbox.com/mapbox-studio/postgis-manual/)

You can also create vector tiles up front from Shapefiles or other data sources.

# Serving pre-created .mbtiles

After you've created and exported your .mbtiles file, copy/paste or otherwise move the file into data/pbf_mbtiles folder in your PGRestAPI install.

Restart the node app.

A list of .mbtile files and corresponding endpoints will be available at `http://<your_deal>/services/vector-tiles`




