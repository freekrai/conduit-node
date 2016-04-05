var express = require('express');
var router = express.Router();
var jwt = require('express-jwt');
var passport = require('passport');
var mongoose = require('mongoose');
var Article = mongoose.model('Article');
var Comment = mongoose.model('Comment');
var User = mongoose.model('User');

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
router.param('article', function(req, res, next, id) {
	var query = Article.findById(id);
	
	query.exec(function (err, article){
		if (err) { return next(err); }
		if (!article) { return next(new Error("can't find article")); }
		
		req.article = article;
		return next();
	});
});

router.param('username', function(req, res, next, username) {
	console.log('> ' + username );
	User.findOne({ username: username}, function (err, user) {
		if (err) { return next(err); }
		if (!user) { return next(new Error("can't find user")); }
		req.user = user;
		return next();
	});
});

router.param('comment', function(req, res, next, id) {
	var query = Comment.findById(id);
	
	query.exec(function (err, comment){
		if (err) { return next(err); }
		if (!comment) { return next(new Error("can't find comment")); }
		
		req.comment = comment;
		return next();
	});
});


router.get('/api/user', auth, function(req, res, next){
	var id = req.payload.id;
	var query = User.findById(id);
	query.exec(function (err, user){
		if (err) { return next(err); }
		if (!user) { return next(new Error("can't find user")); }
		if(user){
			return res.json({user:{
				username: user.username,
				email: user.email,
				token: user.generateJWT()
			}});
		}
	});
});

router.put('/api/user', auth, function(req, res, next){
	var id = req.payload.id;
	var query = User.findById(id);
	query.exec(function (err, user){
		if (err) { return next(err); }
		if (!user) { return next(new Error("can't find user")); }
		if(user){
			return res.json({user:{
				username: user.username,
				email: user.email,
				token: user.generateJWT()
			}});
		}
	});
});

router.post('/api/users/login', function(req, res, next){
	if(!req.body.user.email || !req.body.user.password){
		return res.status(400).json({message: 'Please fill out all fields'});
	}
	User.findOne({ email: req.body.user.email }, function (err, user) {
		if (err) { return next(err); }
		if (!user) {
			return next(new Error("Incorrect username."));
		}
		if (!user.validPassword(req.body.user.password)) {
			return next(new Error("Incorrect password."));
		}
		if(user){
			return res.json({user:{
				username: user.username,
				email: user.email,
				token: user.generateJWT()
			}});
		} else {
			return res.status(401).json(info);
		}
	});
});

router.post('/api/users', function(req, res, next){
	if(!req.body.user.username || !req.body.user.email || !req.body.user.password){
		return res.status(400).json({message: 'Please fill out all fields'});
	}
	
	var user = new User();
	
	user.username = req.body.user.username;
	user.email = req.body.user.email;
	user.setPassword(req.body.user.password);
	
	user.save(function (err){
		if(err){ return next(err); }
		return res.json({user:{
			username: user.username,
			email: user.email,
			token: user.generateJWT()
		}});
	});
});

router.get('/api/profiles/:username', function(req, res, next){
	res.json({profile:{
		"username": req.user.username,
		"bio": req.user.bio,
		"image": req.user.image,
		"following": false		
	}});
});

router.post('/api/profiles/:username/follow', auth, function(req, res, next){
	var id = req.payload.id;
	var follow = req.user._id;
	var query = User.findById(id);
	query.exec(function (err, user){
		if (err) { return next(err); }
		if (!user) { return next(new Error("can't find user")); }
		if(user){
			user.follow(follow, function(err, user){
				if (err) { return next(err); }
				res.json({profile:{
					"username": user.username,
					"bio": user.bio,
					"image": user.image,
					"following": true
				}});
			});
		}
	});	
});

router.delete('/api/profiles/:username/follow', auth, function(req, res, next){
	
});

/*
router.get('/api/articles', function(req, res, next) {
	Article.find(function(err, articles){
		if(err){ return next(err); }
		res.json(articles);
	});
});

router.get('/api/articles/feed', auth, function(req, res, next) {
	Article.find(function(err, articles){
		if(err){ return next(err); }
		res.json(articles);
	});
});

router.post('/api/articles', auth, function(req, res, next) {
	var article = new Article(req.body);
	article.author = req.payload.username;
	
	article.save(function(err, article){
		if(err){ return next(err); }
		res.json(article);
	});
});

// return a article
router.get('/api/articles/:article', function(req, res, next) {
	req.article.populate('comments tags author', function(err, article) {
		res.json(article);
	});
});

// update article
router.get('/api/articles/:article', function(req, res, next) {
	req.article.populate('comments tags author', function(err, article) {
		res.json(article);
	});
});


router.put('/api/articles/:article/favorite', auth, function(req, res, next) {
	req.article.favorite(function(err, post){
		if (err) { return next(err); }
		res.json(post);
	});
});

router.delete('/api/articles/:article/favorite', auth, function(req, res, next) {
	req.article.favorite(function(err, post){
		if (err) { return next(err); }
		res.json(post);
	});
});


// create a new comment
router.post('/api/articles/:article/comments', auth, function(req, res, next) {
	var comment = new Comment(req.body);
	comment.article = req.article;
	comment.author = req.payload.username;
	
	comment.save(function(err, comment){
		if(err){ return next(err); }
		req.article.comments.push(comment);
		req.article.save(function(err, article) {
			if(err){ return next(err); }
			
			res.json(comment);
		});
	});
});

router.delete('/api/articles/:article/comments/:comment', auth, function(req, res, next) {
	var comment = new Comment(req.body);
	comment.article = req.article;
	comment.comment = req.comment;
	comment.author = req.payload.username;
	
	comment.save(function(err, comment){
		if(err){ return next(err); }
		req.article.comments.push(comment);
		req.article.save(function(err, article) {
			if(err){ return next(err); }
			
			res.json(comment);
		});
	});
});
*/
module.exports = router;
