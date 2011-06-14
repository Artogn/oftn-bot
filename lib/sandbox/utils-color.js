// utils.js: Script used by all JS engines to interface with the v8bot.

// Grab new global object, using GlobalObject if available, set by SpiderMonkey
// It is not possible to use a normal object as a global object in SpiderMonkey
var global = typeof GlobalObject !== "undefined" ? GlobalObject : {};
var consoledata = [];
var timerdata = {};

global.console = {};
global.console.log = function log() {
	for( var i = 0, l = arguments.length; i < l; i++ ) {
		consoledata.push(utils.pretty_print(arguments[i]));
	}
};

global.console.time = function time(name) {
	timerdata[name || "default"] = Date.now();
};
global.console.timeEnd = function timeEnd(name) {
	name = name || "default";
	global.console.log(name+": "+(Date.now() - timerdata[name])+"ms");
};

global.print = global.alert = global.console.log;

/* fake version() */
if (typeof GlobalObject !== "undefined") {
	global.version = function version() { return "1.8.5"; };
} else {
	global.version = function version() { return process.versions.v8; };
}


/**
 * Pretty-prints a Javascript value for viewing.
 * Identifies circular references
 **/
var utils = {
	pretty_print: function(value, depth) {
		if (typeof depth === "undefined") {
			depth = 5;
		}

		var seen = [];

		return (function(value, depth) {
			if (!depth) { return "\x035\u2026\x0F"; /* Ellipsis */}
			if (value === null) return "\x0310null\x0F";
			
			//return typeof value;

			switch (typeof value) {
			case "undefined": return "\x0310undefined\x0F";
			case "string": return utils.string_format(value);
			case "number":
			case "boolean": return "\x0310"+value.toString()+"\x0F";
			case "function":

				if (value.name && value.name !== "anonymous") {
					return "\x032(function)\x0F "+value.name;
				}

				if (Object.prototype.toString.call(value) === "[object RegExp]")
					return RegExp.prototype.toString.call(value);

				// Collapse whitespace
				var str;
				str = Function.prototype.toString.call(value).replace(/\s+/g, " ");
				if (str.length > 48) {
					return str.substr(0, 46)+"\u2026}";
				} else {
					return str;
				}
			case "object":
			
				if (value.developers === value) return "<http://www.youtube.com/watch?v=KMU0tzLwhbE>";
			
				// Only way to get internal [[Class]] property
				var type = Object.prototype.toString.call(value);
				type = type.slice(8, -1);
				switch (type) {
					case "Date":
						return "(object) " +
							Date.prototype.toString.call(value);
					case "Boolean":
						return "(object) " +
							Boolean.prototype.toString.call(value);
					case "Number":
						return "(object) " +
							Number.prototype.toString.call(value);
					case "RegExp": // Sometimes a RegExp is not a function
						return RegExp.prototype.toString.call(value);
					case "String":
						return "(object) " +
							utils.string_format(
								String.prototype.toString.call(value));
				}

				if (~seen.indexOf(value)) return "(Circular)";
				seen.push(value);
				
				var array = [], braces, props, prepend_key;

				if (Array.isArray(value)) {
					braces = "[]";
					props = [];
					prepend_key = false;
					for( var i = 0, len = value.length; i < len; i++ ) {
						props.push(i);
					}
				} else {
					braces = "{}";
					props = Object.getOwnPropertyNames(value).sort();
					prepend_key = true;
				}
				
				for( var i = 0, len = props.length; i < len; i++ ) {
					var desc = Object.getOwnPropertyDescriptor(value, props[i]);
					var string;
					if (typeof desc === "undefined" || desc.hasOwnProperty("value")) {
						string = (prepend_key ? "\x0F"+props[i]+"\x031: " : "") +
							arguments.callee(value[props[i]], depth-1);
					} else {
						var getset = [];
						if (typeof desc.get !== "undefined") getset.push("Getter");
						if (typeof desc.set !== "undefined") getset.push("Setter");
						string = (prepend_key ? props[i]+": " : "") +
							"("+getset.join("/")+")";
					}
					array.push(string);
				}

				seen.pop();
				return "\x031"+braces[0]+array.join("\x031,\x0F ")+"\x031"+braces[1];
			case "xml":
				// Weird syntax!! D:
				return eval("XML.prettyPrinting = false; XML.prototype.function::toXMLString.call(value)");
			}
			return "(unknown)";
		})(value, depth);
	},
	/**
	 * Format string value so it is readable. This replaces control
	 * characters with their hex equivalent in Javascript notation.
	 * Quotes are not escaped for readability. Only double quotes are placed
	 * around it, so it's easy to see that it is a string.
	 **/
	string_format: function(value) {
		return "\x033'"+value.replace(/[\u0000-\u001f\u007f-\u009f\ufffe-\uffff]/g,
			function(v) {
			var escaped, code = v.charCodeAt(0);
			switch (code) {
			case 0: escaped = "\\0"; break;
			case 8: escaped = "\\b"; break;
			case 9: escaped = "\\t"; break;
			case 10: escaped = "↵"; break;
			case 12: escaped = "\\f"; break;
			case 13: escaped = "\\r"; break;
			default:
				escaped = "\\" + (code>=256?"u":"x") + (code<=16?"0":"") +
					code.toString(16).toUpperCase();
				break;
			}
			return "\x0F"+escaped+"\x033";
		})+"'\x031";
	},
	type_is_obvious: function(value) {
		switch (typeof value) {
			case "function":
				var type = Object.prototype.toString.call(value);
				type = type.slice(8, -1);
				if (type === "RegExp") {
					return false;
				}
			case "undefined": return true;
			case "number":
			case "boolean":
			case "string": return false;
			case "object":
				var type = Object.prototype.toString.call(value);
				type = type.slice(8, -1);
				switch (type) {
				case "Date":
				case "Number":
				case "Boolean":
				case "String": return true;
				}
		}
		return false;
	},
	generate: function(result, error, sandbox) {
		return JSON.stringify({
			data: {
				type: typeof result,
				console: consoledata,
				obvioustype: this.type_is_obvious(result)
			},
			error: error ? error.name+": "+error.message : null,
			result: this.pretty_print(result)
		});
	}
};

