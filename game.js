'use strict';
/*
Math.random = (function(){
	var seed = 2;
	return function() {
		var x = Math.sin(seed++) * 10000;
		return x - Math.floor(x);
	}
})();
*/
var keyboard;
var mouse;
var gameCanvas;
var viewRange = {};
var playerSpriteSet = new spriteSet();
var spriteSets = {}, sprites = {};
var player;
var gameScale = 5, cellSize = 12;
var maps = [];
var activeMap;
var context;
var gamePaused = false;
var lastFrameTime = 0;
var walkSpeed = 3 * (1000 / 70);
var screenMiddle = {x: 0, y : 0};
var characters = [];
var showGameGrid = false;
var isTransitioning = false; // guards useEntrance against overlapping fades
var waterCycle = 0;
var waterCycleAccum = 0;
var waterCycleRate = 14;   // advances per second; matches the old ~14 Hz tick

var mousePointers = {};

var characterClass = function(){
	this.position = {x : 0, y : 0};
	this.mapPos = {x : 0, y : 0};
	this.sprite = null;
	this.currentSequence = null;
	this.currentEndFrame = null;
	this.category = null;
	this.skills = {
		speed : walkSpeed,
		vision: 6
	};
	this.target = null;
	this.walkPath = [];
	this.possessions = [];
	this.moveBudget = 0;    // <-- new: fractional pixel carry-over between frames
};

characterClass.prototype.setMapPos = function(x, y){
	// our grid position on the map
	if(this == player){
		activeMap.playerPos.x = x;
		activeMap.playerPos.y = y;
	}
	this.mapPos.x = x;
	this.mapPos.y = y;

	// our real position in the map
	this.position.x = cellSize * x;
	this.position.y = cellSize * y;
};

characterClass.prototype.canWalkOn = function(posx, posy){
	var roundX = Math.floor(1 * posx / cellSize)
	var roundY = Math.floor(1 * posy / cellSize)
	var map = activeMap.map;
	var rval = true;
	if(roundX < 0 || roundY < 0 || roundX >= map.length || roundY >= map[roundX].length){
		rval = false;
	}else if({'#' : 1, 'W' : 1}[map[roundX][roundY]] != undefined){
		rval = false;
	}
	return rval;
};

characterClass.prototype.currentMapVal = function(){
	var map = activeMap.map;
	var pos = this.mapPos;
	var rval;

	if(pos.x < 0 || pos.y < 0 || pos.x >= map.length || pos.y >= map[pos.x].length){
		rval = null;
	}else{
		rval = map[pos.x][pos.y];
	}
	return rval;


};

characterClass.prototype.touchingItems = function(){
	var x = this.mapPos.x;
	var y = this.mapPos.y;
	if(activeMap.mappedItems[x] == undefined) return [];
	if(activeMap.mappedItems[x][y] == undefined) return [];
	// Return a shallow copy of the cell's item list.  The previous version
	// concatenated the same array once per element, which multiplied the
	// contents by the array length.
	return activeMap.mappedItems[x][y].slice();
};

characterClass.prototype.moveTowardsTarget = function(pixelsBudget){
	if(this.motionData == undefined){
		this.motionData = {
			xTally : 0,
			yTally : 0,
			lastDirX : 0,
			lastDirY : 0,
			hasDir : false
		};
	}

	if(this.target == null) return;

	var dx = this.target.x - this.position.x;
	var dy = this.target.y - this.position.y;
	var sgndx = Math.sign(dx);
	var absdx = Math.abs(dx);
	var sgndy = Math.sign(dy);
	var absdy = Math.abs(dy);

	// Reinitialize the Bresenham tallies only when the direction to the
	// target changes.  While the mouse is held, this.target moves every
	// frame to track the cursor's world position — but if the direction is
	// unchanged, the fractional tallies must persist, or the character
	// only ever steps along the dominant axis.
	if(!this.motionData.hasDir
			|| sgndx !== this.motionData.lastDirX
			|| sgndy !== this.motionData.lastDirY){
		this.motionData.xTally = absdx >> 1;
		this.motionData.yTally = absdy >> 1;
		this.motionData.lastDirX = sgndx;
		this.motionData.lastDirY = sgndy;
		this.motionData.hasDir = true;
	}

	var i;

	if (absdx >= absdy){
		for(i = 0; i < absdx && i < pixelsBudget; i++){
			this.motionData.yTally += absdy;
			if (this.motionData.yTally >= absdx){
				this.motionData.yTally -= absdx;
				if(this.canWalkOn(this.position.x, this.position.y + sgndy)){
					this.position.y += sgndy;
				}
			}
			if(this.canWalkOn(this.position.x + sgndx, this.position.y)){
				this.position.x += sgndx;
			}
		}
	}else{
		for(i = 0; i < absdy && i < pixelsBudget; i++){
			this.motionData.xTally += absdx;
			if(this.motionData.xTally >= absdy){
				this.motionData.xTally -= absdy;
				if(this.canWalkOn(this.position.x + sgndx, this.position.y)){
					this.position.x += sgndx;
				}
			}
			if(this.canWalkOn(this.position.x, this.position.y + sgndy)){
				this.position.y += sgndy;
			}
		}
	}
	this.mapPos = {
		x : Math.floor(this.position.x / cellSize),
		y : Math.floor(this.position.y / cellSize)
	};

	if(this == player){
		activeMap.playerPos = {
			x : this.mapPos.x,
			y : this.mapPos.y
		}
	}

	checkOverlay();


};

