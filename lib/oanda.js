
var _			= require("underscore");
var request		= require("request");
var path		= require("path");
var pstack		= require("pstack");
var fs			= require("fs");
var fstool		= require("fs-tool");
var querystring	= require('querystring');

lib = function(settings) {
	//core.log("Oanda", "init()", options);
	var OandaLib = {};
	OandaLib = {
		refreshTransactions:	function(callback) {
			// Get the transaction pages
			OandaLib.get("/accounts/"+settings.OANDA_ACC+"/transactions", {}, function(response) {
				
				if (response && response.pages) {
					var stack	= new pstack({
						stack:		10,
						progress:	'Fetching...'
					});
					
					var buffer			= {};
					var transactions	= [];
					
					_.each(response.pages, function(page) {
						var parts	= page.split('?');
						var qs		= querystring.decode(parts[1]);
						stack.add(function(done) {
							OandaLib.get("/accounts/"+settings.OANDA_ACC+"/transactions/idrange", qs, function(response) {
								//core.log("Oanda", "transactions.list response", response);
								if (response && response.transactions) {
									transactions = transactions.concat(response.transactions);
								}
								done();
							});
						});
					});
					
					stack.start(function() {
						callback(transactions);
					});
				} else {
					callback(false);
				}
				
			});
		},
		transactionsToHistory:	function(transactions) {
			var stats = {};
			
			
			/*
				** How that clusterfuck of a schema works (thanks for nothing Oanda engineers) **

				Position open (open):
					type: 		MARKET_ORDER
					tradeClose:	Doesn't exist

				Open Order fill (fill_open):
					type: 			ORDER_FILL
					tradeOpened:	Exists
					tradesClosed:	Doesn't exist
					orderID:		open.id

				Take Profit Settings (tp):
					type: 		TAKE_PROFIT_ORDER
					tradeID:	fill_open.id

				Stop Loss Settings (sl):
					type: 		STOP_LOSS_ORDER
					tradeID:	fill_open.id

				Position close (close):
					type: 				MARKET_ORDER
					tradeClose.tradeID:	fill_open.id

				Close Order fill (fill_close):
					type: 			ORDER_FILL
					tradeOpened:	Doesn't exist
					tradesClosed:	Exists
					orderID:		close.id

				Take Profit Cancel (tp_cancel):
					type: 		ORDER_CANCEL
					orderID:	tp.id

				Stop Loss Cancel (tp_cancel):
					type: 		ORDER_CANCEL
					orderID:	sl.id

				Order Cancel (order_cancel):
					type: 		ORDER_CANCEL
					orderID:	open.id
									
				
			*/
			
			
			
			var filterAndGroup	= function(data, filter, group) {
				var items = _.filter(data, filter);
				return _.indexBy(items, group);
			}
			
			var open = _.filter(transactions, function(item) {
				return item.type == 'MARKET_ORDER' && !item.tradeClose;
			});
			
			var fill_open = filterAndGroup(transactions, function(item) {
				return item.type == 'ORDER_FILL' && item.tradeOpened && !item.tradesClosed;
			}, function(item) {
				return item.orderID;
			});
			
			var fill_close = filterAndGroup(transactions, function(item) {
				return item.type == 'ORDER_FILL' && !item.tradeOpened && item.tradesClosed;
			}, function(item) {
				return item.orderID;
			});
			
			var tp = filterAndGroup(transactions, function(item) {
				return item.type == 'TAKE_PROFIT_ORDER';
			}, function(item) {
				return item.tradeID;
			});
			
			var sl = filterAndGroup(transactions, function(item) {
				return item.type == 'STOP_LOSS_ORDER';
			}, function(item) {
				return item.tradeID;
			});
			
			var close = filterAndGroup(transactions, function(item) {
				return item.type == 'MARKET_ORDER' && item.tradeClose && item.tradeClose.tradeID;
			}, function(item) {
				return item.tradeClose.tradeID;
			});
			
			var cancel = filterAndGroup(transactions, function(item) {
				return item.type == 'ORDER_CANCEL';
			}, function(item) {
				return item.orderID;
			});
			
			
			var positions = _.map(open, function(item) {
				var obj = {
					instrument:		item.instrument,
					open_time:		item.time,
					close_time:		null,
					cancel_time:	null,
					cancel:			null,
					units:			parseFloat(item.units),
					type:			parseFloat(item.units)>0?'BUY':'SELL',
					open:			null,
					close:			null,
					position_value:	null,
					margin_used:	null,
					pl:				null,
					pip:			null,
					close_reason:	null,
					balance_open:	null,
					balance_close:	null,
					take_profit:	null,
					stop_loss:		null,

					financing:		null,
					spreadCost:		null,
					ids: {
						open:		item.id,
						open_fill:	null,
						close:		null,
						close_fill:	null,
						tp:			null,
						sl:			null
					}
				};
				
				// Assemble the data
				
				// Open Fill
				var _fill_open = fill_open[item.id];
				if (_fill_open) {
					obj.open			= parseFloat(_fill_open.price);
					obj.balance_open	= parseFloat(_fill_open.accountBalance);
					obj.ids.open_fill	= _fill_open.id;
					
					obj.position_value	= obj.open*parseFloat(item.units);
					obj.margin_used		= obj.position_value/obj.balance_open*100;
				
					// Take Profit
					var _tp = tp[_fill_open.id];
					if (_tp) {
						obj.take_profit		= parseFloat(_tp.price);
						obj.ids.tp			= _tp.id;
						
						// Did it execute?
						var _fill_close = fill_close[_tp.id];
						if (_fill_close) {
							obj.close			= parseFloat(_fill_close.price);
							obj.balance_close	= parseFloat(_fill_close.accountBalance);
							obj.close_time		= _fill_close.time;
							obj.close_reason	= _fill_close.reason||'take-profit';
							obj.pl				= parseFloat(_fill_close.pl);
							obj.spread			= parseFloat(_fill_close.halfSpreadCost);
							obj.financing		= Math.abs(parseFloat(_fill_close.financing));
							obj.ids.close_fill	= _fill_close.id;
						}
					}
					
					// Stop Loss
					var _sl = sl[_fill_open.id];
					if (_sl) {
						obj.stop_loss		= parseFloat(_sl.price);
						obj.ids.sl			= _sl.id;
						
						// Did it execute?
						var _fill_close = fill_close[_sl.id];
						if (_fill_close) {
							obj.close			= parseFloat(_fill_close.price);
							obj.balance_close	= parseFloat(_fill_close.accountBalance);
							obj.close_time		= _fill_close.time;
							obj.close_reason	= _fill_close.reason||'stop-loss';
							obj.pl				= parseFloat(_fill_close.pl);
							obj.spread			= parseFloat(_fill_close.halfSpreadCost);
							obj.financing		= Math.abs(parseFloat(_fill_close.financing));
							obj.ids.close_fill	= _fill_close.id;
						}
					}
					
					// Close
					var _close = close[_fill_open.id];
					if (_close) {
						obj.ids.close	= _close.id;
						// Close Fill
						var _fill_close = fill_close[_close.id];
						if (_fill_close) {
							obj.close			= parseFloat(_fill_close.price);
							obj.balance_close	= parseFloat(_fill_close.accountBalance);
							obj.close_time		= _fill_close.time;
							obj.close_reason	= _fill_close.reason||'unknown';
							obj.pl				= parseFloat(_fill_close.pl);
							obj.spread			= parseFloat(_fill_close.halfSpreadCost);
							obj.financing		= Math.abs(parseFloat(_fill_close.financing));
							obj.ids.close_fill	= _fill_close.id;
						}
					}
				}
				
				// Cancel
				var _cancel = cancel[item.id];
				if (_cancel) {
					obj.cancel_time	= _cancel.time;
					obj.cancel		= _cancel.reason;
				}
				
				
				// Pip calculation
				var jpy_regex = /jpy/gmi;
				if (jpy_regex.test(obj.instrument)) {
					var pip = 0.01;
				} else {
					var pip = 0.0001;
				}
				
				obj.pip	= Math.floor((obj.close-obj.open)/pip) * (parseFloat(item.units)>0?1:-1);
				
				
				return obj;
			});
			
			positions.sort(function(a, b) {
				return new Date(a.open_time).getTime()-new Date(b.open_time).getTime();
			});
			
			return positions;
		},
		// Shortcut for GET requests
		post:	function(endpoint, params, callback) {
			OandaLib.api("POST", endpoint, params, callback);
		},
		// Shortcut for GET requests
		get:	function(endpoint, params, callback) {
			OandaLib.api("GET", endpoint, params, callback);
		},
		// API call on Oanda
		api:	function(method, endpoint, params, callback) {
			var obj = {
				url:		"https://"+(settings.live?"api-fxtrade":"api-fxpractice")+".oanda.com/v3"+endpoint,
				method: 	method,
				json:		params,	// One or the other...
				qs:			params,	// One or the other...
				headers:	{
					"Content-Type":		"application/json",
					"Authorization":	"Bearer "+settings.OANDA_KEY
				}
			};
			if (obj.method=='GET') {
				obj.url+='?'+querystring.stringify(params)
			}
			//core.log("Oanda", "api obj", obj);
			
			request(obj, function(error, response, body) {
				/*var output;
				try {
					output	= JSON.parse(body);
				} catch (e) {
					callback({
						status:		'Request Error',
						error:		error,
						body:		body,
						response:	response
					});
					return false;
				}
				
				callback(output.body);*/
				callback(body);
			});
		},
	}
	return OandaLib;
}



module.exports = lib;