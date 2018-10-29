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
var gameCanvas;
var viewRange = {};
var motionControls = {};
var playerSpriteSet = new spriteSet();
var spriteSets = {}, sprites = {};
var player;
var gameScale = 5, cellSize = 12;
var maps = Array();
var activeMap;
var context;
var gameInterval; // <-- the animation interval object
var walkSpeed = 3;
var angSpeedRatio = {
	x : .70711, // 1/sqrt(2) <- the axis projection of a 45 degree unit vector
	y : .70711
};
var screenMiddle = {x: 0, y : 0};
var characters = [];

var characterClass = function(){
	this.position = {x : 0, y : 0};
	this.direction = 'down';
	this.sprite = null;
	this.currentSequence = null;
	this.currentEndFrame = null;
	this.category = null;
	this.skills = {
		speed : walkSpeed,
		vision: 3
	};
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
			for(var n in activeMap.mappedItems[activeMap.playerPos.x][activeMap.playerPos.y]){
				rval = rval.concat(activeMap.mappedItems[activeMap.playerPos.x][activeMap.playerPos.y]);
			}
		}
	}
	return rval;


};

characterClass.prototype.move = function(dx, dy, noCollision){
	var i, xTally, yTally;
	var sgndx = Math.sign(dx);
	var absdx = Math.abs(dx);
	var sgndy = Math.sign(dy);
	var absdy = Math.abs(dy);

	if (absdx >= absdy){
		yTally = absdx >> 1;
		for(i = 0; i < absdx; i++){
			yTally += absdy;
			if (yTally >= absdx){
				yTally -= absdx;
				if(this.canWalkOn(this.position.x, this.position.y + sgndy)){
					this.position.y += sgndy;
				}
			}
			if(this.canWalkOn(this.position.x + sgndx, this.position.y)){
				this.position.x += sgndx;
			}
		}
	}else{
		xTally = absdy >> 1;
		for(i = 0; i < absdy; i++){
			xTally += absdx;
			if(xTally >= absdy){
				xTally -= absdy;
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

function checkKeyControl(action){
	var rval, n;
	if(motionControls[action] != undefined){
		rval = true;
		for(n in motionControls[action]){
			rval &= keyboard.keyState[motionControls[action][n]] ? true : false;
		}
	}else{
		rval = false;
	}
	return rval;
}

function check_key_state(){
	var dirCombo = 0, n;
	var sequence = null;
	var endFrame = null;
	var fighting = checkKeyControl('attack');

	dirCombo += checkKeyControl('up') ? 1 : 0;
	dirCombo += checkKeyControl('down') ? 2 : 0;
	dirCombo += checkKeyControl('left') ? 4 : 0;
	dirCombo += checkKeyControl('right') ? 8 : 0;

	switch(dirCombo){
		case 1: case 13: // up
			sequence = 'walkup';
			endFrame = 'back_idle';
			player.direction = 'up';
			break;
		case 2: case 14: // down
			sequence = 'walkdown';
			endFrame = 'front_idle';
			player.direction = 'down';
			break;
		case 4: case 7: // left
			sequence = 'walkleft';
			endFrame = 'left_idle';
			player.direction = 'left';
			break;
		case 8: case 11:// right
			sequence = 'walkright';
			endFrame = 'right_idle';
			player.direction = 'right';
			break;
		case 5: // up/left
			sequence = 'walkupleft';
			endFrame = 'back_left_idle';
			player.direction = 'upleft';
			break;
		case 6: // down/left
			sequence = 'walkdownleft';
			endFrame = 'front_left_idle';
			player.direction = 'downleft';
			break;
		case 9: // up/right
			sequence = 'walkupright';
			endFrame = 'back_right_idle';
			player.direction = 'upright';
			break;
		case 10: // down/right
			sequence = 'walkdownright';
			endFrame = 'front_right_idle';
			player.direction = 'downright';
			break;
	}

	if(fighting){
		var endState = {
			'up' : 'back_idle',
			'down' : 'front_idle',
			'left' : 'left_idle',
			'right' : 'right_idle',
			'upleft' : 'back_left_idle',
			'upright' : 'back_right_idle',
			'downleft' : 'front_left_idle',
			'downright' : 'front_right_idle'
		}[player.direction];
		var newSequence = {
			'up' : 'attack_back',
			'down' : 'attack_front',
			'left' : 'attack_left',
			'right' : 'attack_right',
			'upleft' : 'attack_up_left',
			'upright' : 'attack_up_right',
			'downleft' : 'attack_down_left',
			'downright' : 'attack_down_right'
		}[player.direction];
		if(newSequence != undefined && newSequence != player.currentSequence){
			player.currentSequence = newSequence;
			player.sprite.startSequence(newSequence, {
				iterations: 1,
				method : 'manual',
				callback: function(){
					player.currentSequence = null;
					player.sprite.setFrame(endState);
				}
			});
		}
	}else{
		//var currentCellType = player.currentMapVal();
		var touchingItems = player.touchingItems();

		if(sequence == null){
			if(player.currentSequence != null){
				//player.sprite.stopSequence(player.currentSequence);
				player.sprite.setFrame(player.currentEndFrame);
				player.currentSequence = null;
				player.sprite.currentSequence = null;
				player.sprite.animating = false;
			}
			// this should be replaced with a call to a function that builds a menu of
			// actions available (e.g, "go down", "take food", "take weapon", etc.).  That
			// would be a mildly translucent menu that lits on another interface layer
			// above, perhaps to the bottom right of the player.  Each option in there
			// would have a keyboard shortcut(e.g. "pick up item [,]").  With an option not
			// to display those menus.
			for(n in touchingItems){
				switch(touchingItems[n].content){
					case 'stairup':
						if(checkKeyControl('exit')){
							useEntrance(touchingItems[n]);
						}
						break;
					case 'stairdown':
						if(checkKeyControl('enter')){
							useEntrance(touchingItems[n]);
						}
						break;
					case 'caveEntrance':
						if(checkKeyControl('enter')){
							useEntrance(touchingItems[n]);
						}
						break;
					default:
						console.log(touchingItems[n].content);
				}
			}


		}else if(sequence != player.currentSequence){
			/*
			if(player.currentSequence != null){
				player.sprite.stopSequence(player.currentSequence);
			}
			*/
			player.currentEndFrame = endFrame;
			player.currentSequence = sequence;
			player.sprite.startSequence(sequence, {
				iterations: 0,
				method : 'manual',
				callback: function(){
					player.currentSequence = null;
					player.sprite.setFrame(endFrame);
				}
			});
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
					for(n in area.items[itemName]){
						item = area.items[itemName][n];
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
		for(n in playerLayer){
			playerLayer[n].sprite.setFrame(playerLayer[n].frame);
			playerLayer[n].sprite.draw(context, {
				x : playerLayer[n].x, 
				y : playerLayer[n].y
			});
		}

		for(n in characters){
			var offset = {
				x : characters[n].sprite.frameWidth >> 1,
				y : characters[n].sprite.frameHeight - 1
			};
			characters[n].sprite.draw(context, {
				x : cellSize * middleX + characters[n].position.x - player.position.x - offset.x,
				y : cellSize * middleY + characters[n].position.y - player.position.y - offset.y
			});
		}

		player.sprite.draw(context, {
			x : cellSize * middleX - (player.sprite.frameWidth >> 1),
			y : cellSize * middleY - player.sprite.frameHeight + 1
		});

		for(n in topLayer){
			topLayer[n].sprite.setFrame(topLayer[n].frame);
			topLayer[n].sprite.draw(context, {
				x : topLayer[n].x, 
				y : topLayer[n].y
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

function playGame(){
	check_key_state();
	if(player.currentSequence != null){
		switch(player.currentSequence){
			case 'walkup': player.move(0, -player.skills.speed); break;
			case 'walkdown': player.move(0, player.skills.speed); break;
			case 'walkleft': player.move(-player.skills.speed, 0); break;
			case 'walkright': player.move(player.skills.speed, 0); break;
			case 'walkupleft': player.move(-angSpeedRatio.x * player.skills.speed, -angSpeedRatio.y * player.skills.speed ); break;
			case 'walkupright': player.move(angSpeedRatio.x * player.skills.speed, -angSpeedRatio.y * player.skills.speed ); break;
			case 'walkdownleft': player.move(-angSpeedRatio.x * player.skills.speed, angSpeedRatio.y * player.skills.speed); break;
			case 'walkdownright': player.move(angSpeedRatio.x * player.skills.speed, angSpeedRatio.y * player.skills.speed); break;
		}
		player.sprite.doSequenceStep();


	}
	moveCharacters();
	renderView(activeMap);
}

function moveCharacters(){
	var n, direction, sequence, endFrame;
	for(n = 0; n < characters.length; n++){
		// note that these comparisons are checking to see if the distance from player to
		// character is less than the grid size shown on the screen.  In other words if
		// the character is as much as half a screenwidth outside the screen range.
		if(viewRange.height * cellSize  < Math.abs(characters[n].position.y - player.position.y)){
			continue;
		}
		if(viewRange.width * cellSize < Math.abs(characters[n].position.x - player.position.x)){
			continue;
		}
		
		direction = Math.round(4 * rel_ang(
			characters[n].position.x,
			characters[n].position.y,
			player.position.x,
			player.position.y
		) / Math.PI) % 8;

		switch(direction){
			case 0: 
				characters[n].move(0, -characters[n].skills.speed);
				sequence = 'walkup';
				endFrame = 'back_idle';
				characters[n].direction = 'up';
				break;
			case 1: 
				characters[n].move(angSpeedRatio.x * characters[n].skills.speed, -angSpeedRatio.y * characters[n].skills.speed ); 
				sequence = 'walkupright';
				endFrame = 'back_right_idle';
				characters[n].direction = 'upright';
				break;
			case 2: 
				characters[n].move(characters[n].skills.speed, 0); 
				sequence = 'walkright';
				endFrame = 'right_idle';
				characters[n].direction = 'right';
				break;
			case 3: 
				characters[n].move(angSpeedRatio.x * characters[n].skills.speed, angSpeedRatio.y * characters[n].skills.speed); 
				sequence = 'walkdownright';
				endFrame = 'front_right_idle';
				characters[n].direction = 'downright';
				break;
			case 4: 
				characters[n].move(0, characters[n].skills.speed); 
				sequence = 'walkdown';
				endFrame = 'front_idle';
				characters[n].direction = 'down';
				break;
			case 5: 
				sequence = 'walkdownleft';
				endFrame = 'front_left_idle';
				characters[n].direction = 'downleft';
				characters[n].move(-angSpeedRatio.x * characters[n].skills.speed, angSpeedRatio.y * characters[n].skills.speed); 
				break;
			case 6: 
				sequence = 'walkleft';
				characters[n].move(-characters[n].skills.speed, 0); 
				endFrame = 'left_idle';
				characters[n].direction = 'left';
				break;
			case 7: 
				characters[n].move(-angSpeedRatio.x * characters[n].skills.speed, -angSpeedRatio.y * characters[n].skills.speed ); 
				sequence = 'walkupleft';
				endFrame = 'back_left_idle';
				characters[n].direction = 'upleft';
				break;
		}

		/*  // I think this chunk is only relevant to fighting sequences
		if(newSequence != undefined && newSequence != characters[n].currentSequence){
			characters[n].currentSequence = newSequence;
			characters[n].sprite.startSequence(newSequence, {
				iterations: 1,
				method : 'manual',
				callback: function(){
					characters[n].currentSequence = null;
					characters[n].sprite.setFrame(endState);
				}
			});
		}
		*/
		var touchingItems = characters[n].touchingItems();

		if(sequence == null){
			if(characters[n].currentSequence != null){
				//characters[n].sprite.stopSequence(characters[n].currentSequence);
				characters[n].sprite.setFrame(characters[n].currentEndFrame);
				characters[n].currentSequence = null;
				characters[n].sprite.currentSequence = null;
				characters[n].sprite.animating = false;
			}

		}else if(sequence != characters[n].currentSequence){
			characters[n].currentEndFrame = endFrame;
			characters[n].currentSequence = sequence;
			characters[n].sprite.startSequence(sequence, {
				iterations: 0,
				method : 'manual',
				callback: function(){
					characters[n].currentSequence = null;
					characters[n].sprite.setFrame(endFrame);
				}
			});
		}
	}
}

function loadDefaultMotionControls(){
	motionControls = {
		up : [keyboard.KEYMAP['UP']],
		down: [keyboard.KEYMAP['DOWN']],
		left: [keyboard.KEYMAP['LEFT']],
		right: [keyboard.KEYMAP['RIGHT']],
		enter : [keyboard.KEYMAP['SHIFT'], keyboard.KEYMAP['.']],
		exit : [keyboard.KEYMAP['SHIFT'], keyboard.KEYMAP[',']],
		attack: [keyboard.KEYMAP['CTRL']],
		grab : [keyboard.KEYMAP[',']],
	};
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
				maps[mapIdx].loadImageMap('maps/Map1.map', function(){
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

					doStep('initialize keyboard');
				});
				break;
			case 'initialize keyboard':
				// the functions used here are defined in keyboard.js
				keyboard = new kbListener();
				keyboard.listen();
				loadDefaultMotionControls();
				setTimeout(function(){doStep('load test character');}, 1);
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
