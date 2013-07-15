var assert = require('chai').assert;
var routes = require('../routes');

suite('Routes', function(){
	test("index route is defined", function(){
	assert.isDefined(routes.index);
})
})