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
router.param('article', function(req, res, next, slug) {
	Article.findOne({ slug: slug}, function (err, article) {
		if (err) { return next(err); }
		if (!article) { return next(new Error("can't find article")); }
		req.article = article;
		return next();
	});
});

router.param('username', function(req, res, next, username) {
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
			return userCallback(res, user, 'user');	
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
			return userCallback(res, user, 'user');
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
		return userCallback(res, user, 'user');		
	});
});

router.get('/api/profiles/:username', function(req, res, next){
	userCallback(res, req.user, 'profile');
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
				return userCallback(res, user, 'profile');
			});
		}
	});	
});

router.delete('/api/profiles/:username/follow', auth, function(req, res, next){
	var id = req.payload.id;
	var follow = req.user._id;
	var query = User.findById(id);
	query.exec(function (err, user){
		if (err) { return next(err); }
		if (!user) { return next(new Error("can't find user")); }
		if(user){
			user.unfollow(follow, function(err, user){
				if (err) { return next(err); }
				return userCallback(res, user, 'profile');
			});
		}
	});		
});

/*
User.find({}).populate({
	path: 'favorites',
	match: { age: { $gte: 18 }},
	select: 'name age -_id'
}).exec()
*/

router.get('/api/articles', function(req, res, next) {
	var query = {};
	if( typeof req.params.author !== 'undefined' ){
		query['author'] = req.params.author;
	}
	if( typeof req.params.favorited !== 'undefined' ){
		User.find({username: req.params.favorited}, function(err, user){
			if (err) { return next(err); }
			if (!user) { return next(new Error("can't find user")); }
			if(user){
				//	get 10 most recent articles published by list of users this user is following...
				var query = {};
				if( typeof user.favorites !== 'undefined' ){
					query['_id'] = {"$in" : user.favorites};
				}
			}
		});
	}
	var limit = 20;
	var offset = 0;
	if( typeof req.params.tag !== 'undefined' ){
		query['tagList'] = {"$in" : req.params.tag};
	}
	if( typeof req.params.limit !== 'undefined' ){
		limit = req.params.limit;
	}
	if( typeof req.params.offset !== 'undefined' ){
		offset = req.params.offset;
	}
	Article.find(query, function(err, articles){
		if(err){ return next(err); }
		articleCallback(res, articles );
	})
	.limit( limit )
	.skip( offset )
	.populate('author');
});


router.get('/api/articles/feed', auth, function(req, res, next) {
	var id = req.payload.id;
	var query = User.findById(id);
	query.exec(function (err, user){
		if (err) { return next(err); }
		if (!user) { return next(new Error("can't find user")); }
		if(user){
			//	get 10 most recent articles published by list of users this user is following...
			var query = {};
			if( typeof user.following !== 'undefined' ){
				query['author'] = {"$in" : user.following};
			}
			var limit = 20;
			var offset = 0;
			if( typeof req.params.tag !== 'undefined' ){
				query['tagList'] = {"$in" : req.params.tag};
			}
			if( typeof req.params.limit !== 'undefined' ){
				limit = req.params.limit;
			}
			if( typeof req.params.offset !== 'undefined' ){
				offset = req.params.offset;
			}
			Article.find(query, function(err, articles){
				if(err){ return next(err); }
				articleCallback(res, articles );
			})
			.limit( limit )
			.skip( offset )
			.populate('author');
		}
	})
});

router.post('/api/articles', auth, function(req, res, next) {
	var id = req.payload.id;
	var query = User.findById(id);
	query.exec(function (err, user){
		if (err) { return next(err); }
		if (!user) { return next(new Error("can't find user")); }
		if(user){
			var article = new Article(req.body.article);
			article.author = user;
			article.slugify();	
			article.save(function(err, article){
				if(err){ return next(err); }
				articleCallback(res, article, true );
			});
		}
	});
});

// return a article
router.get('/api/articles/:article', function(req, res, next) {
	req.article.populate('comments author', function(err, article) {
		articleCallback(res, article, true );
	});
});

