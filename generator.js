'use strict';
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
	this.rooms = [];
	// items and mappedItems hold the same data, but indexed differently for convenience
	this.mappedItems = [];
	this.items = {};
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
	this.collidablesMapping = {' ' : 1, '#' : 1, 'W' : 1};
};

mapBuilder.prototype.loadImageMap = function(mapFile){
	var me = this;
	return new Promise(function(resolve, reject){
		me.width = me.height = 0;
		me.mappedItems = [];
		me.items = {};

		var loc = window.location.pathname;
		var dir = loc.substring(0, loc.lastIndexOf('/'));
		var client = new XMLHttpRequest();

		client.onreadystatechange = function(){
			if(this.readyState !== 4) return;
			if(this.status !== 200){
				reject(new Error("mapBuilder::loadImageMap: HTTP " + this.status + " for " + mapFile));
				return;
			}

			var data;
			try {
				data = JSON.parse(this.responseText);
			} catch(e) {
				reject(new Error("mapBuilder::loadImageMap: " + e));
				return;
			}

			var img = new Image();
			img.onload = function(){
				try {
					var x, y, n, c, hexcode;
					me.width = this.width;
					me.height = this.height;
					me.map = me.makeEmptyMap(' ', me.width, me.height);

					if(data.category != undefined){
						me.category = data.category;
					}
					if(data.playerPos != undefined){
						me.playerPos = {
							x : data.playerPos.x,
							y : data.playerPos.y
						};
					}
					me.spritemap = data.spritemap;

					var canvas = document.createElement('canvas');
					canvas.width = me.width;
					canvas.height = me.height;
					var ctxt = canvas.getContext('2d');
					ctxt.drawImage(img, 0, 0);

					var imageData = ctxt.getImageData(0, 0, me.width, me.height).data;
					var idx = 0, hexCode;
					for(y = 0; y < me.height; y++){
						for(x = 0; x < me.width; x++){
							hexCode  = ("0" + Number(imageData[idx    ]).toString(16)).slice(-2).toLowerCase();
							hexCode += ("0" + Number(imageData[idx + 1]).toString(16)).slice(-2).toLowerCase();
							hexCode += ("0" + Number(imageData[idx + 2]).toString(16)).slice(-2).toLowerCase();
							c = data.colourmap[hexCode];
							if(c != undefined){
								me.map[x][y] = c;
							}
							idx += 4;
						}
					}

					for(n in data.items){
						me.addItem(data.items[n]);
					}

					me.resetHideMap();
					me.buildCollisionMap();
					resolve(me);
				} catch(e) {
					reject(e);
				}
			};
			img.onerror = function(){
				reject(new Error("mapBuilder::loadImageMap: failed to load image maps/" + data.image));
			};
			img.src = 'maps/' + data.image;
		};

		client.open('GET', dir + '/' + mapFile);
		client.send();
	});
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
			throw new Error("invalid map type");
	}
	this.spritemap = {
		"T" : "trees",
		"\"" : "grass",
		"." : "stone floor",
		"#" : "stone wall",
		"W" : "water"
	};
	this.resetHideMap();
	this.buildCollisionMap();
}

// read a subset area of the collision map and return it as an array
mapBuilder.prototype.readCollisionMap = function(x1, y1, x2, y2){
	// Convention: 0 = wall, 1 = walkable.  Matches GridNode.isWall() in astar.js,
	// which treats weight 0 as impassable.
	var rval = [];
	var x, y, width, height;
	var mapX, mapY;

	width = x2 - x1;
	height = y2 - y1;

	for(x = 0; x < width; x++){
		mapX = x + x1;
		if(mapX < 0 || mapX >= this.width){
			rval[x] = Array.apply(null, Array(height)).fill(0);
		}else{
			rval[x] = [];
			for(y = 0; y < height; y++){
				mapY = y + y1;
				if(mapY < 0 || mapY >= this.height){
					rval[x][y] = 0;
				}else{
					rval[x][y] = this.collisionMap[mapX][mapY] ? 0 : 1;
				}
			}
		}
	}

	return rval;
}

mapBuilder.prototype.resetHideMap = function(){
	this.hideMap = [];
	for(var x = 0; x < this.width; x++){
		this.hideMap[x] = [];
		for(var y = 0; y < this.height; y++){
			this.hideMap[x][y] = true;
		}
	}
}

