// utils.js: Script used by all JS engines to interface with the v8bot.

/**
 * Pretty-prints a Javascript value for viewing.
 * Identifies circular references
 **/
var utils = {
	pretty_print: function(value, depth) {

		if (typeof depth === "undefined") {
			depth = 5;
		} else if (!depth) {
			return "\u2026"; // Ellipsis
		}
		if (value === null) return "null";

		var seen = [];

		return (function(value, depth) {

			switch (typeof value) {
			case "undefined": return "undefined";
			case "string": return utils.string_format(value);
			case "number":
			case "boolean": return value.toString();
			case "function":

				if (value.name && value.name !== "anonymous") {
					return "(function) "+value.name;
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
			
				// Only way to get internal [[Class]] property
				var type = Object.prototype.toString.call(value);
				type = type.substring(8, type.length-1);
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
				
				var array = [];
				var braces = "{}";
				
				if (Array.isArray(value)) {
					braces = "[]";
					for( var i = 0, len = value.length; i < len; i++ ) {
						array.push(arguments.callee(value[i], depth-1));
					}
				} else {
					for (var i in value) {
						if (Object.prototype.hasOwnProperty.call(value, i)) {
							array.push(i+": "+arguments.callee(value[i], depth-1));
						}
					}
				}

				seen.pop();
				return braces[0]+array.join(", ")+braces[1];
			//case "xml":
				// Weird syntax!! D:
				//return XML.prototype.function::toXMLString.call(value);
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
		return "\""+value.replace(/[\u0000-\u001f\u007f-\u009f\ufffe-\uffff]/g,
			function(v) {
			var escaped, code = v.charCodeAt(0);
			switch (code) {
			case 0: escaped = "\\0"; break;
			case 8: escaped = "\\b"; break;
			case 9: escaped = "\\t"; break;
			case 10: escaped = "\\n"; break;
			case 12: escaped = "\\f"; break;
			case 13: escaped = "\\r"; break;
			default:
				escaped = "\\" + (code>=256?"u":"x") + (code<=16?"0":"") +
					code.toString(16).toUpperCase();
				break;
			}
			return escaped;
		})+"\"";
	},
	type_is_obvious: function(value) {
		switch (typeof value) {
			case "function":
				var type = Object.prototype.toString.call(value);
				type = type.substring(8, type.length-1);
				if (type === "RegExp") {
					return false;
				}
			case "undefined": return true;
			case "number":
			case "boolean":
			case "string": return false;
			case "object":
				var type = Object.prototype.toString.call(value);
				type = type.substring(8, type.length-1);
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
				console: sandbox.console.data,
				obvioustype: this.type_is_obvious(result)
			},
			error: error ? error.name+": "+error.message : null,
			result: this.pretty_print(result)
		});
	}
};

// Grab new global object, using GlobalObject if available, set by SpiderMonkey
// It is not possible to use a normal object as a global object in SpiderMonkey
var global = (typeof GlobalObject !== "undefined") ? GlobalObject : {};

global.console = {};
//Object.defineProperty(global.console, "data", {value: [], writable: true});
global.console.data = [];
global.console.log = function() {
	for( var i = 0, l = arguments.length; i < l; i++ ) {
		global.console.data.push(utils.pretty_print(arguments[i]));
	}
};
global.print = global.console.log;
global.alert = global.console.log;

global.kirby = function() { return "<(n_n<) <(n_n)> (>n_n)>"; };

global.bf = function(code, input) {
	code = String(code);
	input = String(input);
	var cells = [0];
	var pointer = 0;
	var loopstack = [];
	var output = [];
	var ipointer = 0;
	for (var i = 0, len = code.length; i < len; i++) {
		switch(code.charAt(i)) {
			case '>':
				pointer++;
				if (pointer == cells.length) {
					cells.push(0);
				}
				break;
			case '<':
				pointer--;
				if (pointer < 0) {
					throw {name: "BrainfuckError",
						message: "Can't decrement pointer (char "+(i+1)+")."};
				}
				break;
			case '+':
				if (cells[pointer]++ === 0xffff) cells[pointer] = 0x0000;
				break;
			case '-':
				if (cells[pointer]-- === 0x0000) cells[pointer] = 0xffff;
				break;
			case '[':
				if (cells[pointer]) {
					loopstack.push(i);
				} else {
					var looptermindex = false;
					// Get matching `]` index
					for (var depth = 0; i < len; i++) {
						if (code[i] === '[') depth++;
						else if (code[i] === ']') {
							if (!depth) {
								looptermindex = i-1;
								break;
							}
							depth--;
						}
					}
					if (!looptermindex) {
						throw {name: "BrainfuckError",
							message: "Found `[` (char "+(i+1)+"), but no matching `]`."};
					}
					i = looptermindex;
				}
				break;
			case ']':
				if (!loopstack.length) {
					throw {name: "BrainfuckError",
						message: "Found `]` (char "+(i+1)+"), but no matching `[`."};
				}
				var popped = loopstack.pop();
				if (cells[pointer]) {
					i = popped-1;
				}
				break;
			case '.':
				output.push(cells[pointer]);
				break;
			case ',':
				if (ipointer >= input.length) {
					throw {name: "BrainfuckError",
						message: "Not enough input (char "+(i+1)+")."};
				}
				cells[pointer] = input.charCodeAt(ipointer);
				ipointer++;
				break;
		}
	}
	if (loopstack.length)
		throw {name: "BrainfuckError",
			message: "Non-empty loopstack: "+loopstack+"."};
			
	//return String.fromCharCode.apply(String, output);
	return output;
};

/**
 * The main run function.
 * Accepts a function that executes the code and returns a value,
 * with the specified argument used as a global object
 * Returns a string of json
 **/
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
			if (typeof e === "string" && e.match(/\brocks?\b/)) {
				error = {name: "Error", message: "Haven't you ever been told to never throw rocks?"};
			} else {
				error = {name: "Uncaught value", message: utils.pretty_print(e)};
			}
		}
	}
	return utils.generate(result, error, global);
};
exports.pretty_print = utils.pretty_print;