characterClass.prototype.findTarget = function(){
	if(this == player){
		if(this.target == null && this.walkPath.length > 0){
			this.target = this.walkPath.shift();
		}
	}else{
		// we only follow the player if they're in this character's vision range
		var dx = player.position.x - this.position.x;
		var dy = player.position.y - this.position.y;
		if(dx * dx + dy * dy < this.skills.vision * this.skills.vision * cellSize * cellSize){
			// this character is not the player, so we'll recalculate our path to the player
			this.setTarget(player.position.x - this.position.x, player.position.y - this.position.y);
			this.target = this.walkPath.shift();
		}
	}
}

characterClass.prototype.act = function(dtSeconds){
	var frameIndex, sequence = null, endFrame, oldx, oldy;
	var self = this; // captured so the sprite callback can reference the character

	// Accumulate this frame's movement allowance and extract whole pixels.
	// The fractional remainder carries over to the next frame.
	this.moveBudget += this.skills.speed * dtSeconds;
	var pixelsThisTick = Math.floor(this.moveBudget);
	this.moveBudget -= pixelsThisTick;

	this.findTarget();

	if(this.target != null){
		if(this.position.x == this.target.x && this.position.y == this.target.y){
			this.target = null;
		}else{
			frameIndex = Math.round(4 * rel_ang(
				this.position.x,
				this.position.y,
				this.target.x,
				this.target.y
			) / Math.PI) % 8;

			// Attempt to move if we have any pixels to spend this frame.
			// If a collision stops us entirely, drop the target.
			if(pixelsThisTick > 0){
				oldx = this.position.x;
				oldy = this.position.y;
				this.moveTowardsTarget(pixelsThisTick);
				if(oldx == this.position.x && oldy == this.position.y){
					this.target = null;
				}
			}

			// As long as a target still exists, keep the walk animation
			// selected.  This is intentionally independent of whether we
			// actually moved this particular frame, so that the walk cycle
			// doesn't stutter at high framerates where pixelsThisTick is
			// often 0.
			if(this.target != null){
				switch(frameIndex){
					case 0:
						sequence = 'walkup';
						endFrame = 'back_idle';
						break;
					case 1:
						sequence = 'walkupright';
						endFrame = 'back_right_idle';
						break;
					case 2:
						sequence = 'walkright';
						endFrame = 'right_idle';
						break;
					case 3:
						sequence = 'walkdownright';
						endFrame = 'front_right_idle';
						break;
					case 4:
						sequence = 'walkdown';
						endFrame = 'front_idle';
						break;
					case 5:
						sequence = 'walkdownleft';
						endFrame = 'front_left_idle';
						break;
					case 6:
						sequence = 'walkleft';
						endFrame = 'left_idle';
						break;
					case 7:
						sequence = 'walkupleft';
						endFrame = 'back_left_idle';
						break;
				}
			}
		}
	}

	if(sequence == null){
		if(this.currentSequence != null){
			this.sprite.stopSequence();
			this.sprite.setFrame(this.currentEndFrame);
			this.currentSequence = null;
			this.sprite.currentSequence = null;
		}
	}else if(sequence != this.currentSequence){
		this.currentEndFrame = endFrame;
		this.currentSequence = sequence;
		this.sprite.startSequence(sequence, function(){
			self.currentSequence = null;
			self.sprite.setFrame(endFrame);
		});
	}else{
		// sequence already running; do nothing
	}
};

characterClass.prototype.distanceToMouseEvent = function(e){
	// px and py are exactly the middle bottom of the player sprite
	var px = this.sprite.position.x;
	var py = this.sprite.position.y;
	py += this.sprite.frameHeight - 1;
	px += this.sprite.frameWidth >> 1;

	// x and y are the mouse click's position relative to the player's middle bottom
	return {
		x : Math.floor(e.clientX / gameScale) - px,
		y : Math.floor(e.clientY / gameScale) - py
	};
};

