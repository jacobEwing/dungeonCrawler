
/* this is a simple chunk of code for generating terrain types, which should
 * vary depending on circumstance.  For instance "dungeon" would be different
 * from "cave", "city", "castle", etc.  We'll start with dungeon. */
var roomClass = function(){
	this.map = null;
	this.x = this.y = 0;
	this.x1 = this.y1 = 0;
	this.x2 = this.y2 = 0;
}

roomClass.prototype.setArea = function(x, y, gridStep, zoom){
	gridStep = Math.abs(gridStep);
	zoom = Math.abs(zoom);

	this.x = Math.round((x + .5) * gridStep);
	this.y = Math.round((y + .5) * gridStep);
	this.x1 = Math.round(this.x - gridStep * zoom / 2);
	this.x2 = Math.round(this.x1 + gridStep * zoom);
	this.y1 = Math.round(this.y - gridStep * zoom / 2);
	this.y2 = Math.round(this.y1 + gridStep * zoom);

	var minSize = 3;
	var dx = this.x2 - this.x1;
	if(dx < minSize){
		this.x1 = this.x2 - minSize;
		if(this.x1 < 0){
			this.x2 -= this.x1;
			this.x1 = 0;
		}
	}

	var dy = this.y2 - this.y1;
	if(dy < minSize){
		this.y1 = this.y2 - minSize;
		if(this.y1 < 0){
			this.y2 -= this.y1;
			this.y1 = 0;
		}
	}
}

var mapBuilder = function(){
	this.width = this.height = 0;
	this.rooms = Array();
	// items and mappedItems hold the same data, but indexed differently for convenience
	this.mappedItems = Array();
	this.items = {};//Array();
	this.defaultParams = {
		'category' : 'dungeon',
		'width' : 60,
		'height' : 25,
		'stairup' : false,
		'stairdown' : false,
		'roomscale' : .9 + Math.random() * .2,
		'gridscale' : 1 + Math.random() * .5,
		'treeChance' : 10,
		'waterChance' : 20,
		'reedChance' : 80
	}
};

mapBuilder.prototype.loadImageMap = function(mapFile, callback){
	this.width = this.height = 0;
	this.mappedItems = Array();
	this.items = {};//Array();

	var me = this;



	var loc = window.location.pathname;
	var dir = loc.substring(0, loc.lastIndexOf('/'));
	var client = new XMLHttpRequest();

	client.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {

			try{
				console.log('loading map');
				data = JSON.parse(this.responseText);
				var img = new Image();
				img.onload = function(){
					console.log('map loaded');
					var x, y, n, c, hexcode, decvals;
					me.width = this.width;
					me.height = this.height;
					me.map = me.makeEmptyMap(' ', me.width, me.height);

					if(data.category != undefined){
						me.category = data.category;
						console.log('set category to ' + me.category);
					}

					if(data.playerPos != undefined){
						me.playerPos = {
							x : data.playerPos.x,
							y : data.playerPos.y
						};
						console.log('assigned player position');
					}
					me.spritemap = data.spritemap;
					console.log('got map legend');

					var canvas = document.createElement('canvas');
					canvas.width = me.width;
					canvas.height = me.height;
					var context = canvas.getContext('2d');

					context.drawImage(img, 0, 0);

					console.log('reading map');
					var imageData = context.getImageData(0, 0, me.width, me.height).data;
					var idx = 0;
					for(y = 0; y < me.height; y++){
						for(x = 0; x < me.width; x++){
							hexCode = ("0" + Number(imageData[idx]).toString(16)).slice(-2).toLowerCase();
							hexCode += ("0" + Number(imageData[idx + 1]).toString(16)).slice(-2).toLowerCase();
							hexCode += ("0" + Number(imageData[idx + 2]).toString(16)).slice(-2).toLowerCase();
							c = data.colourmap[hexCode];
							if(c != undefined){
								me.map[x][y] = c;
							}
							idx += 4;
						}

					}
/*
					for(x = 0; x < me.width; x++){
						for(y = 0; y < me.height; y++){
							decvals = context.getImageData(x, y, 1, 1).data;
							hexCode = '';
							for(n = 0 ; n < 3; n++){
								hexCode += ("0" + (Number(decvals[n]).toString(16))).slice(-2).toLowerCase();
							}

							c = data.colourmap[hexCode];
							if(c != undefined){
								me.map[x][y] = c;
							}

						}
					}
*/
					for(n in data.items){
						me.addItem(data.items[n]);
					}
					console.log('data loaded');
					me.hideMap();
					if(typeof(callback) == 'function'){
						setTimeout(callback, 0);
					}
					//context.getImageData(x, y, 1, 1).data;
				}
				img.src = 'maps/' + data.image;
			}catch(e){
				throw "spriteSet::load: " + e;
			}
		}
	}
	client.open('GET', dir + '/' + mapFile);
	client.send();

