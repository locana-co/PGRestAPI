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
	//BearerStrategy = require('passport-http-bearer').Strategy,
    ForceDotComStrategy = require('passport-forcedotcom').Strategy;
    

exports.passport = function () {

    // Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Salesforce profile is
//   serialized and deserialized.
    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    passport.deserializeUser(function(obj, done) {
        done(null, obj);
    });

    passport.use(new ForceDotComStrategy({
        clientID: settings.salesforce.ConsumerKey,
        clientSecret: settings.salesforce.ClientSecret,
        scope: settings.salesforce.Scope,
        callbackURL: settings.salesforce.CallbackURL,
        authorizationURL: settings.salesforce.authorizationURL,
        tokenURL: settings.salesforce.tokenURL
    }, function verify(token, refreshToken, profile, done) {
        console.log(profile);
        return done(null, profile);
    }));

    return passport;
}
