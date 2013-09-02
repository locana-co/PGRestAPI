//8.31.2013 - Ryan Whitley
//Starting a Plug and Play GP Workflow

//names is an array of operation names.  Used to list possible operations
//Use the name as a key to look up the full operation module from the operations object.
//Example: GP.operations["Buffer"]

var GP = { operations: {}, names: [] };

//Dynamically load Query or Geoprocessing Options from the plugin folder.
require("fs").readdirSync(__dirname).forEach(function (file) {
    if (file != "index.js" && file != "GeoOperation.js.example") {
        var operation = require(__dirname + "/" + file);
        GP.names.push(operation.name);
        GP.operations[operation.name] = operation;
    }
});


module.exports = GP;