/*



	var img = new Image();
	img.src = 'maps/' + map.image;
	var canvas = document.createElement('canvas');
	var context = canvas.getContext('2d');
	context.drawImage(img, 0, 0);
	return context.getImageData(x, y, 1, 1).data;
*/

};

mapBuilder.prototype.build = function(params){
	this.readParams.apply(this, arguments);
	switch(this.category){
		case 'dungeon':
			this.buildDungeon();
			break;
		case 'swamp':
			this.buildSwamp();
			break;
		case 'forest':
			this.buildForest();
			break;
		default:
			throw "invalied map type";
	}
	this.spritemap = {
		"T" : "trees",
		"\"" : "grass",
		"." : "stone floor",
		"#" : "stone wall",
		"W" : "water"
	};
	this.hideMap();
}

mapBuilder.prototype.hideMap = function(){
	this.hideMap = Array();
	for(var x = 0; x < this.width; x++){
		this.hideMap[x] = Array();
		for(var y = 0; y < this.height; y++){
			this.hideMap[x][y] = true;
		}
	}
}

mapBuilder.prototype.readParams = function(){
	if(arguments[0] == undefined){
		arguments[0]= {};
	}
	for(param in this.defaultParams){
		defaultval = this.defaultParams[param];

		if(arguments[0][param] != undefined){
			quote = typeof(arguments[0][param]) == 'string' ? '"' : '';
			eval('this.' + param + ' = ' + quote + arguments[0][param] + quote); 
		}else{
			quote = typeof(defaultval) == 'string' ? '"' : '';
			eval('this.' + param + ' = ' + quote + defaultval + quote); 
		}
	}

	this.width *= 1;
	if(this.width < 3){
		throw "mapBuilder: Invaid width parameter:" + this.width;
	}

	this.height *= 1;
	if(this.height < 3){
		throw "mapBuilder: Invaid height parameter" + this.height;
	}
}


mapBuilder.prototype.buildDungeon = function(){



	var area = this.width * this.height;

	this.map = this.makeEmptyMap(' ');

	// ok, we have our empty map, now let's do the dirty business!
	var zoom, room, dx, dy, n, m, x, y;

	// first we build a few basic rooms
	var gridStep = Math.round(this.gridscale * Math.pow(area, 1/4));

	var xGrid = Math.floor(this.width / gridStep);
	var yGrid = Math.floor(this.height / gridStep);

	var hypsq = xGrid * xGrid + yGrid * yGrid;

	for(var attemptTally = 0; this.rooms.length < 3 && (attemptTally < 1000 || count(this.rooms) == 0); attemptTally++){
		for(x = 0; x < xGrid; x++){
			for(y = 0; y < yGrid; y++){
				// edit this zoom and the if condition to change the varying size of the rooms
				zoom = this.roomscale * (Math.random() * 700 + 300) / 1000;
				if(Math.random() * gridStep < gridStep * zoom){
					room = new roomClass();
					room.setArea(x, y, gridStep, zoom);
					this.rooms[this.rooms.length] = room;

					for(dx = room.x1; dx <= room.x2; dx++){
						for(dy = room.y1; dy <= room.y2; dy++){
							if(dx >= 0 && dx < this.width && dy >= 0 && dy < this.height){
								this.map[dx][dy] = ".";
							}

						}
					}
				}
			}
		}
	}

	this.linkRooms();

	this.encloseWithBricks();

	// were stairs up/down requested?
	if(this.stairup) this.placeinRandomRoom('stairup', 1);
	if(this.stairdown) this.placeinRandomRoom('stairdown', 1);

	return this.map;

}

