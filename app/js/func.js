var func = {
	map: function(data, that, fn) {
		if (!func.isArray(data))
			throw 'GPXParser._map: first argument must be array. It is:{' + data + '} ' + (data.constructor);

		// = arguments.splice(0, 3); if this was possible
		var args = [null];
		for (var i=3; i<arguments.length; i++)
			args.push(arguments[i]);

		for(var i=0; i<data.length; i++) {
			args[0] = data[i];
			fn.apply(that, args);
		}
	},

	isArray : function(obj) {
		if (obj != undefined
			&& obj.constructor.toString().indexOf("Array") >= 0)
			return true;
		else
			return false;
	}
}
