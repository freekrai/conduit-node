var jwt = require('express-jwt');
var passport = require('passport');
var mongoose = require('mongoose');
var _ = require('underscore');
var Article = mongoose.model('Article');
var Comment = mongoose.model('Comment');
var User = mongoose.model('User');


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
		
	app.get('/api/articles', function(req, res, next) {
		var query = {};
		if( typeof req.query.author !== 'undefined' ){
			query['author'] = req.query.author;
		}
		if( typeof req.query.favorited !== 'undefined' ){
			User.find({username: req.query.favorited}, function(err, user){
				if (err) { return next(err); }
				if (!user) { return next(new Error("can't find user")); }
				if(user){
					var query = {};
					if( typeof user.favorites !== 'undefined' ){
						query['_id'] = {"$in" : user.favorites};
					}
				}
			});
		}
		var limit = 20;
		var offset = 0;
		if( typeof req.query.tag !== 'undefined' ){
			query['tagList'] = {"$in" : [req.query.tag]};
		}
		if( typeof req.query.limit !== 'undefined' ){
			limit = req.query.limit;
		}
		if( typeof req.query.offset !== 'undefined' ){
			offset = req.query.offset;
		}
		Article.find(query, function(err, articles){
			if(err){ return next(err); }
			articleCallback(req, res, articles );
		})
		.limit( limit )
		.skip( offset )
		.populate('author');
	});
	
	
	app.get('/api/articles/feed', auth, function(req, res, next) {
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
				if( typeof req.query.tag !== 'undefined' ){
					query['tagList'] = {"$in" : [req.query.tag]};
				}
				if( typeof req.query.limit !== 'undefined' ){
					limit = req.query.limit;
				}
				if( typeof req.query.offset !== 'undefined' ){
					offset = req.query.offset;
				}
				Article.find(query, function(err, articles){
					if(err){ return next(err); }
					articleCallback(req, res, articles );
				})
				.limit( limit )
				.skip( offset )
				.populate('author');
			}
		})
	});
	
	app.post('/api/articles', auth, function(req, res, next) {
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
					articleCallback(req, res, article, true );
				});
			}
		});
	});
	
	// return a article
	app.get('/api/articles/:article', function(req, res, next) {
		req.article.populate('comments author', function(err, article) {
			articleCallback(req, res, article, true );
		});
	});
	
	// update article
	app.put('/api/articles/:article', auth, function(req, res, next) {
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
			articleCallback(req, res, article, true );
		});
	});
	
	// delete article
	app.delete('/api/articles/:article', auth, function(req, res, next) {
		req.article.populate('comments author', function(err, article) {
			req.article.remove();
			articleCallback(req, res, article, true );
		});
	});
	
	
	
	app.post('/api/articles/:article/favorite', auth, function(req, res, next) {
		var id = req.payload.id;
		var favorite = req.article._id;
		var query = User.findById(id);
		query.exec(function (err, user){
			if (err) { return next(err); }
			if (!user) { return next(new Error("can't find user")); }
			if(user){
				user.favorite(favorite, function(err, user){
					if (err) { return next(err); }
					req.article.favorited( function( err, article){
						return articleCallback(req, res, article, true);
					});
				});
			}
		});	
	});
	
	app.delete('/api/articles/:article/favorite', auth, function(req, res, next) {
		var id = req.payload.id;
		var favorite = req.article._id;
		var query = User.findById(id);
		query.exec(function (err, user){
			if (err) { return next(err); }
			if (!user) { return next(new Error("can't find user")); }
			if(user){
				user.unfavorite(favorite, function(err, user){
					if (err) { return next(err); }
					req.article.unfavorited( function( err, article){
						return articleCallback(req, res, article, true);
					});
				});
			}
		});	
	});
	
	// return a list of tags
	app.get('/api/tags', function(req, res, next) {
		Article.find({}, function(err, articles){
			if(err){ return next(err); }
			var returnValue = [];
			articles.forEach( function( article ){
				var tags = article.tagList;
				for(var i = 0; i < tags.length; i++) {
					returnValue.push( tags[i] );
				}
			});
			returnValue = _.uniq( returnValue );
			res.json({"tags": returnValue});
		})
	});
	
	// return an article's comments
	app.get('/api/articles/:article/comments', function(req, res, next) {
		req.article.populate('comments author', function(err, article) {
			commentCallback(req, res, req.article.comments);
		});
	});
	
	
	// create a new comment
	app.post('/api/articles/:article/comments', auth, function(req, res, next) {
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
	
	app.delete('/api/articles/:article/comments/:comment', auth, function(req, res, next) {
		req.comment.remove();
		commentCallback(req, res, req.comment, true );
	});
	
	// handle output of comments
	function commentCallback(req, res, comments, single ){
		var single = single || false;
		var returnValue = [];
		if( single ){
			var comment = comments;
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
		}	
		if( returnValue.length > 1 ){
			res.json({"comments": returnValue});
		}else{
			res.json({"comment": returnValue});
		}
	}
	
	// handle output of articles.
	function articleCallback(req, res, articles, single ){
		var sess = req.session		
		var single = single || false;
		var returnValue = [];
		if( single ){
			var article = articles;

			if( sess.user ){
				User.findOne({ email: sess.user.email }, function (err, user) {
					var ifavorite = user.doiFavorite( article._id );
					var ifollow = user.doiFollow( article.author._id );
				});
			}else{
				var ifavorite = false;
				var ifollow = false;
			}
			returnValue.push({
				"slug": article.slug,
				"title": article.title,
				"description": article.description,
				"body": article.body,
				"createdAt": article.createdAt,
				"updatedAt": article.updatedAt,
				"tagList": article.tagList,
				"favorited": ifavorite,
				"favoritesCount": article.favoritesCount,
				"author": {
					"username": article.author.username,
					"bio": article.author.bio,
					"image": article.author.image|| "https://static.productionready.io/images/smiley-cyrus.jpg",
					"following": ifollow
				}
			});	
		}else{
			articles.forEach( function( article ){
				if( sess.user ){
					User.findOne({ email: sess.user.email }, function (err, user) {
						var ifavorite = user.doiFavorite( article._id );
						var ifollow = user.doiFollow( article.author._id );
					});
				}else{
					var ifavorite = false;
					var ifollow = false;
				}
				returnValue.push({
					"slug": article.slug,
					"title": article.title,
					"description": article.description,
					"body": article.body,
					"tagList": article.tagList,
					"createdAt": article.createdAt,
					"updatedAt": article.updatedAt,
					"favorited": ifavorite,
					"favoritesCount": article.favoritesCount,
					"author": {
						"username": article.author.username,
						"bio": article.author.bio,
						"image": article.author.image || "https://static.productionready.io/images/smiley-cyrus.jpg",
						"following": ifollow
					}
				});
			});
		}
		if( returnValue.length > 1 ){
			res.json({"articles": returnValue, 'articlesCount': returnValue.length});
		}else{
			res.json({"article": returnValue});
		}
	}
};
