var mongoose = require('mongoose');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');

var UserSchema = new mongoose.Schema({
	username: {type: String, lowercase: true, unique: true},
	email: {type: String, lowercase: true, unique: true},
    bio: String,
    image: String,
	favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
	following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],	
	hash: String,
	salt: String
}, {timestamps: true});


UserSchema.methods.validPassword = function(password) {
	var hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64).toString('hex');
	return this.hash === hash;
};

UserSchema.methods.setPassword = function(password){
	this.salt = crypto.randomBytes(16).toString('hex');	
	this.hash = crypto.pbkdf2Sync(password, this.salt, 1000, 64).toString('hex');
};

UserSchema.methods.follow = function(id, cb){
	this.following.push( id );
	this.save(cb);
};

UserSchema.methods.generateJWT = function() {
	var today = new Date();
	var exp = new Date(today);
	exp.setDate(today.getDate() + 60);
	
	return jwt.sign({
		id: this._id,
		username: this.username,
		exp: parseInt(exp.getTime() / 1000),
	}, 'SECRET');
};

mongoose.model('User', UserSchema);
