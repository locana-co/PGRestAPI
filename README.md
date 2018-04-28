PGRestAPI (a.k.a. Chubbs Spatial Server)
=========

[![Join the chat at https://gitter.im/spatialdev/PGRestAPI](https://badges.gitter.im/spatialdev/PGRestAPI.svg)](https://gitter.im/spatialdev/PGRestAPI?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/logo.png "Logo")

## Overview

Node.js REST API for PostgreSQL Spatial Tables.

An introduction to PGRestAPI can be found [here](https://github.com/spatialdev/PGRestAPI/blob/master/docs/Intro_PGRestAPI.pdf)

A few key uses for PGRestAPI:

* Create [Mapbox Vector Tiles](https://github.com/mapbox/vector-tile-spec) on the fly from PostGIS or shapefiles.  [_more..._](docs/VectorTiles.md)
* Serve pre-created Vector Tiles .mbtiles files
* Serve pre-created PNG .mbtiles files (like TileStream)
* REST API for querying Postgres tables - Supports spatial intersection, tabular queries and aggregation queries
* REST API returns GeoJSON, CSV, Shapefile or esriJSON
* Templates for creating custom web service endpoints - (Execute custom SQL functions, for example)
* Rasters in PostGIS offer basic intersect operations and zonal stats.  Find sum of raster values that intersect a polygon, for example.


Utilities:
* WKT Previewer
* Server side proxy - support requests to servers that don't support CORS

Under development:
* Better caching for different endpoints

* Raster map services (Drop a .tif into data/rasters)

* Authentication with passport/MongoDB/Mongoose (Disabled for now)


More To-Dos:
* Update Express and other libraries to current versions
* More tests
* Major refactoring of endpoints folder
* Break up endpoint functionality into modules
* Persistent caching
* Administrative Panel
* Editing

Soon will drop:
* PNG image creation from PostGIS Tables
* CartoCSS to Mapnik XML parser (Carto module) (this actually works, but is not used by our team)


##Installation

* [Ubuntu 12/13/14](/docs/Ubuntu_Install.md)
* [Windows](/docs/Windows_Install.md)
* [OSX](/docs/OSX_Install.md)

## Dependencies

* PostgreSQL 9.1 + w/ PostGIS 2.0 +
* [Mapnik](https://github.com/mapnik/mapnik)

##Screenshots


###Table/View List:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/tablelist.png "Table List Screen")

###Table Details:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/2Table_Details.png "Table List Screen")

###Query Endpoint:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/3TableQuery.png "Query Endpoint")

###Query Endpoint Results:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/4TableQueryResult.png "Query Endpoint Results")

###Dynamic Map Tile Service Endpoint:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/5MapTiles.png "Dynamic Map endpoint")

###Dynamic Vector Tile Endpoint:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/6VectorTiles.png "Dynamic Vector Tile endpoint")

###Geoprocessing Operations:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/7GeoprocessingList.png "List of operations")

###Geoprocessing Operation:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/8GeoprocessingEndpoint.png "Single operation")

###Utililties - WKT Preview endpoint:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/9WKTPreview.png "WKT Preview")

###Raster Operations List:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/10RasterOperations.png "Raster Operation List")

###Raster Operations - Zonal Statistics:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/11RasterOperation.png "Raster Zonal Statistics")

###Tile Rendering Stats (/admin):
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/14Admin.png "Tile Stats")
