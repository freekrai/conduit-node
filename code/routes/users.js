var jwt = require('express-jwt');
var passport = require('passport');
var mongoose = require('mongoose');
var _ = require('underscore');
var Article = mongoose.model('Article');
var Comment = mongoose.model('Comment');
var User = mongoose.model('User');
var passport = require('passport');


module.exports = function(app) {
	//	our middleware to check if user is logged in or not by passed jwt token.
	var auth = jwt({
		secret: 'conduit', 
		userProperty: 'payload',
		getToken: function fromHeaderOrQuerystring (req) {
			if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
				return req.headers.authorization.split(' ')[1];
			}else if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Token') {
				return req.headers.authorization.split(' ')[1];
			} else if (req.query && req.query.token) {
				return req.query.token;
			}
			return null;
		}
	});
	
	// Preload article objects on routes with ':article'
	app.param('article', function(req, res, next, slug) {
		Article.findOne({ slug: slug}, function (err, article) {
			if (err) { return next(err); }
			if (!article) { return next(new Error("can't find article")); }
			req.article = article;
			return next();
		});
	});
	
	app.param('username', function(req, res, next, username) {
		User.findOne({ username: username}, function (err, user) {
			if (err) { return next(err); }
			if (!user) { return next(new Error("can't find user")); }
			req.user = user;
			return next();
		});
	});
	
	app.param('comment', function(req, res, next, id) {
		var query = Comment.findById(id);
		
		query.exec(function (err, comment){
			if (err) { return next(err); }
			if (!comment) { return next(new Error("can't find comment")); }
			
			req.comment = comment;
			return next();
		});
	});
	
	
	app.get('/api/user', auth, function(req, res, next){
		var id = req.payload.id;
		var query = User.findById(id);
		query.exec(function (err, user){
			if (err) { return next(err); }
			if (!user) { return next(new Error("can't find user")); }
			if(user){
				return userCallback(res, user, 'user');	
			}
		});
	});
	
	app.put('/api/user', auth, function(req, res, next){
		var id = req.payload.id;
		var query = User.findById(id);
		query.exec(function (err, user){
			if (err) { return next(err); }
			if (!user) { return next(new Error("can't find user")); }
			if(user){
				// only update fields that were actually passed...
				if( typeof req.body.user.username !== 'undefined' ){
					user.username = req.body.user.username;
				}
				if( typeof req.body.user.email !== 'undefined' ){
					user.email = req.body.user.email;
				}
				if( typeof req.body.user.bio !== 'undefined' ){
					user.bio = req.body.user.bio;
				}
				if( typeof req.body.user.image !== 'undefined' ){
					user.image = req.body.user.image;
				}
				if( typeof req.body.user.password !== 'undefined' ){
					user.setPassword(req.body.user.password);
				}
				user.save(function (err){
					if(err){ return next(err); }
					return userCallback(res, user, 'user');
				});
			}
		});
	});
	
	app.post('/api/users/login', function(req, res, next){
		if(!req.body.user.email){
			return res.status(422).json({email: "can't be blank"});
		}
		if(!req.body.user.password){
			return res.status(422).json({password: "can't be blank"});
		}
		var tmpReq = {
			body: req.body.user
		};
		passport.authenticate('local', function(err, user, info){
			if(err){ return next(err); }
			if(user){
				return res.json({token: user.generateJWT()});
			} else {
				return res.status(401).json(info);
			}
		})(tmpReq, res, next);
	});
	
	app.post('/api/users', function(req, res, next){
		if(!req.body.user.username){
			return res.status(422).json({username: "can't be blank"});
		}
		if(!req.body.user.email){
			return res.status(422).json({email: "can't be blank"});
		}
		if(!req.body.user.password){
			return res.status(422).json({password: "can't be blank"});
		}
		
		var user = new User();
		
		user.username = req.body.user.username;
		user.email = req.body.user.email;
		user.setPassword(req.body.user.password);
		
		user.save(function (err){
			if(err){ return next(err); }
			return userCallback(res, user, 'user');		
		});
	});
	
	app.get('/api/profiles/:username', function(req, res, next){
		var sess = req.session		
		if( sess.user ){
			User.findOne({ email: sess.user.email }, function (err, user) {			
				userCallback(res, req.user, 'profile', user.doiFollow( req.user._id ) );
			});
		}else{
			userCallback(res, req.user, 'profile', false );
		}
	});
	
	app.post('/api/profiles/:username/follow', auth, function(req, res, next){
		var id = req.payload.id;
		var follow = req.user._id;
		var query = User.findById(id);
		query.exec(function (err, user){
			if (err) { return next(err); }
			if (!user) { return next(new Error("can't find user")); }
			if(user){
				user.follow(follow, function(err, user){
					if (err) { return next(err); }
					User.findById(follow).exec(function (err, followuser){
						return userCallback(res, followuser, 'profile', user.doiFollow( follow ) );
					});
				});
			}
		});	
	});
	
	app.delete('/api/profiles/:username/follow', auth, function(req, res, next){
		var id = req.payload.id;
		var follow = req.user._id;
		var query = User.findById(id);
		query.exec(function (err, user){
			if (err) { return next(err); }
			if (!user) { return next(new Error("can't find user")); }
			if(user){
				user.unfollow(follow, function(err, user){
					if (err) { return next(err); }
					User.findById(follow).exec(function (err, followuser){
						return userCallback(res, followuser, 'profile', user.doiFollow( follow ) );
					});
				});
			}
		});		
	});

	
	// handle output of user info, either "user" or "profile"
	function userCallback(res, user, key, following ){
		var following = following || false;
		if( key === 'user' ){
			return res.json({user:{
				username: user.username,
				email: user.email,
				token: user.generateJWT()
			}});
		}else{
			return res.json({profile:{
				"username": user.username,
				"bio": user.bio,
				"image": user.image || "https://static.productionready.io/images/smiley-cyrus.jpg",
				"following": following
			}});
		}	
	}
	
};