mapBuilder.prototype.buildCollisionMap = function(){
	this.collisionMap = [];
	for(var x = 0; x < this.width; x++){
		this.collisionMap[x] = [];
		for(var y = 0; y < this.height; y++){
			this.collisionMap[x][y] = this.collidablesMapping[this.map[x][y]] != undefined ? 1 : 0;
		}
	}
}

mapBuilder.prototype.readParams = function(){
	if(arguments[0] == undefined){
		arguments[0]= {};
	}

	for(const param in this.defaultParams){
		const defaultval = this.defaultParams[param];
		this[param] = arguments[0][param] !== undefined ? arguments[0][param] : defaultval;
	}

	this.width = Number(this.width);
	if(this.width < 3){
		throw new Error("mapBuilder: Invaid width parameter:" + this.width);
	}

	this.height = Number(this.height);
	if(this.height < 3){
		throw new Error("mapBuilder: Invaid height parameter" + this.height);
	}
}


mapBuilder.prototype.buildDungeon = function(){



	var area = this.width * this.height;

	this.map = this.makeEmptyMap(' ');
	this.rooms = [];

	// ok, we have our empty map, now let's do the dirty business!
	var zoom, room, dx, dy, n, m, x, y;

	// first we build a few basic rooms
	var gridStep = Math.round(this.gridscale * Math.pow(area, 1/4));

	var xGrid = Math.floor(this.width / gridStep);
	var yGrid = Math.floor(this.height / gridStep);

	for(var attemptTally = 0; this.rooms.length < 3 && (attemptTally < 1000 || this.rooms.length === 0); attemptTally++){
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
	var x, y, offset, goodSpot, upRoom, uR;
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
			if(x < 0 || x >= this.map.length){
				goodSpot = 0;
				break;
			}
			for(y = this.rooms[upRoom].y - 1; y <= this.rooms[upRoom].y + 1 && goodSpot; y++){
				if(y < 0 || y >= this.map[x].length){
					goodSpot = 0;
					break;
				}
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
	if(this.rooms.length === 0) return;

	// now connect them with hallways
	var connected = {};
	var connectedList = [];
	var n, m, x, y, dx, dy, ix, iy, link, numLinks, minDist, nearestIndex, dist, pick;

	// start with one randomly chosen room
	var first = Math.floor(Math.random() * this.rooms.length);
	connected[first] = true;
	connectedList.push(first);

	for(n = 0; n < this.rooms.length; n++){
		if(connected[n] != undefined){
			continue;
		}

		// this random numLinks, which links to multiple rooms, should be tweakable
		numLinks = Math.floor(Math.random() * 2 + 1);
		for(link = 0; link < numLinks; link++){
			if(link === 0){
				// first link: connect to the nearest already-connected room
				minDist = Infinity;
				nearestIndex = connectedList[0];
				for(m = 0; m < connectedList.length; m++){
					var other = connectedList[m];
					dist = Math.hypot(
						this.rooms[n].x - this.rooms[other].x,
						this.rooms[n].y - this.rooms[other].y
					);
					if(dist < minDist){
						minDist = dist;
						nearestIndex = other;
					}
				}
			}else{
				// subsequent links: pick a random already-connected room
				pick = Math.floor(Math.random() * connectedList.length);
				nearestIndex = connectedList[pick];
			}

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

		// mark n as connected only after its links are drawn, so it can't be
		// chosen as its own target on a subsequent link iteration
		connected[n] = true;
		connectedList.push(n);
	}
};
mapBuilder.prototype.encloseWithBricks = function(){
	// now we surround the rooms with brick
	var x, y, dx, dy;
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
		this.mappedItems[item.x] = [];
	}
	if(this.mappedItems[item.x][item.y] == undefined){
		this.mappedItems[item.x][item.y] = [];
	}
	if(this.items[item.content] == undefined){
		this.items[item.content] = [];
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
	var x, y, dx, dy, tally, rx, ry, n, m, charval;
	var bestTally = -1;
	for(n = 0; n < iterations; n++){
		for(x = 0; x < this.map.length; x++){
			for(y = 0; y < this.map[x].length; y++){
				tally = [];
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
	var newmap = [];
	for(var n = 0; n < width; n++){
		newmap[n] = Array.apply(null, Array(height)).fill(fillchar);
	}
	return newmap;
};
