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
var maps = Array();
var activeMap;
var context;
var gameInterval; // <-- the animation interval object
var walkSpeed = 3;
var screenMiddle = {x: 0, y : 0};
var characters = [];
var showGameGrid = false;

var characterClass = function(){
	this.position = {x : 0, y : 0};
	this.mapPos = {x : 0, y : 0};
	this.direction = 'down';
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
	var rval = Array();
	var x = this.mapPos.x;
	var y = this.mapPos.y;
	if(activeMap.mappedItems[x] != undefined){
		if(activeMap.mappedItems[x][y] != undefined){
			for(var i of activeMap.mappedItems[x][y]){
				rval = rval.concat(activeMap.mappedItems[x][y]);
			}
		}
	}
	return rval;
};

characterClass.prototype.moveTowardsTarget = function(){
	if(this.motionData == undefined){
		this.motionData = {
			xTally : 0,
			yTally : 0,
			oldTarget : {
				x : 0, y : 0
			}
		};
	}

	if(this.target == null) return;
	if(this.motionData.oldTarget.x != this.target.x || this.motionData.oldTarget.y != this.target.y){
		this.motionData.oldTarget = {
			x : this.target.x,
			y : this.target.y
		};
		this.motionData.xTally = Math.abs(this.target.x - this.position.x) >> 1;
		this.motionData.yTally = Math.abs(this.target.y - this.position.y) >> 1;
	}
	var i;
	var dx = this.target.x - this.position.x;
	var dy = this.target.y - this.position.y;
	var sgndx = Math.sign(dx);
	var absdx = Math.abs(dx);
	var sgndy = Math.sign(dy);
	var absdy = Math.abs(dy);

	if (absdx >= absdy){
		for(i = 0; i < absdx && i < this.skills.speed; i++){
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
		for(i = 0; i < absdy && i < this.skills.speed; i++){
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

characterClass.prototype.act = function(){
	var frameIndex, sequence, endFrame, diametersq, oldx, oldy;
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

			// this oldx, oldy comparison tells us if a collision stopped them entirely.
			oldx = this.position.x;
			oldy = this.position.y;
			this.moveTowardsTarget();
			if(oldx == this.position.x && oldy == this.position.y){
				this.target = null;
			}

			switch(frameIndex){
				case 0: 
					sequence = 'walkup';
					endFrame = 'back_idle';
					this.frameIndex = 'up';
					break;
				case 1: 
					sequence = 'walkupright';
					endFrame = 'back_right_idle';
					this.frameIndex = 'upright';
					break;
				case 2: 
					sequence = 'walkright';
					endFrame = 'right_idle';
					this.frameIndex = 'right';
					break;
				case 3: 
					sequence = 'walkdownright';
					endFrame = 'front_right_idle';
					this.frameIndex = 'downright';
					break;
				case 4: 
					sequence = 'walkdown';
					endFrame = 'front_idle';
					this.frameIndex = 'down';
					break;
				case 5: 
					sequence = 'walkdownleft';
					endFrame = 'front_left_idle';
					this.frameIndex = 'downleft';
					break;
				case 6: 
					sequence = 'walkleft';
					endFrame = 'left_idle';
					this.frameIndex = 'left';
					break;
				case 7: 
					sequence = 'walkupleft';
					endFrame = 'back_left_idle';
					this.frameIndex = 'upleft';
					break;
			}
		}
	}

	if(sequence == null){
		if(this.currentSequence != null){
			//this.sprite.stopSequence(this.currentSequence);
			this.sprite.setFrame(this.currentEndFrame);
			this.currentSequence = null;
			this.sprite.currentSequence = null;
			this.sprite.animating = false;
		}

	}else if(sequence != this.currentSequence){
		this.currentEndFrame = endFrame;
		this.currentSequence = sequence;
		this.sprite.startSequence(sequence, {
			iterations: 0,
			method : 'manual',
			callback: function(){
				this.currentSequence = null;
				this.sprite.setFrame(endFrame);
			}
		});
	}else{
		//this.sprite.doSequenceStep();
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
	var end = graph.grid[gridTarget.x + gridRadius][gridTarget.y + gridRadius];
	var path = astar.search(graph, start, end);

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

		switch(entrance.content){
			case 'stairup':
				entrance.target.playerPos = {
					x : entrance.target.items['stairdown'][0].x,
					y : entrance.target.items['stairdown'][0].y
				};
				if(entrance.target.items['stairdown'][0].target == undefined){
					entrance.target.items['stairdown'][0].target = activeMap;
				}
				break;
			case 'stairdown':
				entrance.target.playerPos = {
					x : entrance.target.items['stairup'][0].x,
					y : entrance.target.items['stairup'][0].y
				};
				if(entrance.target.items['stairup'][0].target == undefined){
					entrance.target.items['stairup'][0].target = activeMap;
				}
				break;
			case 'caveEntrance':
				entrance.target.playerPos = {
					x : entrance.target.items['stairup'][0].x,
					y : entrance.target.items['stairup'][0].y
				};
				if(entrance.target.items['stairup'][0].target == undefined){
					entrance.target.items['stairup'][0].target = activeMap;
				}
				break;
		}
	}
	player.target = null;
	clearInterval(gameInterval);
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
			gameInterval = setInterval(playGame, 70);
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
	var waterCycle = 0;

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
		playerLayer = Array();
		topLayer = Array();

		worldPosition = {
			x : player.position.x % cellSize,
			y : player.position.y % cellSize
		};
		context.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

		waterCycle++;

		var middleX = Math.floor(screenMiddle.x / (gameScale * cellSize)) + 1
		var middleY = Math.floor(screenMiddle.y / (gameScale * cellSize)) + 1



		for(y = -1; y <= viewRange.height + 1; y++){
			mapY = player.mapPos.y + y - middleY;
			if(mapY < 0 || mapY > area.map[0].length - 1) continue;

			for(x = -1; x <= viewRange.width + 1; x++){
				mapX = player.mapPos.x + x - middleX;
				if(mapX < 0 || mapX > area.map.length - 1) continue;

				if(area.hideMap[mapX][mapY] == true){
					continue;
				}

				gridX = x * cellSize - worldPosition.x;
				gridY = y * cellSize - worldPosition.y;
		 

				randomKey = Math.abs(Math.sin(mapX + mapY * viewRange.width) * 10000);
				randomKey -= Math.floor(randomKey);
				renderCell(area, area.spritemap[area.map[mapX][mapY]]);

				for(var itemName in area.items){
					for(item of area.items[itemName]){
						if(item.x == mapX && item.y == mapY){
							frameName = {
								'stairup' : 'stairsUp',
								'stairdown' : 'stairsDown',
								'caveEntrance' : 'caveEntrance'
							}[item.content];
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


			mouse.pointers.target.draw(context, {
				x : pointerx,
				y : pointery
			});
		}else if(player.target != null){
			var pointerx = cellSize * middleX + player.target.x - player.position.x - 0;
			var pointery = cellSize * middleY + player.target.y - player.position.y - 0;


			mouse.pointers.target.draw(context, {
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
	var span = document.createElement('span');
	span.innerHTML = text;
	span.style.position = 'absolute';
	span.style.left = (x + 2) + 'px';
	span.style.top = (y + 2) + 'px';
	span.style.color = '#000';
	document.getElementById('overlay').appendChild(span);

	var span = document.createElement('span');
	span.innerHTML = text;
	span.style.position = 'absolute';
	span.style.left = x + 'px';
	span.style.top = y + 'px';
	span.style.color = '#FFF';
	document.getElementById('overlay').appendChild(span);

}

function checkMouse(){
	var delta;
	var state = mouse.stateQueue[0];

	if(
		   (!mouse.stateQueue[0].e.buttons & 1)
		&& (mouse.stateQueue[1].e.buttons & 1)
		&& (!mouse.stateQueue[2].e.buttons & 1)
		&& (mouse.stateQueue[3].e.buttons & 1)
	){
		if(Date.now() - mouse.stateQueue[3].time < 1000){
			console.log('double click');
		}
	}

	if(state.e.buttons & 1){
		delta = player.distanceToMouseEvent(state.e);
		if(delta.x * delta.x + delta.y * delta.y < cellSize * cellSize * .25){
			// clicked on the cell we're standing on
			if(!handleActiveCellClick()){
				player.setTarget(delta.x, delta.y);
			}
		}else{
			player.setTarget(delta.x, delta.y);
		}
	}else{
		/*
		player.target = {
			x : player.position.x,
			y : player.position.y
		}
		*/
	}

}

function playGame(){
	var n;
	checkMouse();
	player.act();
	for(n = 0; n < characters.length; n++){
		characters[n].act();
	}
	renderView(activeMap);
}

function checkOverlay(){

	var x, y, cx, cy, opactiy, o, cell;
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

var initialize = function(){
	var spriteList = Array(
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
	);
	var pointerSet;
	var pointerList = Array(
		{'name' : 'target', 'file' : 'target.sprite'}
	);

	var doStep = function(step){
		var x, y;
		var dat;
		// pre-load any data we need to get the game started.
		// Note that using callbacks on this method prevents it from building a stack.
		// It also allows us to wait for each step to complete before calling the next
		// one.
		console.log('doing step "' + step + '"');
		switch(step){
			case 'initialize':
				gameCanvas = document.getElementById('gameCanvas');
				gameCanvas.width = window.innerWidth;
				gameCanvas.height = window.innerHeight;

				screenMiddle = { x : gameCanvas.width >> 1, y : gameCanvas.height >> 1 };
				viewRange = {
					width: Math.ceil(gameCanvas.width / (gameScale * cellSize)) + 1,
					height: Math.ceil(gameCanvas.height / (gameScale * cellSize)) + 1
				}
				context = gameCanvas.getContext('2d');
				context.webkitImageSmoothingEnabled = false;
				context.mozImageSmoothingEnabled = false;
				context.imageSmoothingEnabled = false; /// future

				writeText(5, 5, "DungeonCrawler v.0.0");
				setTimeout(function(){
					doStep('load spriteSets');
					//doStep('build console');
				}, 1);
				break;
			case 'build console':
				console.log_classic = console.log;
				console.log = (function(){
					// create a translucent backdrop for cool factor +1
					var logBackdrop = document.createElement('DIV');
					logBackdrop.setAttribute("id", "logBackdrop");
					logBackdrop.setAttribute("class", "logElement");
					document.getElementById('overlay').appendChild(logBackdrop);

					// build the element that will hold the actual output
					var logTarget = document.createElement('DIV');
					logTarget.setAttribute("id", "logWindow");
					logTarget.setAttribute("class", "logElement");
					document.getElementById('overlay').appendChild(logTarget);

					// catch any click events within the element
					var eventChecks = {
						'mousemove' : 'handleMouseMove',
						'mousedown' : 'handleMouseDown',
						'mouseup' : 'handleMouseUp'
					};
					for(var evt in eventChecks){
						logTarget.addEventListener(evt, function(e){ 
							e.stopPropagation();
							return false; 
						});
					}

					// and here's the actual function getting used
					return function(output){
						logTarget.innerHTML += output + '<br/>';
						logTarget.scrollTop = logTarget.scrollHeight;
					};
				})();

				//showGameGrid = true;

				setTimeout(function(){
					doStep('load spriteSets');
				}, 1);

				break;

			case 'load spriteSets':
				if(spriteList.length > 0){
					dat = spriteList.pop();
					spriteSets[dat.name] = new spriteSet('sprites/' + dat.file, function(){
						sprites[dat.name] = new cSprite(spriteSets[dat.name]);
						sprites[dat.name].setScale(gameScale);
						setTimeout(function(){
							doStep('load spriteSets');
						}, 1);
					});

				}else{

					sprites.waterWaves.setFrame('0');


					doStep('load player sprite');
				}
				break;


			case 'load player sprite':
				player = new characterClass();
				player.category = 'player';
				playerSpriteSet.load("sprites/player.sprite", function(){
					player.sprite = new cSprite(this);
					player.sprite.setScale(gameScale);
					player.sprite.setPosition(screenMiddle.x, screenMiddle.y, true);

					player.sprite.setFrame('front_idle');
					setTimeout(function(){doStep('load map');}, 0);
				});
				break;

			case 'load map':
				var mapIdx = maps.length;
				maps[mapIdx] = new mapBuilder();
				console.log('calling loadImageMap');
				///////////////////////////////////////////////////////////////
				/////////// Swap the next two lines for test map /// //////////
				///////////////////////////////////////////////////////////////
				maps[mapIdx].loadImageMap('maps/Map1.map', function(){
				//maps[mapIdx].loadImageMap('maps/test.map', function(){
					console.log('map loaded, placing player');
					activeMap = maps[mapIdx];


					player.position.x = Math.floor(cellSize * (activeMap.playerPos.x + .5));
					player.position.y = Math.floor(cellSize * (activeMap.playerPos.y + .5));
					player.mapPos = {
						x : activeMap.playerPos.x,
						y : activeMap.playerPos.y
					};
					player.skills.vision = 5;

					// make the whole map visible
					for(x = 0; x < activeMap.width; x++){
						for(y = 0; y < activeMap.height; y++){
							activeMap.hideMap[x][y] = false;
						}
					}
//					checkOverlay();
					renderView(activeMap);

					doStep('initialize events');
				});
				break;
			case 'initialize events':
				// the functions used here are defined in keyboard.js and mouseHandler.js
				keyboard = new kbListener();
				keyboard.listen();
				keyboard.onCombo(['CTRL', 'G'], function(){
					showGameGrid = !showGameGrid;
				});
				//loadDefaultMotionControls();


				document.getElementById('overlay').addEventListener('contextmenu', function(e){
					e.preventDefault();
				});
				mouse = new mouseHandler();
				mouse.pointers = {}; // <-- might as well add the mouse icons to the event object

				mouse.listen(document.getElementById('overlay'));
				setTimeout(function(){doStep('load mouse pointers');}, 1);
				break;


			case 'load mouse pointers':

				// this step has to happen after initializing events, as that's where the mouse
				// handler is defined, (mouse), and that's where we're storing the sprites as
				// well.
				if(pointerList.length > 0){
					dat = pointerList.pop();
					pointerSet = new spriteSet('sprites/' + dat.file, function(){
						mouse.pointers[dat.name] = new cSprite(pointerSet);
						mouse.pointers[dat.name].setScale(gameScale);
						setTimeout(function(){
							doStep('load mouse pointers');
						}, 1);
					});

				}else{
					mouse.pointers['target'].startSequence('spin', {
						iterations: 0,
						method : 'manual'
					});
					///////////////////////////////////////////////////////////////
					/////////// FIXME switch this back when done testing //////////
					///////////////////////////////////////////////////////////////
					doStep('load test character');
					//doStep('finish');
				}
				break;

			case 'load test character':
				// let's add a character
				var knightSprite = new spriteSet('sprites/humanFemale.sprite', function(){
					characters[0] = new characterClass();
					characters[0].category = 'hominid';
					characters[0].position.x = player.position.x - 25;
					characters[0].position.y = player.position.y + 25;
					//debugger;
					characters[0].sprite = new cSprite(knightSprite);
					characters[0].sprite.setScale(gameScale);
					characters[0].sprite.setFrame('front_idle');
					characters[0].skills.speed *= .5;

					characters[0].skills.vision = 6;

					setTimeout(function(){doStep('finish');}, 1);
				});
				break;

			case 'finish':
				gameInterval = setInterval(playGame, 70);
		}
	}
	doStep('initialize');
};

window.onload = function(){
	initialize();
};