characterClass.prototype.setTarget = function(dx, dy){
	// this.target is the actual pixel point to which we're walking, which gets pulled out of the walk path
	this.target = null;

	// the actual pixel target we want
	var target = {
		x : this.position.x + dx,
		y : this.position.y + dy
	};

	// can we walk straight threre?
	if(!this.collidesOnPath(this.position.x, this.position.y, target.x, target.y)){
		// We can!  Return that!
		this.walkPath = [target];
		return;
	}

	// gridRadius is the width and height of the region to use for mapping (in cells)
	var gridRadius = Math.max(viewRange.width, viewRange.height) >> 1;


	// the rounded target position relative to the player
	var gridTarget = {
		x : Math.floor(target.x / cellSize) - this.mapPos.x,
		y : Math.floor(target.y / cellSize) - this.mapPos.y
	};

	// get a collision map to test against
	var collisionMap = activeMap.readCollisionMap(
		this.mapPos.x - gridRadius,
		this.mapPos.y - gridRadius,
		this.mapPos.x + gridRadius + 1,
		this.mapPos.y + gridRadius + 1
	);

	// pass it into the A* path finder
	var graph = new Graph(collisionMap);

	// now plot the best path!
	var start = graph.grid[gridRadius][gridRadius];

	// guard against the target falling outside of the local collision window
	var endX = gridTarget.x + gridRadius;
	var endY = gridTarget.y + gridRadius;
	if(
		endX < 0 || endY < 0
		|| endX >= graph.grid.length
		|| endY >= graph.grid[0].length
	){
		// fall back to the raw target; the straight-walk test already failed
		// so this may not go anywhere, but at least it won't throw.
		this.walkPath = [];
		return;
	}

	var end = graph.grid[endX][endY];
	var path = astar.search(graph, start, end);
/*
	// If A* couldn't find a route, give up rather than sending the character
	// on a straight line into a wall.
	if(path.length === 0){
		this.walkPath = [];
		return;
	}
*/
	// excellent, now we need to translate this resulting path into valid output
	this.walkPath = [];

	for(var p = 0; p < path.length - 1; p++){
		this.walkPath[this.walkPath.length] = {
			x : cellSize * (this.mapPos.x + path[p].x - gridRadius + .5),
			y : cellSize * (this.mapPos.y + path[p].y - gridRadius + .5)
		};
	}
	this.walkPath[this.walkPath.length] = target;

	// and finally, optimize the path to skip unnecessary steps
	this.walkPath = this.optimizePath(this.walkPath);


}

// reduces unnecessary steps from a calculated path
characterClass.prototype.optimizePath = function(path){
	if(path.length < 3) return path;

	for(var idx = path.length - 2; idx > 0; idx--){
		if(!this.collidesOnPath(path[idx - 1].x, path[idx - 1].y, path[idx + 1].x, path[idx + 1].y)){
			path.splice(idx, 1);
		}
	}

	// check the current location as well
	if(path.length > 1){
		if(!this.collidesOnPath(this.position.x, this.position.y, path[1].x, path[1].y)){
			path.splice(0, 1);
		}
	}

	return path;
}

characterClass.prototype.collidesOnPath = function(x1, y1, x2, y2){
	var tally = 0, i;
	var dx = x2 - x1;
	var dy = y2 - y1;
	var sgndx = Math.sign(dx);
	var absdx = Math.abs(dx);
	var sgndy = Math.sign(dy);
	var absdy = Math.abs(dy);
	var rval = false;

	if (absdx >= absdy){
		for(i = 0; i < absdx && rval == false; i++){
			tally += absdy;
			if (tally >= absdx){
				tally -= absdx;
				if(this.canWalkOn(x1, y1 + sgndy)){
					y1 += sgndy;
				}else{
					rval = true;
				}
			}
			if(this.canWalkOn(x1 + sgndx, y1)){
				x1 += sgndx;
			}else{
				rval = true;
			}
		}
	}else{
		for(i = 0; i < absdy && rval == false; i++){
			tally += absdx;
			if(tally >= absdy){
				tally -= absdy;
				if(this.canWalkOn(x1 + sgndx, y1)){
					x1 += sgndx;
				}else{
					rval = true;
				}
			}
			if(this.canWalkOn(x1, y1 + sgndy)){
				y1 += sgndy;
			}else{
				rval = true;
			}
		}
	}
	return rval;
};

