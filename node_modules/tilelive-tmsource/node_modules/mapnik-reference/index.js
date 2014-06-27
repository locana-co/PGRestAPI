var fs = require('fs'),
    path = require('path');

// Load all stated versions into the module exports
module.exports.version = {};

var refs = [
 '2.0.0',
 '2.0.1',
 '2.0.2',
 '2.1.0',
 '2.1.1',
 '2.2.0',
 '2.3.0',
 'latest'
];

refs.map(function(version) {
    module.exports.version[version] = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, version, 'reference.json'), 'utf8'));
    if (version === 'latest') {
        module.exports.version[version].datasources = JSON.parse(
            fs.readFileSync(
                path.join(__dirname, version, 'datasources.json'), 'utf8')).datasources;
    }
});
