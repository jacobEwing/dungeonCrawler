// grab a rectangular subset of a 2d array.  This will use the x1, x2 etc. values strictly as real locations, so there
// will be no available tricks with negative numbers and the like as you get with Array.slice.
Array.prototype.gridSubset = function(x1, y1, w, h, filler){
	if(filler == undefined) filler = null;
	var x2, y2, extra;
	var padding = {
		top : 0,
		bottom : 0,
		left : 0,
		right : 0
	};

	// scrub the width and height paramaters and calculate the resulting area
	if(w == 0 || h == 0){
		throw "Array::gridSubset: width and height can not be equal to zero";
	}
	if(w < 0){
		x1 += w;
		w *= -1;
	}
	if(h < 0){
		y1 += h;
		h *= -1;
	}

	x2 = x1 + w - 1;
	y2 = y1 + h - 1;


	// if all of our coordinates are outside of the array.  Return nothing but the filler.
	if(x2 < 0 || y2 < 0 || x1 >= this.length || y1 >= this[0].length){
		return Array(w).fill().map(() => Array(h).fill(filler));
	}

	// now restrict our subset to fit the actual dimensions of the array
	if(y1 < 0){
		padding.top = -y1;
		y1 = 0
	}
	if(x1 < 0){
		padding.left = -x1;
		x1 = 0;
	}
	if(x2 >= this.length){
		padding.right = x2 - this.length + 1;
		x2 = this.length - 1;
	}

	// here we assume that each vertical array is the same length and that this contains a zero index.
	if(y2 >= this[0].length){
		padding.bottom = y2 - this[0].length + 1;
		y2 = this[0].length - 1;
	}

	// grab the actual content that can be read from the source
	var subset = this.map(function(r){ return r.slice(y1, y2 + 1); }).slice(x1, x2 + 1);


	// now if there are any overlaps outside the array, we need to use the filler
	// add the left padding
	if(padding.left > 0){
		extra = new Array(padding.left);
		extra.fill(Array(y2 - y1 + 1).fill(filler), 0, padding.left);
		subset = extra.concat(subset);
	}

	// add the right padding
	if(padding.right > 0){
		extra = new Array(padding.right);
		extra.fill(Array(y2 - y1 + 1).fill(filler), 0, padding.right);
		subset = subset.concat(extra);
	}

	// add top padding
	if(padding.top > 0){
		extra = new Array(padding.top);
		extra.fill(filler, 0, padding.top);
		subset = subset.map(function(r){ return extra.concat(r);}); 
	}

	// add bottom padding
	if(padding.bottom > 0){
		extra = new Array(padding.bottom);
		extra.fill(filler, 0, padding.bottom);
		subset = subset.map(function(r){ return r.concat(extra);}); 
	}

	return subset;

}

// returns an HTML table displaying the contents of a 2d array
Array.prototype.toTable = function (){
	if(!Array.isArray(this[0])){
		throw "ArrayToTable expects single argument to be a two dimensional array";
	}
	var x, y;
	var row, cell, table = document.createElement('TABLE');
	for(y = 0; y < this[0].length; y++){
		
		row = table.insertRow(y);
		for(x = 0; x < this.length; x++){
			cell = row.insertCell(x);
			cell.innerHTML = this[x][y];
		}
	}
	return table;
}

// returns a random integer from 0 to limit - 1
var randomInt = function(limit){
	return Math.floor(Math.random() * limit);
}

var randomText = (function(){
	var randomTextCache = [], randomTextCount = 0;
	// returns "numChars" random characters that have not been returned previously
	return function(numChars){
		var n, c, i;
		var returnval = '';

		// note: this will cause an infinite loop if more than 26^numChars strings are asked for. 
		do{
			for(n = 0; n < numChars; n++){
				i = Math.round(Math.random() * 25);
				c = String.fromCharCode(65 + i);
				returnval = returnval + c;
			}
			inUse = false;
			for(n = 0; n < randomTextCount; n++){
				if(randomTextCache[n] == returnval){
					inUse = true;
					break;
				}
			}
		}while(inUse);
		randomTextCache[randomTextCount] = returnval;
		randomTextCount++;
		return returnval;
	}
	
})();

// does a quicksort on an array of values, with optional custom comparison function. (default is numeric ascending)
function quickSort(sourcelist, comparison){
	if(comparison == undefined){
		comparison = function(a, b){ return a > b ? true : false};
	}

	var list = sourcelist.slice(0);
	if(list.length <= 1) return list

	var n, middle;
	middle = list.pop();
	var greater = Array(), lesser = Array();
	for(n = 0; n < list.length; n++){
		if(comparison(middle, list[n])){
			lesser.push(list[n]);
		}else{
			greater.push(list[n]);
		}
	}
	if(lesser.length > 1){
		lesser = quickSort(lesser, comparison);
	}
	if(greater.length > 1){
		greater = quickSort(greater, comparison);
	}
	
	lesser.push(middle);
	list = lesser.concat(greater);
	return list;

}


// an object allowing global references to objects
var globalRefs = {
	refs: [],
	add: function(obj){
		var tag = randomText(8);
		this.refs[tag] = obj;
		return tag;
	},
	get: function(tag){
		return this.refs[tag];
	}
};

// tell me if it's an array
function is_array(input){
	return typeof(input) == 'object' && (input instanceof Array);
}

// precede backslash characters and double quotes with backslash characters
function parseQuotes(text){
	if(text == undefined) return text;

	returnval = text.replace(/\\/g, '\\\\');
	returnval = returnval.replace(/\"/g, '\\"');
	return returnval;
}

function in_array(needle, haystack) {
	return haystack.indexOf(needle) != -1;
}


function write(text, style, useBreak){ // need to rewrite this to NOT use jquery
	if(style == undefined) style = 'font-weight:bold; color:#FFF';
	if(useBreak == undefined) useBreak = true;

	_console = $('#console');
	_console.append('<span style="' + style + '">' + text + '</span>');
	if(useBreak) _console.append('<br/>');
	h1 = _console.innerHeight();
	h2 = _console.attr('scrollHeight');
	_console.scrollTop(h2 - h1);
}

function error(text){
	write('[ERROR]: ' + text, "font-weight: bold; color: #F55");
}

function popup(message, lockscreen){ // rewrite to NOT use jquery
	if(lockscreen == undefined) lockscreen = true;
	var messageDiv = $('<div style="text-align:center"></div>');

	messageDiv.append(message);

	messageDiv.dialog({
		modal: true,
		resizable: false,
		close: function() { 
			$(this).remove();
		},
		buttons: {
			"Close": function() { 
				$(this).dialog("close");
//				$(this).remove();
			}
		}
	});

}
