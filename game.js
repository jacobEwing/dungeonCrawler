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

	/*
	// these old values were used on an isometric map
	x : 0.866, // <- sin(pi / 3)
	y : 0.5 // <- cos(pi / 3)
	*/
};
var screenMiddle = {x: 0, y : 0};
var player = (function(){
	var position = {x : 0, y : 0};
	return {
		direction : 'down',
		sprite : null,
		'position' : position,
		setMapPos : function(x, y){
			// our grid position on the map
			activeMap.playerPos.x = x;
			activeMap.playerPos.y = y;

			// our real position in the map
			this.position.x = cellSize * x;
			this.position.y = cellSize * y;
		},
		canWalkOn : function(posx, posy){
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
		},
		currentMapVal : function(){
			var map = activeMap.map;
			var pos = activeMap.playerPos;
			var rval;

			if(pos.x < 0 || pos.y < 0 || pos.x >= map.length || pos.y >= map[pos.x].length){
				rval = null;
			}else{
				rval = map[pos.x][pos.y];
			}
			return rval;


		},
		touchingItems : function(){
			var rval = Array();
			if(activeMap.mappedItems[activeMap.playerPos.x] != undefined){
				if(activeMap.mappedItems[activeMap.playerPos.x][activeMap.playerPos.y] != undefined){
					for(var n in activeMap.mappedItems[activeMap.playerPos.x][activeMap.playerPos.y]){
						rval = rval.concat(activeMap.mappedItems[activeMap.playerPos.x][activeMap.playerPos.y]);
					}
				}
			}
			return rval;


		},
		move : function(dx, dy, noCollision){
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
			activeMap.playerPos = {
				x : Math.floor(this.position.x / cellSize),
				y : Math.floor(this.position.y / cellSize)
			}
			checkOverlay();
		},
		currentSequence: null,
		currentEndFrame : null
	};
})();
var waterframe = 0;
function renderView(area){
	var item, frameName;
	var playerLayer = Array();
	var topLayer = Array();
	/*
	just a bit of a joke experiment.  We can scale down sort of.  the user needs to be accounted for too though
	gameScale *= .999;
	viewRange = {
		width: Math.ceil(gameCanvas.width / (gameScale * cellSize)) + 1,
		height: Math.ceil(gameCanvas.height / (gameScale * cellSize)) + 1
	}
	*/
	var randomKey;

	var treeFrame;

	var x, y, mapX, mapY, gridX, gridY, drawX, drawY, n;

	context.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

	var drawOffset = {
		x : player.position.x % cellSize,
		y : player.position.y % cellSize
	}
	waterframe = (waterframe + 1)% 6;

	for(y = -1; y <= viewRange.height + 1; y++){
		mapY = area.playerPos.y + y - Math.floor(screenMiddle.y / (gameScale * cellSize));
		if(mapY < 0 || mapY > area.map[0].length - 1) continue;
		for(x = -1; x <= viewRange.width + 1; x++){
			mapX = area.playerPos.x + x - Math.floor(screenMiddle.x / (gameScale * cellSize));
			if(mapX < 0 || mapX > area.map.length - 1) continue;

			gridX = x * cellSize - drawOffset.x;
			gridY = y * cellSize - drawOffset.y;
			drawX = gridX * gameScale;
			drawY = gridY * gameScale;
	 
			if(area.hideMap[mapX][mapY] == true){
				continue;
			}

			randomKey = Math.abs(Math.sin(mapX + mapY * viewRange.width) * 10000);
			randomKey -= Math.floor(randomKey);
			switch(area.spritemap[area.map[mapX][mapY]]){
				/*
				case textures.water:
					
					break;
				*/
				case 'water':
					sprites.waterWaves.setPosition(gridX, gridY, false);
					sprites.waterWaves.setFrame(waterframe);
					sprites.waterWaves.draw(context);
					break;
				case 'stone floor':

					//sprites.ground.rotate(Math.floor(randomKey * 4) * Math.PI / 2);
					sprites.ground.drawRandomArea(context, drawX, drawY, cellSize, cellSize, randomKey);
					break;
				case 'stone wall':

					sprites.stone.setFrame(Math.floor(randomKey * 25));
					//sprites.stone.draw(context, {x : x * cellSize - drawOffset.x , y : y * cellSize - drawOffset.y});
					sprites.stone.draw(context, {x : gridX, y : gridY});
					break;
				case 'trees':


					// first we draw some grass

					sprites.grass.rotate(Math.PI / 2);
					sprites.grass.drawRandomArea(context, drawX, drawY, cellSize, cellSize, randomKey);


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
						x : drawX / gameScale,
						y : drawY / gameScale
					};

					// and queue up the greens for a second run
					topLayer[topLayer.length] = {
						sprite : sprites.tree,
						frame : 'greens' + treeFrame,
						x : drawX / gameScale,
						y : drawY / gameScale
					};



					break;
				case 'grass':

					sprites.grass.rotate(Math.PI / 2);
					sprites.grass.drawRandomArea(context, drawX, drawY, cellSize, cellSize, randomKey);

					if(randomKey < .5){
						var brushFrame = Math.floor(Math.abs(9 * Math.sin(mapX + mapY + viewRange.width + randomKey)));
						playerLayer[playerLayer.length] = {
							doing : 'grass',
							sprite : sprites.longgrass,
							frame : brushFrame,
							x : drawX / gameScale,
							y : drawY / gameScale
						};
					}

					break;
					/*
				default:
					context.fillStyle = '#88AACC';
					context.fillRect(drawX, drawY, cellSize * gameScale, cellSize * gameScale);
					*/
			}
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
								//sprites.dungeonElements.draw(context, {x : x * cellSize - drawOffset.x , y : y * cellSize - drawOffset.y});
								sprites.dungeonElements.draw(context, {x : drawX / gameScale, y : drawY / gameScale});
								break;
							case 'caveEntrance':
								sprites.caveEntrance.setFrame(frameName);
								sprites.caveEntrance.draw(context, {x : drawX / gameScale, y : drawY / gameScale});
						}
					}
				}
			}

		}
	}
	for(n in playerLayer){
		playerLayer[n].sprite.setFrame(playerLayer[n].frame);
		if(playerLayer[n].sprite.frame == undefined){
			debugger;
		}
		playerLayer[n].sprite.draw(context, {
			x : playerLayer[n].x, 
			y : playerLayer[n].y
		});
	}
	player.sprite.draw(context, {
		x : cellSize * Math.floor(screenMiddle.x / (gameScale * cellSize)) - (player.sprite.frameWidth >> 1),
		y : cellSize * Math.floor(screenMiddle.y / (gameScale * cellSize)) - player.sprite.frameHeight + 1
	});

	for(n in topLayer){
		topLayer[n].sprite.setFrame(topLayer[n].frame);
		topLayer[n].sprite.draw(context, {
			x : topLayer[n].x, 
			y : topLayer[n].y
		});
	}

}

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
			case 'walkup': player.move(0, -walkSpeed); break;
			case 'walkdown': player.move(0, walkSpeed); break;
			case 'walkleft': player.move(-walkSpeed, 0); break;
			case 'walkright': player.move(walkSpeed, 0); break;
			case 'walkupleft': player.move(-angSpeedRatio.x * walkSpeed, -angSpeedRatio.y * walkSpeed ); break;
			case 'walkupright': player.move(angSpeedRatio.x * walkSpeed, -angSpeedRatio.y * walkSpeed ); break;
			case 'walkdownleft': player.move(-angSpeedRatio.x * walkSpeed, angSpeedRatio.y * walkSpeed); break;
			case 'walkdownright': player.move(angSpeedRatio.x * walkSpeed, angSpeedRatio.y * walkSpeed); break;
		}
		player.sprite.doSequenceStep();


	}
	renderView(activeMap);
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