mapBuilder.prototype.placeinRandomRoom = function(content, emptyTarget, targetTexture){
	if(targetTexture == undefined){
		targetTexture = '.';
	}
	if(emptyTarget == undefined){
		emptyTarget = false;
	}

	// first see if we can find a middle-of-room that fits
	offset = Math.floor(Math.random() * this.rooms.length);
	for(uR = 0; uR < this.rooms.length; uR++){
		upRoom = (uR + offset) % this.rooms.length;
		goodSpot = 1;
		// check to see if it's got a one-block clearance from other objects 
		for(x = this.rooms[upRoom].x - 1; x <= this.rooms[upRoom].x + 1 && goodSpot; x++){
			for(y = this.rooms[upRoom].y - 1; y <= this.rooms[upRoom].y + 1 && goodSpot; y++){
				if(this.map[x][y] != targetTexture){
					goodSpot = 0;
				}else if(emptyTarget && this.mappedItems[x] != undefined){
					if(this.mappedItems[x][y] != undefined){
						goodSpot = 0;
					}
				}
			}
		}
		if(goodSpot){
			// found one!
			break;
		}
	}

	if(goodSpot){
		this.addItem({
			x : this.rooms[upRoom].x,
			y : this.rooms[upRoom].y,
			content : content
		});
	}else{
		// fuck it then, go for any existing floor cell
		this.placeRandomlyOnTexture(content, emptyTarget, targetTexture);
	}
}

mapBuilder.prototype.linkRooms = function(){
	// now connect them with hallways
	var connectedRooms = {};
	connectedRooms[Math.floor(Math.random() * this.rooms.length)] = 1;
	for(var n = 0; n < this.rooms.length; n++){
		if(connectedRooms[n] != undefined){
			continue;
		}
		var didOnce = 0;

		// this random numLinks, which links to multiple rooms, should be tweakable
		for(var numLinks = Math.floor(Math.random() * 2 + 1); numLinks != 0; numLinks --){
			minDist = null;
			nearestIndex = null;
			if(!didOnce){
				for(m in connectedRooms){
					dist = Math.hypot(this.rooms[n].x - this.rooms[m].x, this.rooms[n].y - this.rooms[m].y);
					if(minDist === null || dist < minDist){
						minDist = dist;
						nearestIndex = m;
					}
				}
				didOnce = 1;
			}else{
				var rnum = Math.floor(2 + Math.random() * 10);
				while(rnum > 0){
					for(m in connectedRooms){
						rnum--;
						if(!rnum) break;
					}
				}
				nearestIndex = m;
			}

			connectedRooms[n] = 1;
			dx = this.rooms[nearestIndex].x - this.rooms[n].x;
			dy = this.rooms[nearestIndex].y - this.rooms[n].y;

			ix = dx == 0 ? 0 : (dx < 0 ? -1 : 1);
			iy = dy == 0 ? 0 : (dy < 0 ? -1 : 1);

			if(Math.abs(dx) > Math.abs(dy)){
				for(x = this.rooms[n].x; x != this.rooms[nearestIndex].x; x += ix){
					this.map[x][this.rooms[n].y] = '.';
				}
				for(y = this.rooms[n].y; y != this.rooms[nearestIndex].y; y += iy){
					this.map[x][y] = '.';
				}
			}else{
				for(y = this.rooms[n].y; y != this.rooms[nearestIndex].y; y += iy){
					this.map[this.rooms[n].x][y] = '.';
				}
				for(x = this.rooms[n].x; x != this.rooms[nearestIndex].x; x += ix){
					this.map[x][y] = '.';
				}
			}
		}
	}
};

