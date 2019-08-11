var pstack	= require('pstack');
var _ 		= require('underscore');

var cloudFunctionHandler = function(app) {
	this.app		= app;
	this.logging	= false;
	this.routes		= {};
}

// Start & serve
cloudFunctionHandler.prototype.start = function(cli, settings, req, res) {
	var scope = this;
	// Allow all origins
	res.set('Access-Control-Allow-Origin', '*');
	
	// Extract the basic data we need there
	var headers = req.headers;
	var params	= _.extend({}, req.query, req.body);
	
	// Find which route matches that server
	// Path splitting
	var pathVars = req.path.split('/');
	
	if (this.routes[req.path]) {
		// Route found
		var route = this.routes[req.path];
		
		// Optionnal CORS support
		if (route.options.CORS) {
			if (req.method === 'OPTIONS') {
				// Send response to OPTIONS requests
				res.set('Access-Control-Allow-Methods', 'POST');
				res.set('Access-Control-Allow-Headers', 'Content-Type,env');
				res.set('Access-Control-Max-Age', '3600');
				res.status(204).send('');
				return false;
			}
		} else {
			if (req.method === 'OPTIONS') {
				return res.status(405).send({error:"OPTION not supported on this endpoint"}).end();
			}
		}
		
		var stack	= new pstack();
		var buffer	= {};
		
		// @TODO: Auth support
		stack.add(function(done) {
			done();
		});
		
		// Endpoint logic
		stack.add(function(done) {
			route.callback(params, function(response) {
				buffer.response	= response;
				done();
			}, req, res, settings, cli)
		});
		
		stack.start(function() {
			res.status(200).send(JSON.stringify(buffer.response, null, 4)).end();
		});
		
	} else {
		// Route not found
		return res.status(404).send({error:"Endpoint not found."}).end();
	}
}


// Register a new route
cloudFunctionHandler.prototype.on = function(route, callback, options) {
	this.routes[route] = {
		callback:	callback,
		options:	options
	}
	return this.routes[route];
}

module.exports = cloudFunctionHandler;