function checkOverlay(){
	activeMap.playerPos.x

	var x, y, cx, cy, opactiy, o, cell;
	for(x = -8; x <= 8; x++){
		cx = x + activeMap.playerPos.x;
		if(cx >= 0 && cx < activeMap.width){
			for(y = -8; y <= 8; y++){
				cy = y + activeMap.playerPos.y;
				if(cy >= 0 && cy < activeMap.height){
					if(x * x + y * y < player.sightRadius * player.sightRadius){
						activeMap.hideMap[cx][cy] = false;
					/*
					}else{
						opacity = (x * x + y * y) / 36;
						o = cell.css('opacity');
						if(o == undefined || o > opacity){
							cell.css('opacity', opacity);
						}
					*/
					}
				}
			}
		}
	}
}


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

	activeMap = entrance.target;
	player.setMapPos(activeMap.playerPos.x, activeMap.playerPos.y);
	player.position.x += cellSize >> 1;
	player.position.y += cellSize >> 1;
	checkOverlay();
	renderView(activeMap);
}

var initialize = function(){
	var spriteList = Array(
		{'name' : 'grass', 'file' : 'grass.sprite'},
		{'name' : 'trees', 'file' : 'tree.sprite'},
		{'name' : 'stone', 'file': 'stone.sprite'},
		{'name' : 'ground', 'file' : 'ground.sprite'},
		{'name' : 'dungeonElements', 'file' : 'dungeonElements.sprite'},
		{'name' : 'longgrass', 'file' : 'longgrass.sprite'},
		{'name' : 'caveEntrance' , 'file' : 'caveEntrance.sprite'},
		{'name' : 'waterwaves' , 'file' : 'waterwaves.sprite'}
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
						setTimeout(function(){
							doStep('load spriteSets');
						}, 1);
					});

				}else{
					sprites.tree = new cSprite(spriteSets.trees);
					sprites.tree.setScale(gameScale);

					sprites.longgrass = new cSprite(spriteSets.longgrass);
					sprites.longgrass.setScale(gameScale);

					sprites.grass = new cSprite(spriteSets.grass);
					sprites.grass.setScale(gameScale);

					sprites.stone = new cSprite(spriteSets.stone);
					sprites.stone.setScale(gameScale);

					sprites.ground = new cSprite(spriteSets.ground);
					sprites.ground.setScale(gameScale);

					sprites.dungeonElements = new cSprite(spriteSets.dungeonElements);
					sprites.dungeonElements.setScale(gameScale);

					sprites.caveEntrance = new cSprite(spriteSets.caveEntrance);
					sprites.caveEntrance.setScale(gameScale);

					sprites.waterWaves = new cSprite(spriteSets.waterwaves);
					sprites.waterWaves.setScale(gameScale);
					sprites.waterWaves.setFrame('0');

					doStep('load player sprite');
				}
				break;


			case 'load player sprite':
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
				maps[mapIdx].loadImageMap('maps/Map2.map', function(){
					console.log('map loaded, placing player');
					activeMap = maps[mapIdx];

					player.position.x = Math.floor(cellSize * activeMap.playerPos.x);
					player.position.y = Math.floor(cellSize * activeMap.playerPos.y);
					player.sightRadius = 5;


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



/*
				var mapIdx = maps.length;
				maps[mapIdx] = new mapBuilder();
				maps[mapIdx].build({
					category : 'forest',
					width : 100,
					height: 100,
					roomscale: 1,
					gridScale: 8,
					//stairup: true,
					stairdown: true,
					//startTexture: '<'
				});
				activeMap = maps[mapIdx];

				// quick random placement for now:
				activeMap.playerPos = activeMap.findTextureSpot('"');
				player.position.x = Math.floor(cellSize * (activeMap.playerPos.x));
				player.position.y = Math.floor(cellSize * (activeMap.playerPos.y));



				player.sightRadius = 5;


				// make the whole map visible
				for(x = 0; x < activeMap.width; x++){
					for(y = 0; y < activeMap.height; y++){
						activeMap.hideMap[x][y] = false;
					}
				}
				//checkOverlay();
				renderView(activeMap);

				setTimeout(function(){doStep('initialize keyboard');}, 1);
				break;
*/
			case 'initialize keyboard':
				// the functions used here are defined in keyboard.js
				keyboard = new kbListener();
				keyboard.listen();
				loadDefaultMotionControls();
				setTimeout(function(){doStep('finish');}, 1);
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

