PGRestAPI
=========

## Overview

Node.js REST API for PostGres Spatial Entities.

Point the settings file at your instance of PostGres and PostGIS.

You'll get a REST API that supports:
* Dynamic Tiled Map Services for spatial tables and views
* RESTful Query endpoint for each table and view - return GeoJSON and esriJSON.  Supports spatial and tabular queries and aggregation.
* Geoprocessing Framework - (You still have to know how to write PostGIS logic, but...), with dynamic tiled maps available as output.
* Reflection of TileStream API
* TopoJSON file creation for each table or view

Express, Jade and general structure based on:
Project is structured based on http://www.bearfruit.org/2013/06/21/start-a-new-node-js-express-app-the-right-way/

## Dependencies

* PostGres 9.1 + w/ PostGIS 2.0 +
* topojson
* Cairo - You need to [download](http://www.gtk.org/download/index.php) and install Cairo in order to use the [nodetiles](https://github.com/nodetiles/nodetiles-core) dynamic tile rendering functionality.
* nodetiles-core (on Windows, cloned and built on it's own, then copied to PGRestAPI/node_modules folder)
* nodetiles-postgis (on Windows, cloned and copied to PGRestAPI/node_modules folder.  navigate to the nodetiles_postgis foder, then npm install)

##Screenshots



![alt text](http://173.201.28.147/pgRESTAPI/chubbs.JPG "Lunch in Ballard")