/**
 * The main run function.
 * Accepts a function that executes the code and returns a value,
 * with the specified argument used as a global object
 * Returns a string of json
 **/
var badthings = ["mutilate your genitals", "beat you", "boil you in hot water", "break all of your bones", "burn you with a branding iron", "castrate you", "give you chinese water torture", "crush you", "sexually assault you", "saw your left leg and left arm off", "tarr and feather you", "waterboard you"];

exports.run = function(execute) {
	var result, error;
	try {
		result = execute(global);
	} catch(e) {
		if (typeof e.name !== "undefined" &&
			typeof e.message !== "undefined") {
			error = e;
			error.name = e.name; // Weird bug
		} else {
			if (typeof e === "string") {
				var matches;
				if (e.match(/\brocks?\b/)) {
					error = {name: "Error", message: "Haven't you ever been told to never throw rocks?"};
				} else if (matches = e.match(/\b(elliottcable|eboyjr|sephr|locks|micahjohnston|cloudhead|FireFly|inimino|gkatsev)\b/i)) {
					error = {name: "InhumaneError", message: "People aren't supposed to be thrown. I'm sure that "+matches[1]+" is now going to "+badthings[Math.random()*(badthings.length)|0]+"."};
				} else if (matches = e.match(/\b(cold|flu)\b/i)) {
					error = {name: "Error", message: "Why do you want to infect people with a cold?"};
				} else if (matches = e.match(/\b(baseball|basketball|ball)\b/i)) {
					error = {name: "Error", message: "You broke a window. Run!"};
				} else if (matches = e.match(/\b(mama|yomama|mother)\b/i)) {
					error = {name: "UncalledFor", message: "Don't you talk about my mother!"};
				} else if (matches = e.match(/\b(turnip)\b/i)) {
					error = {name: "NonsenseError", message: "WHY THE FUCK ARE YOU THROWING A TURNIP! IT DOESN'T MAKE SENSE."};
				} else if (e === "up") {
					error = {name: "Error", message: "No one wants to clean that up."};
				} else {
					error = {name: "Uncaught", message: "No one wanted to catch "+e+"."};
				}
			} else {
				error = {name: "Uncaught value", message: utils.pretty_print(e)};
			}
		}
	}
	return utils.generate(result, error, global);
};
exports.pretty_print = utils.pretty_print;
exports.string_format = utils.string_format;
