var File = require('fs');
var Util = require("util");
var IRCBot = require("./lib/irc").IRCBot;
var Sandbox = require("./lib/sandbox");

var V8Bot = function(profile) {
	this.sandbox = new Sandbox();

	IRCBot.call(this, profile);
	this.set_log_level(this.LOG_ALL);
	this.set_command_identifier("!"); // Exclamation
	this.load_ecma_ref();
};

Util.inherits(V8Bot, IRCBot);

V8Bot.prototype.init = function() {
	IRCBot.prototype.init.call(this);

	// >> command to execute javascript code
	this.register_listener(/^(>>>?)([^>].*)+/, function(channel, user, text, command, code) {
		var engine = (command === ">>>" ? "v8" : "spidermonkey");
		this.sandbox.run(engine, 2000, code, function(result) {
			var reply;

			try {
				/* If theres an error, show that.
				   If not, show the type along with the result */
				if (result.error !== null) {
					reply = result.error;
				} else {
					if (result.data.type !== null) {
						reply = (result.data.obvioustype ? "" :
							"("+result.data.type+") ") + result.result;
					} else {
						reply = "undefined (Nothing returned)";
					}
				}
				
				if (typeof result.data.console !== "undefined") {
					// Add console log output
					if (result.data.console.length) {
						reply += "; Console: "+result.data.console.join(", ");
					}
				}

				this.send_truncated(channel, reply, user.name+": ");
			} catch (e) {
				channel.send(
					user.name+": UnforseenError: "+e.name+": "+e.message);
			}
		}, this);
	});

	this.register_listener(/^(\S+)(\+\+|--);?$/,
		function(channel, user, text, nick, operation) {
		if (operation === "++") {
			if (nick.toLowerCase() !== "c") {
				channel.send(user.name + ": Even if " + nick +
					" deserves any beer, I don't have any to spare.");
			} else {
				channel.send(user.name + ": C doesn't deserve beer.");
			}
		} else {
			channel.send_action(
				"steals a beer a from " + nick + ", since we're taking 'em.");
		}
	});

	// Generates a randomly-sized dick each time
	this.register_command("dick", function(channel, user, text) {
		var reply = "8"+(new Array(1+((Math.random()*9)|0)).join("="))+"D";
		channel.send(user.name+": "+reply);
	});

	// Generates an ascii unicorn
	this.register_command("cornify", function(channel, user, text) {
		channel.send(user.name+": `^nn~");
	});

	// Generates kirby
	this.register_command("kirby", function(channel, user, text) {
		channel.send(user.name+": <(n_n<) <(n_n)> (>n_n)>");
	});

	// Raw irc command
	this.register_command("raw", function(channel, user, text) {
		if (user.name === "eboyjr") {
			channel.client.raw(text);
		} else {
			channel.send(user.name +
				": You need to be eboyjr to send raw commands.");
		}
	});

	// ECMA-262 Reference
	this.register_command("ecma", function(channel, user, text) {
		try {

		if (typeof this.ecma_ref === "undefined") {
			channel.send(user.name + ": The ECMA-262 reference is not loaded.");
			return;
		}

		var chain = text.replace(/[^A-Z0-9_.]/gi, '').split(".");
		var len = chain.length;
		if (!len) {
			channel.send(user.name + ": No arguments");
			return;
		}
		var result;
		newaccess: for (var i = 0; i < len; i++) {
			if (i === 0) {
				if (typeof this.ecma_ref[chain[i]] !== "undefined") {
					result = this.ecma_ref[chain[i]];
					continue newaccess;
				}
				channel.send(
					user.name + ": Unexpected '" + chain[i] +
					"'; Expected built-in ECMA-262 object (" +
					Object.getOwnPropertyNames(this.ecma_ref).sort().join(", ") +
					")");
				return;
			}
			if (typeof result.properties !== "undefined") {
				if (typeof result.properties[chain[i]] !== "undefined") {
					result = result.properties[chain[i]];
					continue newaccess;
				}
			}
			channel.send(
				user.name+": "+chain.splice(0, i+1).join(".")+" is not defined.");
			return;
		}
		var string = chain.join(".");
		var reply  = [];

		// Summary
		if (typeof result.summary !== "undefined")
			reply.push(result.summary);
		else reply.push("No summary available.");

		// Syntax
		if (typeof result.syntax !== "undefined")
			reply.push("Syntax: "+result.syntax);

		// Parameters
		if (typeof result.parameters !== "undefined") {
			var parameters = [];
			parameters.push("Parameters:");
			for (var i in result.parameters) {
				parameters.push(i+" = "+result.parameters[i]+";");
			}
			reply.push(parameters.join(" "));
		}

		// Returns
		if (typeof result.returns !== "undefined") {
			reply.push("Returns: "+result.returns+".");
		}

		channel.send(user.name+": "+string+": "+reply.join(" || "));

		} catch (e) { channel.send(user.name+": "+e.name+": "+e.message); }
	});

	// Evalutates regular expressions
	this.register_command("re", function(channel, user, msg) {

		var parseRegex = (~msg.indexOf("@") ? /(.*)\s+@\s+(\S+)$/.exec(msg) : msg);
		if (Array.isArray(parseRegex) && parseRegex.length > 1) {
			parseRegex = parseRegex[1];
		}

		var mre = /^(.*)\s(?:m|(?=\/))([^\w\s\\])((?:\\.|(?!\2)[^\\])*)\2([a-z]*)\s*$/.exec(parseRegex);
		var sre = /^(.*)\ss([^\w\s\\])((?:\\.|(?!\2)[^\\])*)\2((?:\\.|(?!\2)[^\\])*)\2([a-z]*)\s*$/.exec(parseRegex);

		if (mre && mre.length >= 4) {
			var s = mre[1], r = mre[3], f = mre[4], out = [], m;

			if (~f.toLowerCase().indexOf("g")) {
				var gRegex = RegExp(r, f);
				out = s.match(gRegex).join(", ") || "No matches found.";
			} else {
				var regOut = RegExp(r, f).exec(s);
				if (regOut) out = regOut.join(", ");
				else out = "No matches found.";
			}

			channel.send(user.name+": "+out);
		} else if (sre && sre.length >= 4) {
			var s = sre[1], r = sre[3], u = sre[4], f = sre[5], out = [], m;

			var gRegex = RegExp(r, f);
			out = s.replace(gRegex,u);

			channel.send(user.name+": "+out);
		} else {
			channel.send(user.name+": Invalid syntax: Usage: `re text /regex/flags");
		}
	});

	// About
	this.register_command("about", function(channel, user, text) {
		channel.send(user.name + ": "+channel.client.nick +
			" is an IRC bot written entirely in Javascript using Google's v8 Javascript engine and Node.js. Credits: eisd, Tim_Smart, gf3, MizardX, inimino, eboyjr. Join us at #v8bot!");
	});

	// What is the topic
	this.register_command("topic", function(channel, user) {
		channel.send(user.name+": "+channel.topic);
	});

	// Quit
	this.register_command("quit", function(channel, user) {
		if (user.name == "eboyjr") this.quit();
	});
	
	this.register_command("help", function(channel, user) {
		channel.send(user.name + ": Use the `>>` command for the SpiderMonkey JavaScript interpreter, and use the `>>>` command for the V8 JavaScript interpreter.");
	});

	this.on('command_not_found', function(channel, user, command) {
		channel.send(user.name + ": '" + command +
			"' is not recognized as a valid command. Valid commands are: "+this.get_commands().join(", "));
	});
	
};

V8Bot.prototype.load_ecma_ref = function() {
	var filename = "/var/www/node/ebot/ecma-ref.js";
	Util.puts("Loading ECMA-262 reference...");
	var bot = this;
	File.readFile(filename, function (err, data) {
		if (err) Util.puts(Util.inspect(err));
		try {
			bot.ecma_ref = eval('('+data+')');
		} catch (e) {
			Util.puts("ECMA-262 Error: "+e.name+": "+e.message);
		}
	});
	if (typeof this.ecma_ref_watching === "undefined") {
		this.ecma_ref_watching = true;
		File.watchFile(filename, function (curr, prev) {
			Util.puts("ECMA-262 reference file has changed.");
			bot.load_ecma_ref();
		});
	}
};

(new V8Bot([{
	host: "irc.freenode.net",
	port: 6667,
	nick: "vbotjr",
	password: null,
	user: "eboyjr",
	real: "A v8bot overhaul",
	channels: ["##eboyjr", "##javascript"]
}])).init();