function useEntrance(entrance){
	// Prevent overlapping transitions if the player triggers another entrance
	// during the fade.
	if(isTransitioning) return;
	isTransitioning = true;

	/*
		This entire if structure needs to be replaced with something better.

		This is where the code decides the new location of the player in the new area.
		And it's done terribly.  It simply generates the area and says "ok, find an exit
		that goes in the opposite direction of this entrance".  It should be far better
		engineered than that.  Truthfully, I think perhaps the mapBuilder class should
		let the current level generate the child.  That would allow more relevant
		handling of the linking.

	*/
	if(entrance.target == undefined){
		var mapIdx = maps.length;
		maps[mapIdx] = new mapBuilder();
		maps[mapIdx].build({
			category : 'dungeon',
			width : 30,
			height: 30,
			roomscale: .8,
			stairup: true,
			stairdown: true
		});
		entrance.target = maps[mapIdx];

		var linkTarget = function(oppositeKey){
			var opposite = entrance.target.items[oppositeKey];
			if(opposite == undefined || opposite.length === 0) return;
			entrance.target.playerPos = {
				x : opposite[0].x,
				y : opposite[0].y
			};
			if(opposite[0].target == undefined){
				opposite[0].target = activeMap;
			}
		};

		switch(entrance.content){
			case 'stairup':
				linkTarget('stairdown');
				break;
			case 'stairdown':
				linkTarget('stairup');
				break;
			case 'caveEntrance':
				linkTarget('stairup');
				break;
		}
	}
	player.target = null;
	gamePaused = true;
	var opacity = 1, faderate = .2;

	gameCanvas.style.opacity = opacity;
	var fadeOut = function(){
		opacity -= faderate;
		gameCanvas.style.opacity = opacity;
		if(opacity > faderate){
			setTimeout(fadeOut, 30);
		}else{
			console.log('calling fadeIn');
			activeMap = entrance.target;
			player.setMapPos(activeMap.playerPos.x, activeMap.playerPos.y);
			player.position.x += cellSize >> 1;
			player.position.y += cellSize >> 1;
			checkOverlay();
			renderView(activeMap);
			gamePaused = false;
			gameCanvas.style.opacity = 0;
			setTimeout(fadeIn, 500);
		}
	};

	var fadeIn = function(){
		console.log('fading in');
		opacity += faderate ;
		gameCanvas.style.opacity = opacity;
		if(opacity < 1){
			setTimeout(fadeIn, 30);
		}else{
			console.log('setting opacity to 1');
			gameCanvas.style.opacity = 1;
			isTransitioning = false;
		}
	}

	fadeOut();
}

function handleActiveCellClick(){
	var item;
	var items = player.touchingItems();

	for(item of items){
		switch(item.content){
			case 'stairup':
				useEntrance(item);
				break;
			case 'stairdown':
				useEntrance(item);
				break;
			case 'caveEntrance':
				useEntrance(item);
				break;
			default:
				console.log(item.content);
		}
	}

	return items.length;

}


