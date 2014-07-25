//nonsensitiveSettings.js is part of the repository.
//passwords and sensitive settings are in settings.js
var nonsensitiveSettings = {};

nonsensitiveSettings.pg = {};
nonsensitiveSettings.application = {};
nonsensitiveSettings.tilestream = {};

nonsensitiveSettings.tilestream.host = "54.212.254.185";
nonsensitiveSettings.tilestream.path = "/api/Tileset";
nonsensitiveSettings.tilestream.port = "8888";

//Should the API display postgres views?
nonsensitiveSettings.displayViews = true;

//Should the API display postgres tables?
nonsensitiveSettings.displayTables = false;

//Should the API hide any postgres tables or views?
nonsensitiveSettings.pg.noFlyList = ["att_0"];

//The list of formats to be returned by the Table Query REST endpoint.  If ogr2ogr is installed, .shp will be added automatically.
nonsensitiveSettings.application.formatList =[ 'html', 'GeoJSON', 'esriJSON'];

//Where to write out TopoJSON files?
nonsensitiveSettings.application.topoJsonOutputFolder = "/public/topojson/output/";

//Where to write out GeoJSON files?
nonsensitiveSettings.application.geoJsonOutputFolder = "/public/geojson/output/";

//Optional.  If you're using port forwarding or URL rewriting, but need to display full URLs to your assets, this will stand in for the host.
nonsensitiveSettings.application.publichost = ""; //Keep this empty if you want to use the default host
nonsensitiveSettings.application.publicport = "80";


//The lowest administrative level for each datasource
nonsensitiveSettings.dsLevels = {};
nonsensitiveSettings.dsLevels["gadm"] = 5;
nonsensitiveSettings.dsLevels["gaul"] = 2;
nonsensitiveSettings.dsLevels["naturalearth"] = 1;
nonsensitiveSettings.dsLevels["local"] = 2;

//Columns by level and datasource
nonsensitiveSettings.dsColumns = {};

//Used to define how to query DB for admin stack
//Columns aliased to be consistent between data sources.
//GADM
nonsensitiveSettings.dsColumns["gadm0"] = { geometry: "ST_AsGeoJSON(geom_simplify_high) as geom,", columns: "guid as stack_guid, id_0 as adm0_code, name_0 as adm0_name, ST_AsText(ST_Centroid(geom)) as centroid, 0 as level" };
nonsensitiveSettings.dsColumns["gadm1"] = { geometry: "ST_AsGeoJSON(geom_simplify_high) as geom,", columns: "guid as stack_guid, id_0 as adm0_code, name_0 as adm0_name, id_1 as adm1_code, name_1 as adm1_name, ST_AsText(ST_Centroid(geom)) as centroid, 1 as level" };
nonsensitiveSettings.dsColumns["gadm2"] = { geometry: "ST_AsGeoJSON(geom_simplify_high) as geom,", columns: "guid as stack_guid, id_0 as adm0_code, name_0 as adm0_name, id_1 as adm1_code, name_1 as adm1_name, id_2 as adm2_code, name_2 as adm2_name, ST_AsText(ST_Centroid(geom)) as centroid, 2 as level" };
nonsensitiveSettings.dsColumns["gadm3"] = { geometry: "ST_AsGeoJSON(geom_simplify_high) as geom,", columns: "guid as stack_guid, id_0 as adm0_code, name_0 as adm0_name, id_1 as adm1_code, name_1 as adm1_name, id_2 as adm2_code, name_2 as adm2_name, id_3 as adm3_code, name_3 as adm3_name, ST_AsText(ST_Centroid(geom)) as centroid, 3 as level" };
nonsensitiveSettings.dsColumns["gadm4"] = { geometry: "ST_AsGeoJSON(geom_simplify_high) as geom,", columns: "guid as stack_guid, id_0 as adm0_code, name_0 as adm0_name, id_1 as adm1_code, name_1 as adm1_name, id_2 as adm2_code, name_2 as adm2_name, id_3 as adm3_code, name_3 as adm3_name, id_4 as adm4_code, name_4 as adm4_name, ST_AsText(ST_Centroid(geom)) as centroid, 4 as level" };
nonsensitiveSettings.dsColumns["gadm5"] = { geometry: "ST_AsGeoJSON(geom_simplify_high) as geom,", columns: "guid as stack_guid, id_0 as adm0_code, name_0 as adm0_name, id_1 as adm1_code, name_1 as adm1_name, id_2 as adm2_code, name_2 as adm2_name, id_3 as adm3_code, name_3 as adm3_name, id_4 as adm4_code, name_4 as adm4_name, id_5 as adm5_code, name_5 as adm5_name, ST_AsText(ST_Centroid(geom)) as centroid, 5 as level" };

module.exports = nonsensitiveSettings;