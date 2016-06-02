# Building a JSON API using Node.js

# Introduction

This course will teach you how to use Node.js as an API. We will be building a
backend that will provide the functionality for our [Medium](https://medium.com)
clone called Conduit. Check out the [live demo](https://demo.productionready.io)
of Conduit to get an idea of the functionality of what we're about to build.

Note that this course only goes over how to build the backend in Node.js. Once
the backend is completed, you can complete any one of our frontend courses to
create a client for the backend you've built.

# Prerequisites

We've provided a specification for our API that we will be building. We
recommended that you go over all the endpoints in the specification and play
around with the demo to get a good idea of the application.

{x: read API docs}
Review the [API documentation](https://github.com/GoThinkster/productionready/blob/master/API.md)

This course assumes some basic Node.js knowledge. We'll be using JWT tokens with
Passport for authentication, along with express.js for rendering JSON. We will also be using Mongo as our database.

{x: install Node.js 4}
Install Node 4

{x: clone seed repo}
Clone the seed repository [here](https://github.com/freekrai/conduit-node).

The seed repository has all the modules required for this project installed.

{x: run npm install}
Run `npm install` to install all the required modules for this project.

# Setting up Users and Authentication for our API

[Passport](http://passportjs.org/) is an excellent authentication system made for Node.js that 
allows us to easily drop-in User functionality into our project. We'll have to make some changes to our
controllers authenticate with JWT's since Passport uses session authentication by default.

## Creating our models

We use three models for our app, `Users`, `Articles` and `Comments`

{x: create user model}
Inside the `models` folder, create `Users.js`:

```javascript
var mongoose = require('mongoose');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');

var UserSchema = new mongoose.Schema({
	username: {type: String, lowercase: true, unique: true},
	email: {type: String, lowercase: true, unique: true},
    bio: String,
    image: String,
	favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],
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

UserSchema.methods.generateJWT = function() {
	var today = new Date();
	var exp = new Date(today);
	exp.setDate(today.getDate() + 60);
	
	return jwt.sign({
		id: this._id,
		username: this.username,
		exp: parseInt(exp.getTime() / 1000),
	}, 'conduit');
};

UserSchema.methods.follow = function(id, cb){
	this.following.push( id );
	this.save(cb);
};

UserSchema.methods.doiFollow = function(id){
	var returnValue = false;
	this.following.forEach( function( followId ){
		if( followId.toString() === id.toString() ){
			returnValue = true;
			return true;
		}
	});
	return returnValue;
};


UserSchema.methods.unfollow = function(id, cb){
	this.following.remove(id);
	this.save(cb);
};



mongoose.model('User', UserSchema);
```

{x: create comments model}
Inside the `models` folder, create `Comments.js`:

```javascript
var mongoose = require('mongoose');

var CommentSchema = new mongoose.Schema({
	body: String,
	author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
	post: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' }
}, {timestamps: true});

mongoose.model('Comment', CommentSchema);
```

{x: create articles model}
Inside the `models` folder, create `Articles.js`:

```javascript
var mongoose = require('mongoose');
var slug = require('slug')
require('../models/Users');
var User = mongoose.model('User');

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
	var self = this;
	User.count({}, function( err, count){
		self.favoritesCount = count;
		self.save(cb);
	}).populate({
		path: 'favorites',
		match: { favorites: { $in: self._id }},
		select: 'name favorites -_id'
	});
};

ArticleSchema.methods.unfavorited = function(cb) {
	var self = this;
	User.count({}, function( err, count){
		self.favoritesCount = count;
		self.save(cb);
	}).populate({
		path: 'favorites',
		match: { favorites: { $in: self._id }},
		select: 'name favorites -_id'
	});
};

mongoose.model('Article', ArticleSchema);
```

These models tell our app how to work, from what fields to use in the database, to custom functions that we'll be using.

## Setting up Registration and Login


{x: Make it look good}

First, we want to control our user output, for that, we've created a universal callback function called `userCallback` which will take the information passed to it and format it:

```javascript	
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
```


{x: handling sessions}

In our JWT payload, we're including both the id and username of the user, and setting the
expiration time of the token to 60 days in the future. 

We use a middleware in our routes which will check the passed JWT token and return a user:

```javascript
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
```

{x: create registration }

Registration is handled by our `users` route. 

Inside our `users.js` file in the `routes` folder, we add an endpoint:

```javascript
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
```

This will create the user if data that was passed validates. We want our login
endpoint to respond with a 422 status code, and the body to follow the errors
format in the [documentation](https://github.com/GoThinkster/productionready/blob/master/API.md#errors).

Now, let's set up the rest of our user routes so we can edit the user.

{x: login }

Let's log our user in, this is handled by our `users` route. 

Inside our `users.js` file in the `routes` folder, we add an endpoint:

```javascript
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
```

{x: edit a user }

Editing a user isn't much different than creating one, inside our `users.js` file in the `routes` folder, we add an endpoint:

```javascript
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
```

This will update the user that is passed inside the JWT session so that a user can only edit themselves.

{x: get a user's profile}

We want to view a user's profile and see if we follow them or not, this is where we'll use the `doiFollow` function in our `Users` model.

Inside our `users.js` file in the `routes` folder, we add an endpoint:

```javascript
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
```

{x: following and unfollowing users}

Since we're being social, we want to be able to follow and unfollow users. Add the following two endpoints to our `users.js` file in the `routes` folder:

```javascript
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
```

## Testing Authentication with Postman

Now we can to start our Node server using `node app.js`. We should be able to run
all of the requests in the `Auth` folder of the Postman. The Login and Register
requests in Postman automatically save the returned JWT tokens as environment
variables within Postman, allowing you to use requests for getting and updating
the current user without setting the Authorization header manually. 

After registering a user, you should be able to log in with the same credentials and
update the fields of that user. You can customize the parameters being sent by
Postman in the Body tab of each request.

{x: test registration postman}

Create an account using the Register request in Postman

{x: test login postman}

Test the Login endpoint using Postman

{x: test registration error postman}

Try registering another user with the same email or username, you should get
an error back from the backend

{x: test login error postman}

Try logging in to the user you created with an invalid password, you should get
an error back from the backend

{x: test user fetch postman}

Test the Current User endpoint using Postman

{x: test update user postman}

Try updating the email, username, bio, or image for the user

## Handling the Articles



## Testing the Feed Endpoint using Postman

We should be able to test our feed endpoint now. If you haven't already, make
sure you've created a user who's following another user who has already created
some articles. If you hit the Feed endpoint with Postman, you should see the
articles from the users that your user is following.

{x: ensure following authors}

Make sure your user is following another user who has created some articles

{x: test feed endpoint postman}

Use the "Feed" request in Postman to test the Feed endpoint we created. We
should see the most recent articles from users we're following.