var renderView = (function(){
	var item, frameName;
	var playerLayer;
	var topLayer;
	var randomKey, worldPosition, treeFrame;
	var x, y, mapX, mapY, gridX, gridY, n;
	// Position-indexed lookup of items in the current area, rebuilt once per
	// render instead of scanning the whole item list for every visible cell.
	var itemsIndex;

	var renderCell = function(area, sprite, underlay){
		underlay = underlay == undefined ? false : (underlay ? true : false);
		var bitsum, readX, readY;
		var neighbourList = {
			1 : {dx : 0, dy : -1},
			2 : {dx : -1, dy : 0},
			4 : {dx : 1, dy : 0},
			8 : {dx : 0, dy : 1}
		};
		switch(sprite){
			case 'water':
				var r = mapX + mapY * area.map.length;
				r = Math.sin(r) + 1
				r *= 500; // <-- already 0-2, so now 0-1000
				r -= Math.floor(r); // now 0-1
				r *= 100;
				r = Math.floor(r);
				r = (r + waterCycle) % 20;
				if(r < 5){
					sprites.waterWaves.setFrame(r);
				}else{
					sprites.waterWaves.setFrame(5);
				}

				sprites.waterWaves.setPosition(gridX, gridY, false);
				sprites.waterWaves.draw(context);
				break;
			case 'sand':
				var otherTexture = 'sand';
				bitsum = 0;
				for(n in neighbourList){
					readX = mapX + neighbourList[n].dx;
					readY = mapY + neighbourList[n].dy;
					if(readX < 0 || readY < 0 || readX > area.map.length || readY > area.map[0].length){
						bitsum += 1 * n;
					}else if(area.spritemap[area.map[readX][readY]] == 'sand'){
						bitsum += 1 * n;
					}else{
						otherTexture = area.spritemap[area.map[readX][readY]]; // <-- crazy lazy and probably will need to be replaced
					}
				}
				if(otherTexture != 'sand'){
					renderCell(area, otherTexture, true);
				}

				switch(bitsum){
					case 3:
						sprites.sandTiles.setFrame('corner');
						sprites.sandTiles.rotation = Math.PI;
						sprites.sandTiles.setPosition(gridX + cellSize, gridY + cellSize, false);
						sprites.sandTiles.draw(context);
						break;
					case 5:
						sprites.sandTiles.setFrame('corner');
						sprites.sandTiles.rotation = 3 * Math.PI / 2;
						sprites.sandTiles.setPosition(gridX, gridY + cellSize, false);
						sprites.sandTiles.draw(context);
						break;
					case 10:
						sprites.sandTiles.setFrame('corner');
						sprites.sandTiles.rotation = Math.PI / 2;
						sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						sprites.sandTiles.draw(context);
						break;
					case 12:
						sprites.sandTiles.setFrame('corner');
						sprites.sandTiles.rotation = 0;
						sprites.sandTiles.setPosition(gridX, gridY, false);
						sprites.sandTiles.draw(context);
						break;

					case 7:
						sprites.sandTiles.setFrame('edge');
						sprites.sandTiles.rotation = 3 * Math.PI / 2;
						sprites.sandTiles.setPosition(gridX, gridY + cellSize, false);
						sprites.sandTiles.draw(context);
						break;
					case 13:
						sprites.sandTiles.setFrame('edge');
						sprites.sandTiles.rotation = 0;
						sprites.sandTiles.setPosition(gridX, gridY, false);
						sprites.sandTiles.draw(context);
						break;
					case 14:
						sprites.sandTiles.setFrame('edge');
						sprites.sandTiles.rotation = Math.PI / 2;
						sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						sprites.sandTiles.draw(context);
						break;
					case 11:
						sprites.sandTiles.setFrame('edge');
						sprites.sandTiles.rotation = Math.PI;
						sprites.sandTiles.setPosition(gridX + cellSize, gridY + cellSize, false);
						sprites.sandTiles.draw(context);
						break;

					case 1:
						sprites.sandTiles.setFrame('tip');
						sprites.sandTiles.rotation = Math.PI;
						sprites.sandTiles.setPosition(gridX + cellSize, gridY + cellSize, false);
						sprites.sandTiles.draw(context);
						break;

					case 2:
						sprites.sandTiles.setFrame('tip');
						sprites.sandTiles.rotation = Math.PI / 2;
						sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						sprites.sandTiles.draw(context);
						break;

					case 4:
						sprites.sandTiles.setFrame('tip');
						sprites.sandTiles.rotation = 3 * Math.PI / 2;
						sprites.sandTiles.setPosition(gridX, gridY + cellSize, false);
						sprites.sandTiles.draw(context);
						break;

					case 8:
						sprites.sandTiles.setFrame('tip');
						sprites.sandTiles.rotation = 0;
						sprites.sandTiles.setPosition(gridX, gridY, false);
						sprites.sandTiles.draw(context);
						break;

					case 9:
						sprites.sandTiles.setFrame('wall');
						sprites.sandTiles.rotation = 0;
						sprites.sandTiles.setPosition(gridX, gridY, false);
						sprites.sandTiles.draw(context);
						break;

					case 6:
						sprites.sandTiles.setFrame('wall');
						sprites.sandTiles.rotation = Math.PI / 2;
						sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						sprites.sandTiles.draw(context);
						break;

					case 15:
						sprites.sand.drawRandomArea(context, gridX, gridY, cellSize, cellSize, randomKey);
						break;
				}
				break;
			case 'stone floor':
				sprites.ground.rotate(Math.floor(randomKey * 4) * Math.PI / 2);
				sprites.ground.drawRandomArea(context, gridX, gridY, cellSize, cellSize, randomKey);
				break;
			case 'stone wall':
				if(mapY == area.map[0].length || area.spritemap[area.map[mapX][mapY + 1]] != 'stone wall'){
					sprites.stone.setFrame(Math.floor(randomKey * 10) + 10);
				}else{
					sprites.stone.setFrame(Math.floor(randomKey * 10));
				}
				sprites.stone.draw(context, {x : gridX, y : gridY});
				break;
			case 'trees':


				// first we draw some grass

				sprites.grass.rotate(Math.PI / 2);
				sprites.grass.drawRandomArea(context, gridX, gridY, cellSize, cellSize, randomKey);


				if(randomKey < 0.1){
					treeFrame = 1;
				}else if(randomKey < .36){
					treeFrame = 2;
				}else if(randomKey < .53){
					treeFrame = 3;
				}else if(randomKey < .8){
					treeFrame = 4;
				}else{
					treeFrame = 5;
				}
				// now the tree trunk
				playerLayer[playerLayer.length] = {
					doing : 'tree',
					sprite : sprites.tree,
					frame : 'trunk' + treeFrame,
					x : gridX,
					y : gridY
				};

				// and queue up the greens for a second run
				topLayer[topLayer.length] = {
					sprite : sprites.tree,
					frame : 'greens' + treeFrame,
					x : gridX,
					y : gridY
				};



				break;
			case 'grass':

				sprites.grass.rotate(Math.PI / 2);
				sprites.grass.drawRandomArea(context, gridX, gridY, cellSize, cellSize, randomKey);

				if(!underlay && randomKey < .5){
					var brushFrame = 100 * randomKey;
					var brushFrame = Math.floor(Math.abs(9 * Math.sin(brushFrame - Math.floor(brushFrame))));
					playerLayer[playerLayer.length] = {
						doing : 'grass',
						sprite : sprites.longGrass,
						frame : brushFrame,
						x : gridX,
						y : gridY
					};
				}

				break;
				/*
			default:
				context.fillStyle = '#88AACC';
				context.fillRect(gridX * gameScale, gridY * gameScale, cellSize * gameScale, cellSize * gameScale);
				*/
		}
		if(showGameGrid){
			context.strokeStyle = "rgba(0,0,0, 0.2)";
			context.strokeRect(gridX * gameScale, gridY * gameScale, cellSize * gameScale, cellSize * gameScale);
		}
	};


	return function(area){
		var o;
		playerLayer = [];
		topLayer = [];

		// Rebuild the item index for this frame.  O(items), not O(cells * items).
		itemsIndex = {};
		for(var itemName in area.items){
			var itemList = area.items[itemName];
			for(var ii = 0; ii < itemList.length; ii++){
				var it = itemList[ii];
				var ikey = it.x + ',' + it.y;
				if(itemsIndex[ikey] == undefined) itemsIndex[ikey] = [];
				itemsIndex[ikey].push(it);
			}
		}

		worldPosition = {
			x : player.position.x % cellSize,
			y : player.position.y % cellSize
		};
		context.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

		var middleX = Math.floor(screenMiddle.x / (gameScale * cellSize)) + 1
		var middleY = Math.floor(screenMiddle.y / (gameScale * cellSize)) + 1



		for(y = -1; y <= viewRange.height + 1; y++){
			mapY = player.mapPos.y + y - middleY;
			if(mapY < 0 || mapY > area.map[0].length - 1) continue;

			for(x = -1; x <= viewRange.width + 1; x++){
				mapX = player.mapPos.x + x - middleX;
				if(mapX < 0 || mapX > area.map.length - 1) continue;

				if(area.hideMap[mapX][mapY] === true){
					continue;
				}

				gridX = x * cellSize - worldPosition.x;
				gridY = y * cellSize - worldPosition.y;


				randomKey = Math.abs(Math.sin(mapX + mapY * viewRange.width) * 10000);
				randomKey -= Math.floor(randomKey);
				renderCell(area, area.spritemap[area.map[mapX][mapY]]);

				// Look up items at this cell via the index instead of scanning
				// the whole item collection.
				var cellItems = itemsIndex[mapX + ',' + mapY];
				if(cellItems != undefined){
					for(var ci = 0; ci < cellItems.length; ci++){
						var cellItem = cellItems[ci];
						frameName = {
							'stairup' : 'stairsUp',
							'stairdown' : 'stairsDown',
							'caveEntrance' : 'caveEntrance'
						}[cellItem.content];
						switch(frameName){
							case 'stairsUp': case 'stairsDown':
								sprites.dungeonElements.setFrame(frameName);
								sprites.dungeonElements.draw(context, {x : gridX, y: gridY});
								break;
							case 'caveEntrance':
								sprites.caveEntrance.setFrame(frameName);
								sprites.caveEntrance.draw(context, {x : gridX, y : gridY});
						}
					}
				}

			}
		}

		for(o of playerLayer){
			o.sprite.setFrame(o.frame);
			o.sprite.draw(context, {
				x : o.x,
				y : o.y
			});
		}

		// if there's a target location, draw it here
		if(player.walkPath.length > 0){
			var pointerx = cellSize * middleX + player.walkPath[player.walkPath.length - 1].x - player.position.x - 0;
			var pointery = cellSize * middleY + player.walkPath[player.walkPath.length - 1].y - player.position.y - 0;


			mousePointers.target.draw(context, {
				x : pointerx,
				y : pointery
			});
		}else if(player.target != null){
			var pointerx = cellSize * middleX + player.target.x - player.position.x - 0;
			var pointery = cellSize * middleY + player.target.y - player.position.y - 0;


			mousePointers.target.draw(context, {
				x : pointerx,
				y : pointery
			});
		}

		// draw additional characters
		for(o of characters){
			var offset = {
				x : o.sprite.frameWidth >> 1,
				y : o.sprite.frameHeight - 1
			};
			o.sprite.draw(context, {
				x : cellSize * middleX + o.position.x - player.position.x - offset.x,
				y : cellSize * middleY + o.position.y - player.position.y - offset.y
			});
		}

		// draw the player
		player.sprite.setPosition(
			cellSize * middleX - (player.sprite.frameWidth >> 1),
			cellSize * middleY - player.sprite.frameHeight + 1,
			1
		);

		player.sprite.draw(context);

		// draw top level elements (e.g. tree tops)
		for(o of topLayer){
			o.sprite.setFrame(o.frame);
			o.sprite.draw(context, {
				x : o.x,
				y : o.y
			});
		}

	}
})();

