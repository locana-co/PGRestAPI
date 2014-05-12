/**
 * Created by ryanwhitley on 5/2/14.
 */
/** From Windshaft project (https://github.com/CartoDB/Windshaft) ...*/
#!/usr/bin/env node

var _ = require('underscore');
var PGRestAPI = require('../../app.js');


// Force 'test' environment
var ENV = 'test';

// set environment specific variables
global.settings     = require('../../config/settings');
global.environment  = require('../../config/environments/' + ENV);
_.extend(global.settings, global.environment);

var ServerOptions = require('../support/server_options.js');

// drop redis connections after 1 second of idle time
ServerOptions.redis.idleTimeoutMillis = 1000;
ServerOptions.redis.reapIntervalMillis = ServerOptions.redis.idleTimeoutMillis;

var server = new Windshaft.Server(ServerOptions);

// it takes up to 15 file descriptors to support 1 connection
// the default limit on file descriptors per process is 1024
// so we allow max 68 connections (this is just an indication
// and only applies on the code of 29 Jan 2013)
//
server.maxConnections = 68;
server.listen(global.environment.windshaft_port);
console.log("Windshaft tileserver started on port " + global.environment.windshaft_port);

// kill -USR1 <test_server_pid> to dump cache stats
process.on('SIGUSR1', function() {
    server.dumpCacheStats();
});