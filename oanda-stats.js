#!/usr/bin/env node

var express		= require('express');
var cors		= require('cors');
var bodyParser	= require('body-parser');
var shell		= require('shelljs');
var pstack		= require('pstack');
var fstool		= require('fs-tool');
var path		= require('path');
var _			= require('underscore');
var mkdirp		= require('mkdirp');
var prompts		= require('prompts');
var open		= require('open');
var Oanda		= require('./lib/oanda');
var Appdir		= require('appdirectory');
var dirs		= new Appdir('oanda-stats');

/*
	oanda-stats 
*/

var cli;
cli = {
	init:	function() {
		var args = cli.processArgs();
		
		var stack	= new pstack();
		var buffer	= {};
		var settings = {};
		
		// Get the settings
		stack.add(function(done) {
			cli.getSettings(function(response) {
				settings = response;
				done();
			});
		});
		
		// Refresh?
		stack.add(function(done) {
			var params = [{
				type:		'text',
				name:		'refresh',
				message:	'Refresh? (Y/n)',
				initial:	'Y',
				required:	true
			}];
			
			cli.request(params, function(input) {
				if (input.refresh.toLowerCase()=='y' || !settings[settings.OANDA_ACC].refreshed) {
					cli.refreshTransactions(settings, function(response) {
						done();
					});
				} else {
					done();
				}
			});
		});
			
		// Launch the local server
		stack.add(function(done) {
			cli.launchLocalServer(settings, done);
		});
		
		stack.start(function() {
			//cli.log("Goodbye.");
		});
	},
	launchLocalServer:	function(settings, callback) {
		var app			= express()
		var port		= parseInt(settings.port)||8080;
		var staticPath	= path.normalize(__dirname+path.sep+'public');
		
		
		app.use(express.static(staticPath));
		
		app.use(bodyParser.json({limit: '50mb'}))
		app.use(bodyParser.urlencoded({limit: '50mb', extended: true}))
		app.use(cors());
		
		app.all("/", function(req, res) {
			res.send(fs.readFileSync(path.normalize(__dirname+path.sep+'public'+path.sep+'index.html'), 'utf8'));
		});
		var catchAllRegex = RegExp('api\/(.)?'); // /api\/(.)?/gmi
		app.all(catchAllRegex, function(req, res) {
			require('./api/api').main(cli, settings, req, res);
		});

		app.listen(port, function () {
			console.log("Started ("+port+")");
			(async () => {
				await open('http://localhost:'+port+'/');
				callback();
			})();
		})
	},
	refreshTransactions:	function(settings, callback) {
		var oanda = new Oanda(settings);
		oanda.refreshTransactions(function(transactions) {
			if (!transactions) {
				cli.log("error", "Failed to refresh the data. Check your API keys.");
				return false;
			}
			
			var history = oanda.transactionsToHistory(transactions);
			// cli.log("Transactions:", transactions.length);
			// cli.log("history:", history.length);
			
			var stack	= new pstack();
			var buffer	= {};
			
			// Save the transactions
			stack.add(function(done) {
				fstool.file.writeJson(cli.filename(settings, "transactions-"+settings.OANDA_ACC+".json"), transactions, function() {
					done();
				});
			});
			
			// Convert to the history format and save
			stack.add(function(done) {
				fstool.file.writeJson(cli.filename(settings, "history-"+settings.OANDA_ACC+".json"), history, function() {
					done();
				});
			});
			
			// Update & save the settings
			stack.add(function(done) {
				settings.accounts[settings.OANDA_ACC].refreshed = new Date();
				cli.saveSettings(settings, done);
			});
			
			stack.start(function() {
				callback(transactions);
			});
			
		});
	},
	// Request data from the console
	request:	function(data, callback) {
		(async () => {
			var input = await prompts(data);
			
			var pass = true;
			_.each(data, function(item) {
				if (item.required) {
					pass = pass && input.hasOwnProperty(item.name) && !_.isNull(input[item.name]);
				}
			});
			
			if (!pass) {
				cli.log("Error", "Missing parameters.");
				return false;
			}
			
			callback(input);
		})();
	},
	// Save the settings
	saveSettings:	function(settings, callback) {
		fstool.file.writeJson(cli.filename(settings, "settings.json"), settings, function() {
			if (callback) {
				callback();
			}
		});
	},
	// Get the full path of the filename in the right directory we can write in
	filename:	function(settings, file) {
		return path.normalize(settings.directories.userData+path.sep+file);
	},
	// Get the settings
	getSettings:	function(callback) {
		
		
		var __path		= process.cwd().split(path.sep);
		var directory	= __path[__path.length-1];
		
		var settings = {
			directories:	{
				cli:		__filename,
				userData:	dirs.userData(),
				userConfig:	dirs.userConfig(),
				userCache:	dirs.userCache(),
				userLogs:	dirs.userLogs()
			},
			accounts: {}
		};
		
		cli.log("dirs.userData()", dirs.userData());
		
		var stack	= new pstack();
		var buffer	= {};
		
		// Create the directory if it doesn't exist
		stack.add(function(done) {
			mkdirp(settings.directories.userData, function(err) {
				if (err) {
					cli.log("Error, settings path couldn't be created", err);
				}
				done();
			});
		});
		
		// Find the settings file
		stack.add(function(done) {
			cli.log("file", cli.filename(settings, "settings.json"));
			fstool.file.readJson(cli.filename(settings, "settings.json"), function(jsonSettings) {
				
				if (!jsonSettings) {
				} else {
					settings = _.extend(settings, jsonSettings);
				}
				done();
			});
		});
		
		// Create & init the settings file if it doesn't exist
		stack.add(function(done) {
			var params = [{
				type:		'text',
				name:		'OANDA_ACC',
				message:	'OANDA ACCOUNT ID',
				initial:	settings.OANDA_ACC,
				required:	true
			},{
				type:		'text',
				name:		'OANDA_KEY',
				message:	'OANDA API KEY',
				initial:	settings.OANDA_KEY,
				required:	true
			},{
				type:		'text',
				name:		'live',
				message:	'Live API? (Y/n)',
				initial:	settings.live?'Y':'n',
				required:	true
			}];
			
			cli.request(params, function(input) {
				input.live	= input.live.toLowerCase()=='y';
				settings	= _.extend(settings, input);
				done();
			});
			
		});
		
		// Create the account directory if it doesn't exist
		stack.add(function(done) {
			mkdirp(cli.filename(settings, settings.OANDA_ACC), function(err) {
				if (err) {
					cli.log("Error, settings path couldn't be created", err);
				}
				done();
			});
		});
		
		// First account?
		stack.add(function(done) {
			// First time using that account?
			if (!settings.accounts[settings.OANDA_ACC]) {
				settings.accounts[settings.OANDA_ACC] = {
					refreshed:	false,
					OANDA_ACC:	settings.OANDA_ACC,
					OANDA_KEY:	settings.OANDA_KEY,
					live:		settings.live
				};
				
				var substack	= new pstack();
				
				// Copy the defaults
				substack.add(function(_done) {
					fstool.file.readJson(path.normalize(__dirname+"/defaults/dashboards.json"), function(data) {
						fstool.file.writeJson(cli.filename(settings, settings.OANDA_ACC+"/dashboards.json"), data, function() {
							_done();
						});
					});
				});
				substack.add(function(_done) {
					fstool.file.readJson(path.normalize(__dirname+"/defaults/widgets.json"), function(data) {
						fstool.file.writeJson(cli.filename(settings, settings.OANDA_ACC+"/widgets.json"), data, function() {
							_done();
						});
					});
				});
				
				substack.start(function() {
					done();
				});
			} else {
				done();
			}
		});
		
		// Save
		stack.add(function(done) {
			cli.saveSettings(settings, done);
		});
		
		stack.start(function() {
			callback(settings);
		});
		
	},
	// Convert the console parameters into a JS object I can use
	processArgs:	function() {
		var i;
		var args 	= process.argv.slice(2);
		
		var output 	= {};
		for (i=0;i<args.length;i++) {
			var l1	= args[i].substr(0,1);
			if (l1 == "-") {
				if (args[i+1] == "true") {
					args[i+1] = true;
				}
				if (args[i+1] == "false") {
					args[i+1] = false;
				}
				output[args[i].substr(1)] = args[i+1];
				i++;
			}
		}
		return {
			domain:		args[0],
			command:	args[1],
			args:		output
		};
	},
	// Console logging and stuff
	jpath:	function(jpath, obj, noClone) {
		var parts		= jpath.split('.');
		if (!noClone) {
			var localCopy	= JSON.parse(JSON.stringify(obj));
		} else {
			var localCopy	= obj;
		}
		var pointer		= localCopy;
		var i, l;
		l = parts.length
		for (i=0;i<l;i++) {
			if (!pointer.hasOwnProperty(parts[i])) {
				return null;
			}
			pointer	= pointer[parts[i]];
		}
		return pointer;
	},
	format:	function(jpath, input) {
		/*if (!lib.local) {
			return input;
		}*/
		var formatValue	= cli.jpath(jpath, {
			reset:	37,
			color:	{
				red:	31,
				green:	32,
				yellow:	33,
				blue:	34,
				magenta:35,
				cyan:	36,
				white:	37
			},
			bg:	{
				red:	41,
				green:	42,
				yellow:	43,
				blue:	44,
				magenta:45,
				cyan:	46,
				white:	47
			}
		});
		if (!formatValue) {
			console.log("! Missing format: ", jpath);
			return input;
		}
		if (typeof input == "object") {
			return "\033["+formatValue+"m"+JSON.stringify(input, null, 4)+"\033[37m\033[40m";
		}
		return "\033["+formatValue+"m"+input+"\033[37m\033[40m";
	},
	log:	function() {
		var args	= Array.prototype.slice.call(arguments);
		var output	= cli.format('bg.green', args[0])+' ';
		//output	+= cli.format('bg.green', args[1])+' ';
		args	= args.slice(1);
		_.each(args, function(arg) {
			if (typeof arg == "object") {
				output	+= JSON.stringify(arg,null,4)+' ';
			} else {
				output	+= arg+' ';
			}
		});
		console.log(output);
		return true;
	}
}
cli.init();