function writeText(x, y, text){
	var shadow = document.createElement('span');
	shadow.textContent = text;
	shadow.style.position = 'absolute';
	shadow.style.left = (x + 2) + 'px';
	shadow.style.top = (y + 2) + 'px';
	shadow.style.color = '#000';
	document.getElementById('overlay').appendChild(shadow);

	var span = document.createElement('span');
	span.textContent = text;
	span.style.position = 'absolute';
	span.style.left = x + 'px';
	span.style.top = y + 'px';
	span.style.color = '#FFF';
	document.getElementById('overlay').appendChild(span);

}

function handlePointer(e){
	if(!(e.buttons & 1)) return;

	var delta = player.distanceToMouseEvent(e);

	// The world-space point under the cursor — this is what actually needs
	// to change before we re-run pathfinding.  It changes when the mouse
	// moves AND when the player walks, but stays constant when both are
	// still, which is the case we want to short-circuit.
	var worldTarget = {
		x : player.position.x + delta.x,
		y : player.position.y + delta.y
	};

	if(
		mouse.lastTarget != null
		&& mouse.lastTarget.x === worldTarget.x
		&& mouse.lastTarget.y === worldTarget.y
	){
		return;
	}
	mouse.lastTarget = worldTarget;

	if(delta.x * delta.x + delta.y * delta.y < cellSize * cellSize){
		// clicked on the cell we're standing on
		if(!handleActiveCellClick()){
			player.setTarget(delta.x, delta.y);
		}
	}else{
		player.setTarget(delta.x, delta.y);
	}
}

