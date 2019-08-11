
var _			= require("underscore");
var request		= require("request");
var path		= require("path");
var pstack		= require("pstack");
var fs			= require("fs");
var fstool		= require("fs-tool");
var querystring	= require('querystring');

lib = function(core, options) {
	//core.log("Oanda", "init()", options);
	var Lib = {};
	Lib = {
		read:	function(name, callback) {
			fstool.file.readJson(core.cli.filename(core.settings, core.settings.OANDA_ACC+'/'+name+".json"), function(data) {
				callback(data);
			});
		},
		write:	function(name, value, callback) {
			fstool.file.writeJson(core.cli.filename(core.settings, core.settings.OANDA_ACC+'/'+name+".json"), value, function(data) {
				callback(data);
			});
		},
		update:	function(name, id, value, callback) {
			Lib.read(name, function(response) {
				if (!response) {
					response = {};
				}
				response[id] = value;
				Lib.write(name, response, function() {
					callback(value);
				});
			});
		},
		get:	function(name, id, callback) {
			Lib.read(name, function(response) {
				if (!response) {
					response = {};
				}
				callback(response[id]);
			});
		}
	}
	return Lib;
}



module.exports = lib;