mapBuilder.prototype.encloseWithBricks = function(){
	// now we surround the rooms with brick
	for(x = 1; x < this.width - 1; x++){
		for(y = 1; y < this.height - 1; y++){
			if(this.map[x][y] == "."){
				for(dx = -1; dx <= 1; dx++){
					for(dy = -1; dy <= 1; dy++){
						if(this.map[x + dx][y + dy] == ' '){
							this.map[x + dx][y + dy] = '#';
						}
					}
				}
			}
		}
	}

	// make sure the edge of the room is enclosed
	for(x = 0; x < this.width; x++){
		if(this.map[x][0] == '.'){
			this.map[x][0] = '#';
		}
		if(this.map[x][this.height - 1] == '.'){
			this.map[x][this.height - 1] = '#';
		}
	}
	for(y = 0; y < this.height; y++){
		if(this.map[0][y] == '.'){
			this.map[0][y] = '#';
		}
		if(this.map[this.width - 1][y] == '.'){
			this.map[this.width - 1][y] = '#';
		}
	}
}

// changes a random character on the map of the value from, to the value to.
// Returns mapped item data if successful, null otherwise
mapBuilder.prototype.placeRandomlyOnTexture = function(content, emptyTarget, targetTexture){
	var width = this.map.length;
	var height = this.map[0].length;
	var rval = null;
	var itemDat;
	console.log('picking a random spot');

	var x = Math.floor(Math.random() * width);
	var y = Math.floor(Math.random() * height);
	for(var tally = 0; tally < width * height; tally++){
		if(this.map[x][y] == targetTexture){
			if(!emptyTarget){
				break;
			}else if(this.mappedItems[x] == undefined){
				break;
			}else if(this.mappedItems[x][y] == undefined){
				break;
			}
		}
		x = (x + 1) % width;
		if(!x) y = (y + 1) % height;
	}

	if(this.map[x][y] == targetTexture){

		itemDat = {
			x : x,
			y : y,
			content : content
		};
		this.addItem(itemDat);
		rval = itemDat;
	}
	return rval;
};

mapBuilder.prototype.findTextureSpot = function(targetTexture){
	var width = this.map.length;
	var height = this.map[0].length;
	var rval = null;

	var x = Math.floor(Math.random() * width);
	var y = Math.floor(Math.random() * height);
	for(var tally = 0; tally < width * height; tally++){
		if(this.map[x][y] == targetTexture) break;
		x = (x + 1) % width;
		if(!x) y = (y + 1) % height;
	}

	if(this.map[x][y] == targetTexture){
		rval = {x : x, y : y};
	}
	return rval;
};


// we have an item created and placed, throw it in the map's data
mapBuilder.prototype.addItem = function(item){
	if(this.mappedItems[item.x] == undefined){
		this.mappedItems[item.x] = Array();
	}
	if(this.mappedItems[item.x][item.y] == undefined){
		this.mappedItems[item.x][item.y] = Array();
	}
	if(this.items[item.content] == undefined){
		this.items[item.content] = Array();
	}
	this.items[item.content].push(item);
	this.mappedItems[item.x][item.y][this.mappedItems[item.x][item.y].length] = item;
}

// Render a forest terrain
mapBuilder.prototype.buildForest = function(){


	var area = this.width * this.height;
	this.map = this.makeEmptyMap('"');


	// ok, we have our empty map, now let's do the dirty business!
	var gridStep = Math.round(Math.pow(area, .125));

	var xGrid = Math.floor(this.width / gridStep);
	var yGrid = Math.floor(this.height / gridStep);
	var x, y, dx, dy;

	for(x = 0; x < xGrid; x++){
		for(y = 0; y < yGrid; y++){
			if(!Math.floor(Math.random() * gridStep)){
				for(dx = 0; dx < gridStep; dx++){
					for(dy = 0; dy < gridStep; dy++){
						this.map[x * gridStep + dx][y * gridStep + dy] = "T";
					}
				}
			}
		}
	}

	// let's run the game of life on it to give it a more chaotic look
	this.life(8, '"');

	if(this.stairdown){
		// clear some brush and add a dungeon entrance.
		var entrance = this.placeRandomlyOnTexture('caveEntrance', false, '"');
		if(entrance != null){
			for(x = entrance.x - 3; x <= entrance.x + 3; x++){
				for(y = entrance.y -3; y <= entrance.y + 3; y++){
					// round the corners
					if(Math.abs(x - entrance.x) + Math.abs(y - entrance.y) >= 5){
						continue;
					}

					if(x >= 0 && x < this.width && y >= 0 && y < this.height){
						console.log('clearing ' + x + ', ' + y);
						this.map[x][y] = '"';
					}
				}
			}
		}
	}

	return this.map;
}

