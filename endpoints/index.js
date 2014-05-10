/**
 * Created by ryanwhitley on 5/2/14.
 */
//Load all of the modules in endpoints folder
    //Not complete - not functioning.
var common = require("../common");

var Endpoints = { modules: {} };

//Dynamically load Query or Geoprocessing Options from the plugin folder.

common.getFilesRecursively(__dirname, function(results){
    results.forEach(function(item){
        if (item.file == "index.js") {
            var module = require(__dirname + "/" + item.fullPath);
            Endpoints.modules.push(module);
        }
    });
});

module.exports = Endpoints;