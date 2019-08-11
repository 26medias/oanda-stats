/**
* Parses a 'multipart/form-data' upload request
*
* @param {Object} req Cloud Function request context.
* @param {Object} res Cloud Function response context.
*/
const path		= require('path');
const os		= require('os');

// Useful stuff that might not be required here...
const fs		= require('fs-extra');
const _			= require('underscore');
const pstack	= require('pstack');
var fstool		= require("fs-tool");


// Abstracting a single cloud function into multiple dynamic http-endpoints
// Because I'm not gonna deal with deploying every single functions separately and dealing with auth, encryption & cors for each one...
const Handler	= require('./cloud-function-handler');

// Init the handler
var handler		= new Handler();

var Core	= require("./lib/core");


handler.on('/api/trading/trades', function(params, callback, req, res, settings, cli) {
	var core = Core(params, req, res, settings, cli);
	core.trading.trades(callback);
}, {
	CORS:		true,
	auth:		true,
	encrypt:	true
});


handler.on('/api/dashboard/list', function(params, callback, req, res, settings, cli) {
	var core = Core(params, req, res, settings, cli);
	core.dashboard.list(callback);
}, {
	CORS:		true,
	auth:		true,
	encrypt:	true
});
handler.on('/api/dashboard/create', function(params, callback, req, res, settings, cli) {
	var core = Core(params, req, res, settings, cli);
	core.dashboard.create(callback);
}, {
	CORS:		true,
	auth:		true,
	encrypt:	true
});
handler.on('/api/dashboard/save', function(params, callback, req, res, settings, cli) {
	var core = Core(params, req, res, settings, cli);
	core.dashboard.save(callback);
}, {
	CORS:		true,
	auth:		true,
	encrypt:	true
});
handler.on('/api/widget/save', function(params, callback, req, res, settings, cli) {
	var core = Core(params, req, res, settings, cli);
	core.dashboard.saveWidget(callback);
}, {
	CORS:		true,
	auth:		true,
	encrypt:	true
});
handler.on('/api/widget/list', function(params, callback, req, res, settings, cli) {
	var core = Core(params, req, res, settings, cli);
	core.dashboard.listWidgets(callback);
}, {
	CORS:		true,
	auth:		true,
	encrypt:	true
});


exports.main = (cli, settings, req, res) => {
	
	// Start the handler
	// It'll deal with everything...
	handler.start(cli, settings, req, res);
};