// Render a swamp terrain
mapBuilder.prototype.buildSwamp = function(){


	var area = this.width * this.height;
	this.map = this.makeEmptyMap('"');

	// ok, we have our empty map, now let's do the dirty business!
	var gridStep = Math.round(Math.pow(area, .125));

	var xGrid = Math.floor(this.width / gridStep);
	var yGrid = Math.floor(this.height / gridStep);
	var x, y, dx, dy, drawchar, chance;

	var totalChance = this.treeChance + this.waterChance + this.reedChance;

	for(x = 0; x < xGrid; x++){
		for(y = 0; y < yGrid; y++){
			if(!Math.floor(Math.random() * gridStep / 2)){
				chance = Math.floor(Math.random() * totalChance);
				if(chance < this.treeChance){
					drawchar = 'T';
				}else if(chance < this.treeChance + this.waterChance){
					drawchar = '=';
				}else{
					drawchar = '"';
				}
					drawchar = 'T';
				for(dx = 0; dx < gridStep; dx++){
					for(dy = 0; dy < gridStep; dy++){
						this.map[x * gridStep + dx][y * gridStep + dy] = drawchar;
					}
				}
			}
		}
	}

	// let's run the game of life on it to give it a more chaotic look
	this.life(5, ['"', '=']);
	return this.map;
}

// a competetive version of the game of life, which allows competing life forms
mapBuilder.prototype.life = function(iterations, deadchar){
	var newMap = this.makeEmptyMap(' ', this.map.length, this.map[0].length);
	var x, y, dx, dy, tally, rx, ry, n, charval;
	for(n = 0; n < iterations; n++){
		for(x = 0; x < this.map.length; x++){
			for(y = 0; y < this.map[x].length; y++){
				tally = Array();
				for(dx = -1; dx <= 1; dx++){
					for(dy = -1; dy <= 1; dy++){
						if(dx == 0 && dy == 0) continue;
						rx = (x + dx + this.map.length) % this.map.length;
						ry = (y + dy + this.map[rx].length) % this.map[rx].length;

						charval = this.map[rx][ry];
						if(tally[charval] == undefined){
							tally[charval] = 1;
						}else{
							tally[charval]++;
						}

					}
				}
				bestTally = -1;
				for(m in tally){
					if(tally[m] > 1 && tally[m] < 4){
						if(bestTally == -1 || tally[bestTally] < tally[m]){
							bestTally = m;
						}
					}
				}
				if(bestTally != -1){
					newMap[x][y] = bestTally;
				}else{
					if(typeof(deadchar) == 'object'){
						newMap[x][y] = deadchar[Math.floor(Math.random() * deadchar.length)];
					}else{
						newMap[x][y] = deadchar;
					}
				}
			}
		}

		for(x = 0; x < this.map.length; x++){
			for(y = 0; y < this.map[x].length; y++){
				this.map[x][y] = newMap[x][y];
			}
		}
	}
	return this.map;
}

// initialize a clean map of the specified dimensions.
mapBuilder.prototype.makeEmptyMap = function (fillchar, width, height){
	if(width == undefined) width = this.width;
	if(height == undefined) height = this.height;
	if(fillchar == undefined) fillchar = ' ';
	var newmap = Array();
	for(var n = 0; n < width; n++){
		newmap[n] = Array.apply(null, Array(height)).map(String.prototype.valueOf, fillchar);
	}
	return newmap;
};
