var mongoose = require('mongoose');
var slug = require('slug')

var ArticleSchema = new mongoose.Schema({
	slug: {type: String, lowercase: true, unique: true},
	title: String,
	description: String,
	body: String,
	favoritesCount: {type: Number, default: 0},
	comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
    tagList: [{ type: String }],
	author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {timestamps: true});

ArticleSchema.methods.slugify = function() {
	this.slug = slug( this.title );
};

ArticleSchema.methods.favorited = function(cb) {
	this.favoritesCount += 1;
	this.save(cb);
};

ArticleSchema.methods.unfavorited = function(cb) {
	this.favoritesCount -= 1;
	this.save(cb);
};

mongoose.model('Article', ArticleSchema);