function gameLoop(time){
	if(lastFrameTime === 0) lastFrameTime = time;
	var dt = (time - lastFrameTime) / 1000;   // seconds
	lastFrameTime = time;

	// Clamp dt so that tab-switching or debugger pauses don't cause
	// a multi-second "catch-up" frame.
	if(dt > 0.1) dt = 0.1;

	if(!gamePaused && activeMap != null){
		playGame(dt);
	}

	requestAnimationFrame(gameLoop);
}

function playGame(dt){
	var n;

	// If the player walked last frame, the world point under a held cursor
	// has changed.  Recompute the target only while the button is down.
	if(mouse != null && mouse.isDown && mouse.lastEvent != null){
		handlePointer(mouse.lastEvent);
	}

	player.act(dt);
	for(n = 0; n < characters.length; n++){
		characters[n].act(dt);
	}

	waterCycleAccum += dt * waterCycleRate;
	while(waterCycleAccum >= 1){
		waterCycleAccum -= 1;
		waterCycle++;
	}

	renderView(activeMap);
}

function checkOverlay(){

	var x, y, cx, cy, o, cell;
	for(x = -player.skills.vision; x <= player.skills.vision; x++){
		cx = x + player.mapPos.x;
		if(cx >= 0 && cx < activeMap.width){
			for(y = -player.skills.vision; y <= player.skills.vision; y++){
				cy = y + player.mapPos.y;
				if(cy >= 0 && cy < activeMap.height){
					if(squareDistance(x, y, 0, 0) < Math.pow(player.skills.vision, 2)){
						activeMap.hideMap[cx][cy] = false;
					}
				}
			}
		}
	}
}

function handleResize(){
	if(gameCanvas == undefined) return;
	gameCanvas.width = window.innerWidth;
	gameCanvas.height = window.innerHeight;
	screenMiddle = { x : gameCanvas.width >> 1, y : gameCanvas.height >> 1 };
	viewRange = {
		width:  Math.ceil(gameCanvas.width  / (gameScale * cellSize)) + 1,
		height: Math.ceil(gameCanvas.height / (gameScale * cellSize)) + 1
	};
	// canvas resize resets context state — re-disable smoothing
	context.webkitImageSmoothingEnabled = false;
	context.mozImageSmoothingEnabled = false;
	context.imageSmoothingEnabled = false;
	if(activeMap != undefined){
		renderView(activeMap);
	}
}
async function initialize(){
	// --- setup canvas and context ---
	gameCanvas = document.getElementById('gameCanvas');
	gameCanvas.width = window.innerWidth;
	gameCanvas.height = window.innerHeight;

	screenMiddle = { x : gameCanvas.width >> 1, y : gameCanvas.height >> 1 };
	viewRange = {
		width:  Math.ceil(gameCanvas.width  / (gameScale * cellSize)) + 1,
		height: Math.ceil(gameCanvas.height / (gameScale * cellSize)) + 1
	};
	context = gameCanvas.getContext('2d');
	context.webkitImageSmoothingEnabled = false;
	context.mozImageSmoothingEnabled = false;
	context.imageSmoothingEnabled = false;

	window.addEventListener('resize', handleResize);

	writeText(5, 5, "DungeonCrawler v.0.0");

	// --- sequential load pipeline ---
	try {
		await loadSpriteSets();
		await loadPlayerSprite();
		await loadMap('maps/Map1.map');
		initializeEvents();
		await loadMousePointers();
		startGameLoop();
	} catch(e) {
		console.error("Initialization failed:", e);
	}
}

