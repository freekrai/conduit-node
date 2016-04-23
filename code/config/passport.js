var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var mongoose = require('mongoose');
var User = mongoose.model('User');

passport.serializeUser(function(user, cb) {
	cb(null, user.id);
});

passport.deserializeUser(function(id, cb) {
	User.findById(id, function (err, user) {
		if (err) { return cb(err); }
		cb(null, user);
	});
});


passport.use(new LocalStrategy({
		usernameField: 'email',
		passwordField: 'password'
	},
	function(email, password, done) {
			User.findOne({ email: email }, function (err, user) {
			if (err) { return done(err); }
			if (!user) {
				return done(null, false, { message: 'Incorrect username.' });
			}
			if (!user.validPassword(password)) {
				return done(null, false, { message: 'Incorrect password.' });
			}
			return done(null, user);
		});
	}
));