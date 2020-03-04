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
//var keyboard;

// this variable is just for some debug testing
var pathCanvas, pathContext, plotPixel, redPixel;

var mouse;
var gameCanvas;
var viewRange = {};
var playerSpriteSet = new spriteSet();
var spriteSets = {}, sprites = {};
var player;
var gameScale = 4, cellSize = 12;
var maps = Array();
var activeMap;
var context;
var gameInterval; // <-- the animation interval object
var walkSpeed = 3;
var screenMiddle = {x: 0, y : 0};
var characters = [];

var characterClass = function(){
	this.position = {x : 0, y : 0};
	this.sprite = null;
	this.currentSequence = null;
	this.currentEndFrame = null;
	this.category = null;
	this.skills = {
		speed : walkSpeed,
		vision: 3
	};
	this.walkPath = Array();
	this.target = null;
};

characterClass.prototype.setMapPos = function(x, y){
	// our grid position on the map
	activeMap.playerPos.x = x;
	activeMap.playerPos.y = y;

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
	var pos = activeMap.playerPos;
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
	if(activeMap.mappedItems[activeMap.playerPos.x] != undefined){
		if(activeMap.mappedItems[activeMap.playerPos.x][activeMap.playerPos.y] != undefined){
			for(var i  of activeMap.mappedItems[activeMap.playerPos.x][activeMap.playerPos.y]){
				rval = rval.concat(activeMap.mappedItems[activeMap.playerPos.x][activeMap.playerPos.y]);
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

	if(this.target == null){
		if(this.walkPath.length == 0){
			return;
		}else{
			this.target = this.walkPath.shift();
		}
	}
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
	if(this == player){
		activeMap.playerPos = {
			x : Math.floor(this.position.x / cellSize),
			y : Math.floor(this.position.y / cellSize)
		}
	}
	checkOverlay();


};

characterClass.prototype.findTarget = function(){
	if(this == player){
		
	}else{
		if(viewRange.height * cellSize  < Math.abs(this.position.y - player.position.y)){
			this.target = null;
			return;
		}
		if(viewRange.width * cellSize < Math.abs(this.position.x - player.position.x)){
			this.target = null;
			return;
		}

		var diametersq = squareDistance(
			this.position.x,
			this.position.y,
			player.position.x,
			player.position.y
		);
		if(diametersq <= Math.pow(2 * this.skills.vision  * cellSize, 2)){
			if(diametersq <= cellSize){
				// here should be interaction between characters (fighting/whatever)
				this.target = null;
			}else{
				// this should check the aggression of the character first.  In fact, it should
				// probably just call a function to get the character's "desire".
				this.target = {
					x : player.position.x,
					y : player.position.y
				};
			}
		}else{
			//this.target = null;
		}
	}
}

characterClass.prototype.act = function(){
	var frameIndex, sequence, endFrame, diametersq, oldx, oldy;
	this.findTarget();

	if(this.target != null){
		if(this.position.x == this.target.x && this.position.y == this.target.y){
			if(this.walkPath.length){
				this.target = this.walkPath.shift();
			} else {
				this.target = null;
			}
			
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
	player.walkPath = Array();
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
	var i;
	var touchingItems = player.touchingItems();

	for(i of touchingItems){
		switch(i.content){
			case 'stairup':
				useEntrance(i);
				break;
			case 'stairdown':
				useEntrance(i);
				break;
			case 'caveEntrance':
				useEntrance(i);
				break;
			default:
				console.log(i.content);
		}
	}

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

		var middleX = Math.floor(screenMiddle.x / (gameScale * cellSize))
		var middleY = Math.floor(screenMiddle.y / (gameScale * cellSize))



		for(y = -1; y <= viewRange.height + 1; y++){
			mapY = area.playerPos.y + y - middleY;
			if(mapY < 0 || mapY > area.map[0].length - 1) continue;

			for(x = -1; x <= viewRange.width + 1; x++){
				mapX = area.playerPos.x + x - middleX;
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

			// the zero should probably be the center of the sprite
			var pointerx = cellSize * middleX + player.walkPath[player.walkPath.length - 1].x - player.position.x - 0;
			var pointery = cellSize * middleY + player.walkPath[player.walkPath.length - 1].y - player.position.y - 0;


			mouse.pointers.target.draw(context, {
				x : pointerx,
				y : pointery
			});
		}


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
		player.sprite.setPosition(
			cellSize * middleX - (player.sprite.frameWidth >> 1),
			cellSize * middleY - player.sprite.frameHeight + 1,
			1
		);
		player.sprite.draw(context);
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
		if(Math.abs(delta.x) < cellSize >> 1 && Math.abs(delta.y) < cellSize >> 1){
			// clicked on the cell we're standing on
			handleActiveCellClick();
		}else{
		/*
			player.target = {
				x : player.position.x + delta.x,
				y : player.position.y + delta.y
			};
		*/
		}

		
		player.walkPath = player.findPath({
			dx : Math.round(delta.x),
			dy : Math.round(delta.y)
		});

		// replace the end location in the path with the actual pixel clicked on.
		player.walkPath.pop();
		player.walkPath.push({
			x : player.position.x + delta.x,
			y : player.position.y + delta.y
		});


		player.target = player.walkPath.shift();
		console.log('remaining path steps: ' + player.walkPath.length);
		
	}else{
		/*
		player.target = {
			x : player.position.x,
			y : player.position.y
		}
		*/
	}

}

characterClass.prototype.findPath = function(displacement){

	// target is the pixel location we're going to
	var target = {
		x : player.position.x + displacement.dx,
		y : player.position.y + displacement.dy
	};

	// viewRadius is the width and height of the region to use for mapping
	var viewRadius = Math.max(viewRange.width, viewRange.height) >> 1;


	// the rounded target position in the pathfinding array
	var viewTarget = {
		x : Math.floor(target.x / cellSize) - activeMap.playerPos.x,
		y : Math.floor(target.y / cellSize) - activeMap.playerPos.y
	};

	// make sure our pathfinding grid includes the target point
	viewRadius = Math.max(Math.abs(viewTarget.x), viewRadius);
	viewRadius = Math.max(Math.abs(viewTarget.y), viewRadius);

	var size = 2 * viewRadius + 1;

	// now make that target relative to the center of the map
	viewTarget.x += viewRadius + 1;  // <-- *** NEED TO DOUBLE CHECK THESE +1's
	viewTarget.y += viewRadius + 1;


	/*
	Once conitionally traversible cells become a thing (boat lets you hit water,
	equipment for mountain climbing, etc.)  This should instead read from the world
	map instead of the collision map, and run it through a function to flag cells
	as traversible or not based on those conditions.  Eventually this should
	probably apply in all cases an the collision map can be removed, which should
	save memory.
	*/


	// get the region of the 
	var viewMap = getArraySubset(
		activeMap.collisionMap, 
		activeMap.playerPos.x - viewRadius,
		activeMap.playerPos.y - viewRadius,
		size,
		size,
		1 // <-- this should vary depending on whether water traversing equipment is available
	);

	var x, y;
	pathContext.fillStyle = 'rgba(80, 120, 200, 0.6)';
	pathContext.fillRect(0, 0, 102, 102);
	for(x = 0; x < viewMap.length; x++){
		for(y = 0; y < viewMap[x].length; y++){
			if(viewMap[x][y]){
				pathContext.putImageData(plotPixel, x, y);
			}
		}
	}
	

	// now create our path finding map instance and the finder that will use it
	var testMap = new PF.Grid(size, size, viewMap);

	var finder = new PF.BestFirstFinder({
		allowDiagonal : true,
		heuristic : PF.Heuristic.chebyshev,
		dontCrossCorners: true
	});

	// and find the path that gets us there
	var path = finder.findPath(
		viewRadius + 1,
		viewRadius + 1,
		viewTarget.x,
		viewTarget.y,
		testMap
	);

	//path = PF.Util.smoothenPath(testMap, path);


	// the resulting output includes the starting position, which we don't
	// need, so drop it
	path.shift();

	// now translate this path to the correct game scale and make it relative to
	// the map instead of the test area

//	pathContext.fillRect(0, 0, 102, 102);

	path.map(function(r, idx, p){
		pathContext.putImageData(redPixel, r[0], r[1]);
		r[0] -= viewRadius + 1;
		r[1] -= viewRadius + 1;
		r[0] *= cellSize;
		r[1] *= cellSize;
		r[0] += player.position.x;
		r[1] += player.position.y;

		// also massage it to fix the path usage elsewhere.
		p[idx] = {x : r[0], y : r[1]};
		return r;
	});
	
	return path;

}

function textureIsPassable(v){

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
	activeMap.playerPos.x

	var x, y, cx, cy, opactiy, o, cell;
	for(x = -player.skills.vision; x <= player.skills.vision; x++){
		cx = x + activeMap.playerPos.x;
		if(cx >= 0 && cx < activeMap.width){
			for(y = -player.skills.vision; y <= player.skills.vision; y++){
				cy = y + activeMap.playerPos.y;
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
		{'name' : 'waterWaves' , 'file' : 'waterWaves.sprite'}
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
				
				pathCanvas = document.createElement('CANVAS');
				pathCanvas.width = 102;
				pathCanvas.height = 102;
				pathCanvas.style.float = "right";
				pathContext = pathCanvas.getContext('2d');
				pathContext.webkitImageSmoothingEnabled = false;
				pathContext.mozImageSmoothingEnabled = false;
				pathContext.imageSmoothingEnabled = false; /// future
				document.getElementById('overlay').appendChild(pathCanvas);
				pathContext.fillStyle = 'rgba(80, 120, 200, 0.6)';
				pathContext.fillRect(0, 0, 102, 102);

				plotPixel = pathContext.createImageData(1, 1);
				var d = plotPixel.data;
				d[0] = 255;
				d[1] = 255;
				d[2] = 255;
				d[3] = 255;

				redPixel = pathContext.createImageData(1, 1);
				var d = redPixel.data;
				d[0] = 255;
				d[1] = 80;
				d[2] = 80;
				d[3] = 255;



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
				/////////// FIXME switch this back when done testing //////////
				///////////////////////////////////////////////////////////////
				maps[mapIdx].loadImageMap('maps/Map1.map', function(){
				//maps[mapIdx].loadImageMap('maps/test.map', function(){
					console.log('map loaded, placing player');
					activeMap = maps[mapIdx];


					player.position.x = Math.floor(cellSize * activeMap.playerPos.x);
					player.position.y = Math.floor(cellSize * activeMap.playerPos.y);
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
				/*
				keyboard = new kbListener();
				keyboard.listen();
				loadDefaultMotionControls();
				*/
				mouse = new mouseHandler();
				mouse.pointers = {}; // <-- might as well add the mouse icons to the event object

				mouse.listen(document.getElementById('overlay'));
				setTimeout(function(){doStep('load mouse pointers');}, 1);
				//setTimeout(function(){doStep('load test character');}, 1);
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
					//doStep('load test character');
					doStep('finish');
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