async function loadSpriteSets(){
	var spriteList = [
		{'name' : 'grass', 'file' : 'grass.sprite'},
		{'name' : 'tree', 'file' : 'tree.sprite'},
		{'name' : 'stone', 'file': 'stone.sprite'},
		{'name' : 'ground', 'file' : 'ground.sprite'},
		{'name' : 'sand', 'file' : 'sand.sprite'},
		{'name' : 'sandTiles', 'file' : 'sandTiles.sprite'},
		{'name' : 'dungeonElements', 'file' : 'dungeonElements.sprite'},
		{'name' : 'longGrass', 'file' : 'longGrass.sprite'},
		{'name' : 'caveEntrance' , 'file' : 'caveEntrance.sprite'},
		{'name' : 'waterWaves' , 'file' : 'waterWaves.sprite'},
		{'name' : 'rat', 'file' : 'rat.sprite'}
	];

	// pop() from the end, matching the original load order
	while(spriteList.length > 0){
		const dat = spriteList.pop();
		const set = new spriteSet();
		await set.load('sprites/' + dat.file);
		spriteSets[dat.name] = set;
		sprites[dat.name] = new cSprite(set);
		sprites[dat.name].setScale(gameScale);
	}

	sprites.waterWaves.setFrame('0');
}

async function loadPlayerSprite(){
	player = new characterClass();
	player.category = 'player';

	await playerSpriteSet.load("sprites/player.sprite");
	player.sprite = new cSprite(playerSpriteSet);
	player.sprite.setScale(gameScale);
	player.sprite.setPosition(screenMiddle.x, screenMiddle.y, true);
	player.sprite.setFrame('front_idle');
}

async function loadMap(mapFile){
	const map = new mapBuilder();
	await map.loadImageMap(mapFile);
	maps.push(map);
	activeMap = map;

	player.position.x = Math.floor(cellSize * (activeMap.playerPos.x + .5));
	player.position.y = Math.floor(cellSize * (activeMap.playerPos.y + .5));
	player.mapPos = {
		x : activeMap.playerPos.x,
		y : activeMap.playerPos.y
	};
	player.skills.vision = 5;

	// make the whole map visible
	for(let x = 0; x < activeMap.width; x++){
		for(let y = 0; y < activeMap.height; y++){
			activeMap.hideMap[x][y] = false;
		}
	}

	renderView(activeMap);
}

function initializeEvents(){
	keyboard = new kbListener();
	keyboard.listen();
	keyboard.onCombo(['CTRL', 'G'], function(){
		showGameGrid = !showGameGrid;
	});

	document.getElementById('overlay').addEventListener('contextmenu', function(e){
		e.preventDefault();
	});

	mouse = new mouseHandler();
	mouse.lastTarget = null;
	mouse.listen(document.getElementById('overlay'));

	// --- new: event-driven pointer handling ---
	mouse.on('mousedown', function(e){
		handlePointer(e);
	});
	mouse.on('mousemove', function(e){
		if(mouse.isDown) handlePointer(e);
	});
	mouse.on('mouseup', function(e){
		mouse.lastTarget = null;
	});
}

async function loadMousePointers(){
	var pointerList = [
		{'name' : 'target', 'file' : 'target.sprite'}
	];

	while(pointerList.length > 0){
		const dat = pointerList.pop();
		const set = new spriteSet();
		await set.load('sprites/' + dat.file);
		mousePointers[dat.name] = new cSprite(set);
		mousePointers[dat.name].setScale(gameScale);
	}

	mousePointers['target'].startSequence('spin', {
		iterations: 0,
		method : 'manual'
	});
}

function startGameLoop(){
	requestAnimationFrame(gameLoop);
}

window.addEventListener('load', function(){
	initialize().catch(function(e){
		console.error("Fatal error during initialization:", e);
	});
});
