var fs = require('fs'),
	http = require('http'),
	path = require('path'),
	methods = require('methods'),
	express = require('express'),
	bodyParser = require('body-parser'),
	cors = require('cors'),
	isProduction = process.env.NODE_ENV === 'production';
		
// Create global app object
var app = express();

app.use( cors() );

// Normal express config defaults
app.use(require('morgan')('dev'));
// app.use(bodyParser.urlencoded({ extended: false }));
app.use( bodyParser.json() );

app.use(require('method-override')());
app.use(express.static(__dirname + '/public'));

if ( !isProduction ) {
	app.use(require('errorhandler')());
}

// mongoose handling...
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/conduit');
require('./models/Tags');
require('./models/Articles');
require('./models/Users');
require('./models/Comments');

var routes = require('./routes/index');
app.use('/', routes);

// finally, let's start our server...
var server = app.listen( process.env.PORT || 3000, function(){
	console.log('Listening on port ' + server.address().port);
});