// update article
router.put('/api/articles/:article', auth, function(req, res, next) {
title, description, body
	if( typeof req.body.article.title !== 'undefined' ){
		req.article.title = req.body.article.title;
		req.article.slug();
	}
	if( typeof req.body.article.description !== 'undefined' ){
		req.article.description = req.body.article.description;
	}
	if( typeof req.body.article.body !== 'undefined' ){
		req.article.body = req.body.article.body;
	}
	req.article.save(function(err, article){
		if(err){ return next(err); }
		articleCallback(res, article, true );
	});
});

// delete article
router.delete('/api/articles/:article', auth, function(req, res, next) {
	req.article.populate('comments author', function(err, article) {
		req.article.remove();
		articleCallback(res, article, true );
	});
});



router.put('/api/articles/:article/favorite', auth, function(req, res, next) {
	var id = req.payload.id;
	var favorite = req.article._id;
	var query = User.findById(id);
	query.exec(function (err, user){
		if (err) { return next(err); }
		if (!user) { return next(new Error("can't find user")); }
		if(user){
			user.favorite(favorite, function(err, user){
				if (err) { return next(err); }
				return articleCallback(res, req.article, single);
			});
		}
	});	
});

router.delete('/api/articles/:article/favorite', auth, function(req, res, next) {
	var id = req.payload.id;
	var favorite = req.article._id;
	var query = User.findById(id);
	query.exec(function (err, user){
		if (err) { return next(err); }
		if (!user) { return next(new Error("can't find user")); }
		if(user){
			user.unfavorite(favorite, function(err, user){
				if (err) { return next(err); }
				return articleCallback(res, req.article, single);
			});
		}
	});	
});

// return a list of tags
router.get('/api/tags', function(req, res, next) {
	Article.find(query, function(err, articles){
		if(err){ return next(err); }
		var returnValue = [];
		articles.forEach( function( article ){
			var tags = article.tagList;
			tags.forEach( function( tag ){
				returnValue[ tag ] = tag;
			});
		});
		res.json({"tags": returnValue);
	})
});

// return an article's comments
router.get('/api/articles/:article/comments', function(req, res, next) {
	req.article.populate('comments author', function(err, article) {
		commentsCallback(res, req.article.comments);
	});
});


// create a new comment
router.post('/api/articles/:article/comments', auth, function(req, res, next) {
	var comment = new Comment(req.comment.body);
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
	var comment = new Comment(req.comment.body);
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

// handle output of user info, either "user" or "profile"
function userCallback(res, user, key ){
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
			"image": user.image,
			"following": false
		}});
	}	
}

// handle output of comments
function commentCallback(res, comments, single ){
	var single = single || false;
	if( single ){
		var comment = comments;
		res.json({comment:{
			"body": comment.body,
			"createdAt": comment.createdAt,
			"author": {
				"username": comment.author.username,
				"bio": comment.author.bio,
				"image": comment.author.image,
				"following": false
			}
		}});	
	}else{
		var returnValue = [];
		comments.forEach( function( comments ){
			returnValue.push({
				"body": comment.body,
				"createdAt": comment.createdAt,
				"author": {
					"username": comment.author.username,
					"bio": comment.author.bio,
					"image": comment.author.image,
					"following": false
				}
			});
		});
		res.json({"comments": returnValue});
	}	
}

// handle output of articles.
function articleCallback(res, articles, single ){
	var single = single || false;
	if( single ){
		var article = articles;
		res.json({article:{
			"slug": article.slug,
			"title": article.title,
			"description": article.description,
			"body": article.body,
			"createdAt": article.createdAt,
			"updatedAt": article.updatedAt,
			"favorited": false,
			"favoritesCount": 0,
			"author": {
				"username": article.author.username,
				"bio": article.author.bio,
				"image": article.author.image,
				"following": false
			}
		}});	
	}else{
		var returnValue = [];
		articles.forEach( function( article ){
			returnValue.push({
				"slug": article.slug,
				"title": article.title,
				"description": article.description,
				"body": article.body,
				"createdAt": article.createdAt,
				"updatedAt": article.updatedAt,
				"favorited": false,
				"favoritesCount": 0,
				"author": {
					"username": article.author.username,
					"bio": article.author.bio,
					"image": article.author.image,
					"following": false
				}
			});
		});
		res.json({"articles": returnValue, 'articlesCount': returnValue.length});
	}
}

module.exports = router;
