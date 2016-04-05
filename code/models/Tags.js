var mongoose = require('mongoose');

var TagSchema = new mongoose.Schema({
	slug: {type: String, lowercase: true, unique: true},
	title: String,
	author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {timestamps: true});

mongoose.model('Tag', TagSchema);