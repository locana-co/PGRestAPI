var mongoose = require('mongoose'), LocalStrategy = require('passport-local').Strategy, FacebookStrategy = require('passport-facebook').Strategy, BearerStrategy = require('passport-http-bearer').Strategy
//,    GoogleStrategy = require('passport-google-oauth').OAuth2Strategy
, User = mongoose.model('User');

module.exports = function(passport, config) {

	passport.serializeUser(function(user, done) {
		done(null, user.id);
	});

	passport.deserializeUser(function(id, done) {
		User.findOne({
			_id : id
		}, function(err, user) {
			done(err, user);
		});
	});

	passport.use(new LocalStrategy({
		usernameField : 'email',
		passwordField : 'password'
	}, function(email, password, done) {
		User.isValidUserPassword(email, password, done);
	}));

	passport.use(new FacebookStrategy({
		clientID : config.facebook.clientID,
		clientSecret : config.facebook.clientSecret,
		callbackURL : config.facebook.callbackURL
	}, function(accessToken, refreshToken, profile, done) {
		profile.authOrigin = 'facebook';
		User.findOrCreateOAuthUser(profile, function(err, user) {
			return done(err, user);
		});
	}));

	// Use the BearerStrategy within Passport.
	//   Strategies in Passport require a `validate` function, which accept
	//   credentials (in this case, a token), and invoke a callback with a user
	//   object.
	passport.use(new BearerStrategy({

	}, function(token, done) {
		debugger;
		// asynchronous validation, for effect...
		process.nextTick(function() {

			// Find the user by token.  If there is no user with the given token, set
			// the user to `false` to indicate failure.  Otherwise, return the
			// authenticated `user`.  Note that in a production-ready application, one
			// would want to validate the token for authenticity.
			findByToken(token, function(err, user) {
				debugger;
				if (err) {
					return done(err);
				}
				if (!user) {
					return done(null, false);
				}
				return done(null, user);
			})
		});
	}));

	function findByToken(token, fn) {
		for (var i = 0, len = users.length; i < len; i++) {
			debugger;
			var user = users[i];
			if (user.token === token) {
				return fn(null, user);
			}
		}
		return fn(null, null);
	}
	
	//For development
	var users = [
    	{ id: 1, username: 'bob', token: '123456789', email: 'bob@example.com' },
    	{ id: 2, username: 'joe', token: 'abcdefghi', email: 'joe@example.com' }
	];

}