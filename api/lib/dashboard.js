var _		= require('underscore');
var pstack	= require('pstack');


Dashboard = function(core, params, req, res) {
	var lib = {};
	lib = {
		list:	function(callback) {
			core.io.read("dashboards", function(response) {
				callback(response||{});
			});
		},
		create:	function(callback) {
			var dashboard = {
				id:			core.sid(),
				name:		params.name,
				widgets:	[]
			};
			
			core.io.update("dashboards", dashboard.id, dashboard, function(response) {
				callback(dashboard);
			});
		},
		save:	function(callback) {
			core.io.update("dashboards", params.dashboard.id, params.dashboard, function(response) {
				callback(params.dashboard);
			});
		},
		listWidgets:	function(callback) {
			core.io.read("widgets", function(response) {
				callback(response||{});
			});
		},
		saveWidget:	function(callback) {
			core.io.update("widgets", params.widget.id, params.widget, function(response) {
				callback(params.widget);
			});
		},
	};
	return lib;
}



module.exports = Dashboard;