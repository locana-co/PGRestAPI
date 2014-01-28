//////////Authentication


//Express, Common and settings should be used by all sub-modules
var express = require('express'),
    common = require("../../common"),
    settings = require('../../settings');

//Module-specific requires:
var path = require('path'),
    fs = require("fs"),
    flow = require('flow'),
    passport = require("passport"),
	LocalStrategy = require('passport-local').Strategy,
	FacebookStrategy = require('passport-facebook').Strategy,
	mongoose = require('mongoose');
    
var app = exports.app = express();

//Start mongoose
mongoose.connect('mongodb://localhost/test');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  
	var LocalUserSchema = new mongoose.Schema({
		username: String,
		salt: String,
		hash: String
	});
	
	var Users = mongoose.model('userauths', localUserSchema);
	
	var FacebookUserSchema = new mongoose.Schema({
	    fbId: String,
	    email: { type : String , lowercase : true},
	    name : String
	});
	var FbUsers = mongoose.model('fbs',FacebookUserSchema);

});

exports.createCachedFolder = function (table) {
    var folder = './public/cached_nodetiles/' + table;
    //create a folder for this table in public/cached_nodetiles if it doesn't exist
    fs.exists(folder, function (exists) {
        if (exists === false) {
            //make it
            console.log("Didn't find cache folder.  Tyring to make folder: " + folder);
            fs.mkdir(folder, function () {
                console.log("Made " + folder);
            }); //Synch
        }
    });
}
