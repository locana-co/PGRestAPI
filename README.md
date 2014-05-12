PGRestAPI (a.k.a. Chubbs Spatial Server)
=========

![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/logo.png "Logo")

## Overview

Node.js REST API for PostgreSQL Spatial Entities.

Point it at your instance of PostgreSQL and PostGIS,
and you'll get a REST API that supports:
* Dynamic Tiled Map Services for spatial tables using Mapnik (Not for Windows installs, yet)
* Dynamic Vector Tile Services for spatial tables using Mapnik (Not for Windows installs, yet)
* RESTful Query endpoint for each table and view - return GeoJSON, esriJSON or Shapefile.  Supports spatial and tabular queries and aggregation.
* Geoprocessing Framework - (You still have to know how to write PostGIS logic, but...), with dynamic tiled maps available as output.
* Route Caching for .pngs
* Admin panel (/admin) to show tile generation statistics and cache size
* Shapefile List (/shapefiles) to display shapefiles being served as map services

Utilities:
* WKT Previewer

Under development:
* GeoJSON to .png endpoint
* Better caching for different endpoints
* In-memory map services (Loads a Shapefile into memory for faster response times. Drop shapefiles into endpoints/mapnik/data/inmemory-shapefiles)
* Raster map services (Drop a .tif into endpoints/mapnik/data/rasters)
* Shapefile map services ((Drop shapefiles into endpoints/mapnik/data/shapefiles)
* Datablaster - Sort of an ETL to pregenerate .json/.geojson files for use in your applications (similar to how Jeckyll produces HTML/CSS/Javascirpt)
* Authentication with passport/MongoDB/Mongoose (Disabled for now)
* Vector Tiles endpoint for serving .tm2 or .mbtiles sources (not working yet)

More To-Dos:
* CartoCSS to Mapnik XML parser (Carto module)
* Persistent caching
* Administrative Panel


Express, Jade and general structure based on:
Project is structured based on http://www.bearfruit.org/2013/06/21/start-a-new-node-js-express-app-the-right-way/

##Installation

* [Ubuntu 12/13/14](/docs/Ubuntu_Install.md)
* [Windows](/docs/Windows_Install.md)
* [OSX](/docs/OSX_Install.md)

## Dependencies

* PostgreSQL 9.1 + w/ PostGIS 2.0 +
* [Mapnik](https://github.com/mapnik/mapnik)

##Screenshots


###Table/View List:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/TableList.png "Table List Screen")

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
