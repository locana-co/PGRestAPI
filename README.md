PGRestAPI (a.k.a. Chubbs Spatial Server)
=========

![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/logo.png "Logo")

## Overview

Node.js REST API for PostgreSQL Spatial Entities.

Point it at your instance of PostgreSQL and PostGIS,
and you'll get a REST API that supports:
* Dynamic Tiled Map Services for spatial tables and views using Mapnik (Not for Windows installs, yet)
* RESTful Query endpoint for each table and view - return GeoJSON and esriJSON.  Supports spatial and tabular queries and aggregation.
* Geoprocessing Framework - (You still have to know how to write PostGIS logic, but...), with dynamic tiled maps available as output.
* Reflection of TileStream API
* TopoJSON file creation for each table or view

Express, Jade and general structure based on:
Project is structured based on http://www.bearfruit.org/2013/06/21/start-a-new-node-js-express-app-the-right-way/

##Installation

* [Ubuntu 12 and 13](/docs/Ubuntu_Install.md)
* [Windows](/docs/Windows_Install.md)
* [OSX](/docs/OSX_Install.md)

## Dependencies

* PostgreSQL 9.1 + w/ PostGIS 2.0 +
* topojson
* [Mapnik](https://github.com/mapnik/mapnik)

##Screenshots


###Table/View List:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/tablelist.png "Table List Screen")

###Table Details:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/tabledetail.png "Table List Screen")

###Query Endpoint:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/query.png "Query Endpoint")

###Query Endpoint Results:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/query2.png "Query Endpoint Results")

###Dynamic Service Endpoint:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/dynamic.png "Dynamic Map endpoint")

###WKT Preview endpoint - Buffer:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/WKTPreview.png "WKT Preview")

###Raster Operations - Zonal Statistics:
![alt text](https://raw.github.com/spatialdev/PGRestAPI/master/docs/screens/raster.png "Raster Zonal Statistics")
