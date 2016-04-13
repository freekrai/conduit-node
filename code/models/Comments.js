var mongoose = require('mongoose');

var CommentSchema = new mongoose.Schema({
	body: String,
	author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	post: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' }
}, {timestamps: true});

mongoose.model('Comment', CommentSchema);
