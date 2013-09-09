
/*
 * Load all routes in routes folder
 */

exports.attachHandlers = function attachHandlers(server) {

    require('./posts')(server);

};