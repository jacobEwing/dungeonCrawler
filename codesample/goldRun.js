var keyState = {};
var KEYMAP = {
	'UP' : 38,		'DOWN' : 40,		'LEFT' : 37,		'RIGHT' : 39,
	'ESC' : 27,		'ENTER' : 13,		'TAB' : 9,		'SPACE' : 32,
	'SHIFT' : 16,		'CTRL' : 17,		'ALT' : 18,		'BACKSPACE' : 8,
	'CAPS_LOCK' : 20,	'NUM_LOCK' : 144,	'SCROLL_LOCK' : 145,
	'PGUP' : 33,		'PGDN' : 34,		'END' : 35,
	'HOME' : 36,		'INSERT' : 45,		'DELETE' : 46,
	'TILDE' : 192,		"'" : 222,		'[' : 219,		']' : 221,
	'\\' : 220,		';' : 59,		'=' : 61,		'-' : 173,
	'META' : 91,		'MENU' : 93,
	'NUMPAD_*' : 106,	'NUMPAD_+' : 107,	'NUMPAD_-' : 109,	'NUMPAD_/' : 111,
	',' : 188,		'.' : 190

};
var REV_KEYMAP = {
	38: 'UP',		40: 'DOWN',		37: 'LEFT',		39: 'RIGHT',
	27: 'ESC',		13: 'ENTER',		9: 'TAB',		32: 'SPACE',
	16: 'SHIFT',		17: 'CTRL',		18: 'ALT',		8: 'BACKSPACE',
	20: 'CAPS_LOCK',	144: 'NUM_LOCK',	145: 'SCROLL_LOCK',
	33: 'PGUP',		34: 'PGDN',		35: 'END',
	36: 'HOME',		45: 'INSERT',		46: 'DELETE',
	192: 'TILDE',		222: "'",		219: '[',		221: ']',
	220: '\\',		59: ';',		61: '=',		173: '-',
	91: 'META',		93: 'MENU',
	106: 'NUMPAD_*',	107: 'NUMPAD_+',	109: 'NUMPAD_-',	111: 'NUMPAD_/',
	188: ',',		190: '.'
};
for(n = 65; n < 91; n++){
	KEYMAP[String.fromCharCode(n)] = n;
	REV_KEYMAP[n] = String.fromCharCode(n);
}
for(n = 0; n < 10; n++){
	KEYMAP[n] = 48 + n;
	REV_KEYMAP[48 + n] = n;
}
for(n = 1; n <= 12; n++){
	KEYMAP['F' + n] = 111 + n;
	REV_KEYMAP[111 + n] = 'F' + n;
}
for(n = 0; n < 10; n++){
	KEYMAP['NUMPAD_' + n] = 96 + n;
	REV_KEYMAP[96 + n] = 'NUMPAD_' + n;
}

for(n in KEYMAP){
	keyState[n] = 0;
}

function keyupCall(e){
	handleKey(e.which, 0); return false;
}

function keydownCall(e){
	handleKey(e.which, 1); return false;
}

var ANIMATION_FREQUENCY = 30;
var BRICK_REGROW_PERIOD = 90;
var leveldat;
var sprites;
var characterMap = {
	'empty' : 0, 0 : 'empty',
	'brick' : 1, 1 : 'brick',
	'steel' : 2, 2 : 'steel',
	'ladder' : 3, 3 : 'ladder',
	'hiddenladder' : 4, 4 : 'hiddenladder',
	'bar' : 5, 5 : 'bar',
	'gold' : 6, 6 : 'gold',
	'goodguy' : 7, 7 : 'goodguy',
	'badguy' : 8, 8 : 'badguy',
	'water' : 9, 9 : 'water',
	'deepwater' : 10, 10 : 'deepwater',
	'fire' : 11, 11 : 'fire',
	'elevator_up' : 12, 12 : 'elevator_up',
	'elevator_down' : 13, 13 : 'elevator_down',
	'ice' : 14, 14 : 'ice',
	'floorspike' : 15, 15 : 'floorspike',
	'ceilingspike' : 16, 16 : 'ceilingspike',
	'blades' : 17, 17 : 'blades',
	'teleporter' : 18, 18 : 'teleporter',
	'heart' : 19, 19 : 'heart',
	'righthinge' : 20, 20 : 'righthinge',
	'lefthinge' : 21, 21 : 'lefthinge'
};
var mapWidth = 40, mapHeight = 24;
var cellWidth = 24, cellHeight = 24;
var startingLives = 5;
var map = [];
var spriteMap = [];
var player, numLives;
var gold, numGolds;
var heart, numHearts;
var currentLevel = 0;
var digLeft = false, digRight = false;
var brickManager;
var badGuys, numBadGuys;
var animCells, numAnimCells;
var teleporters, numTeleporters;
var animationCycle;
var controls = {
	'UP' : 'UP',
	'DOWN' : 'DOWN',
	'LEFT' : 'LEFT',
	'RIGHT' : 'RIGHT',
	'DIG LEFT' : ',',
	'DIG RIGHT' : '.',
	'DIE' : 'DELETE',
	'SKIP LEVEL' : 'TAB',
	'PAUSE' : 'P',
	'QUIT' : 'ESC'
};
var animCycle = 0; animCycleRange = 13860; //<<- prime factors 2, 2, 3, 3, 5, 7, 11, in case we need a regular rhythm based on this
var gameState;


var brickManagerClass = function(){
	this.numBricks = 0;
	this.brick = [];

};

brickManagerClass.prototype.add = function(x, y){
	this.brick[this.numBricks] = {
		'x':x, 'y':y, 'count': BRICK_REGROW_PERIOD
	};
	map[x][y] = characterMap['empty'];
	this.numBricks++;
};

brickManagerClass.prototype.cycle = function(){
	var n, m;
	for(n = 0; n < this.numBricks; n++){
		this.brick[n].count --;
		if(this.brick[n].count <= 0){
			function restoreBrick(x, y){
				map[x][y] = characterMap['brick'];
				killat(x, y);
			}
			var bobj = this.brick[n];
			spriteMap[this.brick[n].x][this.brick[n].y].startSequence('regrowbrick', {'callback':function(){
				restoreBrick(bobj.x, bobj.y);
			}});
			for(m = n + 1; m < this.numBricks; m++){
				this.brick[m - 1] = this.brick[m];
			}
			this.brick[m] = undefined;
			this.numBricks--;
			n--;
		}
	}
};

// a class for representing a player
var playerClass = function(playerType){
	this.sprite = new spriteClass(sprites);
	this.x = this.y = 0;
	this.drawx = this.drawy = 0;
	this.currentStep = {
		deltax : 0,
		deltay : 0,
		directionx : 0,
		directiony : 0
	};
	this.digging = false;
	if(playerType == 'badguy'){
		this.sprite.setFrame('badguy_1');
	}else{
		this.sprite.setFrame('player_1');
	}
};

playerClass.prototype.setPos = function(x, y){
	this.x = x;
	this.y = y;
	this.drawx = x * cellWidth;
	this.drawy = y * cellHeight;
	this.sprite.position(this.drawx, this.drawy);
//	this.sprite.draw();
};

playerClass.prototype.stepping = function(){
	return this.currentStep.deltax != 0 || this.currentStep.deltay != 0 ;
};

playerClass.prototype.doStep = function(){
	var deltax = 0, deltay = 0;
	if(this.currentStep.deltax){
		deltax = Math.floor(cellWidth / 3);
		if(this.currentStep.deltax < 0){
			this.currentStep.deltax += deltax;
			if(this.currentStep.deltax >= 0){
				deltax += this.currentStep.deltax;
				this.currentStep.deltax = 0;
				this.x--;
			}
			deltax *= -1;
		}else{
			this.currentStep.deltax -= deltax;
			if(this.currentStep.deltax <= 0){
				deltax += this.currentStep.deltax;
				this.currentStep.deltax = 0;
				this.x++;
			}
		}
		this.drawx += deltax;
	}

	if(this.currentStep.deltay){
		deltay = Math.floor(cellHeight / 3);
		if(this.currentStep.deltay < 0){
			this.currentStep.deltay += deltay;
			if(this.currentStep.deltay >= 0){
				deltay += this.currentStep.deltay;
				this.currentStep.deltay = 0;
				this.y--;
			}
			deltay *= -1;
		}else{
			this.currentStep.deltay -= deltay;
			if(this.currentStep.deltay <= 0){
				deltay += this.currentStep.deltay;
				this.currentStep.deltay = 0;
				this.y++;
			}
		}
		this.drawy += deltay;
	}

	if(deltax || deltay){
		this.sprite.position(this.drawx, this.drawy);
	}
};

playerClass.prototype.die = function(){
	this.animcycle = 0;
	this.currentStep.deltax = this.currentStep.deltay = 0;
};

playerClass.prototype.seek = function(){
	// let's see if we're slipping on ice
	var slipping = false;
	if(this.y < mapHeight - 1 && this.currentStep.directionx == 1){
		if(map[this.x][this.y + 1] == characterMap['ice']){
			var stoppables = {'ladder':1, 'bar':1, 'elevator_up':1, 'elevator_down':1};
			if(stoppables[characterMap[map[this.x][this.y]]] == undefined){
				if(allowRightwardMotion(this)){
					this.currentStep.deltax = cellWidth;
				}
				slipping = true;
			}
		}
	}
	else if(this.y < mapHeight -1 && this.currentStep.directionx == -1){
		if(map[this.x][this.y + 1] == characterMap['ice']){
			var stoppables = {'ladder':1, 'bar':1, 'elevator_up':1, 'elevator_down':1};
			if(stoppables[characterMap[map[this.x][this.y]]] == undefined){
				if(allowLeftwardMotion(this)){
					this.currentStep.deltax = -cellWidth;
				}
				slipping = true;
			}
		}
	}
	if(slipping){
		this.sprite.stopSequence();
		this.sprite.setFrame('badguy_9');
		return;
	}

	// ok, let's try moving under our own volition:
	this.currentStep = {
		deltax : 0,
		deltay : 0,
		directionx : 0,
		directiony : 0
	};
	// determine their direction of movement if any
	var targetX;
	var direction, xdirection = 0, ydirection = 0;
	var canGoUp = allowUpwardMotion(this);
	var canGoDown = allowDownwardMotion(this);
	var canGoRight = allowRightwardMotion(this);
	var canGoLeft = allowLeftwardMotion(this);
	if(player.y < this.y) ydirection = -1;
	if(player.y > this.y) ydirection = 1;
	if(player.x < this.x) xdirection = -1;
	if(player.x > this.x) xdirection = 1;

	if(shouldFall(this.x, this.y)){
		direction = {'x':0, 'y':1};
	}else{
		direction = getForcedDirection(this.x, this.y);
		if(direction.x == 0 && direction.y == 0){
			if(ydirection == -1 && canGoUp){
				direction = {'x':0, 'y':-1};
			}else if(ydirection == 1 && canGoDown){
				direction = {'x':0, 'y':1};
			}
			if(direction.y == 0){
				if(player.y == this.y){
					if(xdirection == -1 && canGoLeft){
						direction = {'x':-1, 'y':0};
					}else if(xdirection == 1 && canGoRight){
						direction = {'x':1, 'y':0};
					}
				}else{
					if(ydirection < 0){
						// find the nearest ladder we can climb
						targetX = get_nearest_upmotion_spot(this.x, this.y);
					}else{
						// find the nearest place we can go downward
						targetX = get_nearest_downmotion_spot(this.x, this.y);
					}

					if(targetX >= 0 && targetX < this.x && canGoLeft){
						direction = {'x':-1, 'y':0};
					}else if(targetX > this.x && canGoRight){
						direction = {'x':1, 'y':0};
					}else if(xdirection == -1 && canGoLeft){
						direction = {'x':-1, 'y':0};
					}else if(xdirection == 1 && canGoRight){
						direction = {'x':1, 'y':0};
					}
				}
			}
		}
	}

	// work out what animation the sprite should be doing
	var spriteName = null;
	if(direction.x < 0){
		if(characterMap[map[this.x][this.y]] == 'bar'){
			spriteName = 'badguyhangleft';
		}else{
			spriteName = 'badguywalkleft';
		}
	}else if(direction.x > 0){
		if(characterMap[map[this.x][this.y]] == 'bar'){
			spriteName = 'badguyhangright';
		}else{
			spriteName = 'badguywalkright';
		}
	}else if(direction.y != 0 && characterMap[map[this.x][this.y]] == 'ladder'){
		spriteName = 'badguyclimb';
	}else if(/*falling*/false){
		this.sprite.stopSequence();
		this.sprite.setFrame('badguy_5');
	}else{
		this.sprite.stopSequence();
		this.sprite.setFrame('badguy_9');
	}

	if(spriteName != null){
		this.sprite.startSequence(
			spriteName,
			{
				'iterations' : 0,
				'method' : 'manual',
				'startframe' : this.sprite.currentSequence.currentFrame
			}
		);
	}

	if(direction.x || direction.y){
		this.currentStep.deltax = direction.x * cellWidth;
		this.currentStep.deltay = direction.y * cellHeight;
		this.currentStep.directionx = direction.x;
		this.currentStep.directiony = direction.y;
	}
};

function get_nearest_upmotion_spot(x, y){
	if(y <= 0) return -1;
	var leftspot = rightspot = -1;
	var endLeft = false, endRight = false;
	var onmap = true;
	var rval = -1;
	for(n = 1; onmap && (!endLeft || !endRight); n++){
		onmap = false;
		if(!endLeft && x - n >= 0){
			onmap = true;
			if(!canBeEntered(x - n, y)){
				endLeft = true;
			}else if(canBeEntered(x - n, y - 1)){
				switch(characterMap[map[x - n][y]]){
					case 'ladder': case 'elevator_up':
						leftspot = x - n;
						break;
				}
			}
		}

		if(!endRight && x + n < mapWidth){
			onmap = true;
			if(!canBeEntered(x + n, y)){
				endRight = true;
			}else if(canBeEntered(x + n, y - 1)){
				switch(characterMap[map[x + n][y]]){
					case 'ladder': case 'elevator_up':
						rightspot = x + n;
						break;
				}
			}
		}
	}
	if(rightspot != -1){
		if(leftspot != -1){
			var leftDelta = Math.abs(x - leftspot) + Math.abs(player.x - leftspot);
			var rightDelta = Math.abs(x - rightspot) + Math.abs(player.x - rightspot);
			if(leftDelta < rightDelta){
				rval = leftspot;
			}else if(leftDelta > rightDelta){
				rval = rightspot;
			}else if(x % 2){
				rval = leftspot;
			}else{
				rval = rightspot;
			}
		}else{
			rval = rightspot;
		}

	}else if(leftspot != -1){
		rval = leftspot;
	}
	return rval;
}

function get_nearest_downmotion_spot(x, y){
	if(y >= mapHeight - 1) return -1;
	var endLeft = false, endRight = false;
	var onmap = true;
	var rval = -1;
	var leftspot = rightspot = -1;

	for(n = 1; onmap && (!endLeft || !endRight); n++){
		onmap = false;
		if(!endLeft && x - n >= 0){
			onmap = true;
			if(!canBeEntered(x - n, y)){
				endLeft = true;
			}else{
				switch(characterMap[map[x - n][y + 1]]){
					case 'empty': case 'ladder': case 'hiddenladder': case 'bar': case 'gold': case 'elevator_down': case 'heart':
						for(m = 0; m < numBadGuys; m++){
							if(
								badGuys[m].x == x - n && badGuys[m].y == y + 1
								&& badGuys[m].currentStep.deltax == 0
								&& badGuys[m].currentStep.deltay == 0
							) break;
						}
						if(m >= numBadGuys){
							leftspot = x - n;
						}
						break;
				}
			}
		}

		if(!endRight && x + n < mapWidth){
			onmap = true;
			if(!canBeEntered(x + n, y)){
				endRight = true;
			}else{
				switch(characterMap[map[x + n][y + 1]]){
					case 'empty': case 'ladder': case 'hiddenladder': case 'bar': case 'gold': case 'elevator_down': case 'heart':
						for(m = 0; m < numBadGuys; m++){
							if(
								badGuys[m].x == x + n && badGuys[m].y == y + 1
								&& badGuys[m].currentStep.deltax == 0
								&& badGuys[m].currentStep.deltay == 0
							) break;
						}
						if(m >= numBadGuys){
							rightspot = x + n;
						}
						break;
				}
			}
		}
	}

	if(rightspot != -1){
		if(leftspot != -1){
			var leftDelta = Math.abs(x - leftspot) + Math.abs(player.x - leftspot);
			var rightDelta = Math.abs(x - rightspot) + Math.abs(player.x - rightspot);
			if(leftDelta < rightDelta){
				rval = leftspot;
			}else if(leftDelta > rightDelta){
				rval = rightspot;
			}else if(x % 2){
				rval = leftspot;
			}else{
				rval = rightspot;
			}
		}else{
			rval = rightspot;
		}

	}else if(leftspot != -1){
		rval = leftspot;
	}
	return rval;
}

function draw_hidden_ladders(){
	var x, y;
	for(y = 0; y < mapHeight; y++){
		for(x = 0; x < mapWidth; x++){
			if(map[x][y] == characterMap['hiddenladder']){
				map[x][y] = characterMap['ladder'];
				if(spriteMap[x][y] == null){
					spriteMap[x][y] = new spriteClass(sprites);
					spriteMap[x][y].setFrame('ladder');
					spriteMap[x][y].position(x * sprites.frameWidth, y * sprites.frameHeight);
					spriteMap[x][y].draw($('#gameCanvas'));
				}else{
					spriteMap[x][y].setFrame('ladder');
				}
			}
		}
	}

}

function handle_playkey(code){
	switch(code){
		case KEYMAP[controls['DIG LEFT']]:
			digLeft = true;
			digRight = false;
			break;
		case KEYMAP[controls['DIG RIGHT']]:
			digRight = true;
			digLeft = false;
			break;
		case KEYMAP[controls['SKIP LEVEL']]:
			endLevel();
			break;
		case KEYMAP[controls['DIE']]:
			killPlayer();
			break;
		case KEYMAP[controls['QUIT']]:
			endGame();
			break;
	}
}

function doAnimation(){
	var n, m, slipping = false, digging = false;
	animCycle = (animCycle + 1) % animCycleRange;

	if(keyState[KEYMAP[controls['SKIP LEVEL']]]){
		endLevel();
	}

	if(!(animCycle % 2)){
		if(player.digging){

		}else if(!player.stepping()){
			// see if we're done the level
			if(player.y < 0 && numGolds < 1){
				endLevel();
				return;
			}

			// are we dead?
			switch(characterMap[map[player.x][player.y]]){
				case 'water': case 'deepwater': case 'fire':
					killPlayer();
					return;
				case 'floorspike':
					if({'floorspike_1':0, 'floorspike_2': 0, 'floorspike_3':0}[spriteMap[player.x][player.y].currentFrame] == undefined){
						killPlayer();
					}
					break;
				case 'ceilingspike':
					if({'ceilingspike_1':0, 'ceilingspike_2': 0, 'ceilingspike_3':0}[spriteMap[player.x][player.y].currentFrame] == undefined){
						killPlayer();
					}
					break;
				case 'blades':
					if({'blades_5':0, 'blades_6':0}[spriteMap[player.x][player.y].currentFrame] == undefined){
						killPlayer();
					}
				case 'righthinge':
					if({'righthinge_1':0, 'righthinge_2':0}[spriteMap[player.x][player.y].currentFrame] != undefined){
						killPlayer();
					}
					break;
				case 'lefthinge':
					if({'lefthinge_1':0, 'lefthinge_2':0}[spriteMap[player.x][player.y].currentFrame] != undefined){
						killPlayer();
					}
					break;

			}

			// let's see if we're slipping on ice
			if(player.y < mapHeight - 1 && player.currentStep.directionx == 1){
				if(map[player.x][player.y + 1] == characterMap['ice']){
					var stoppables = {'ladder':1, 'bar':1, 'elevator_up':1, 'elevator_down':1};
					if(stoppables[characterMap[map[player.x][player.y]]] == undefined){
						if(allowRightwardMotion(player)){
							player.currentStep.deltax = cellWidth;
						}
						slipping = true;
						digleft = digright = false;
					}
				}
			}
			else if(player.y < mapHeight - 1 && player.currentStep.directionx == -1){
				if(map[player.x][player.y + 1] == characterMap['ice']){
					var stoppables = {'ladder':1, 'bar':1, 'elevator_up':1, 'elevator_down':1};
					if(stoppables[characterMap[map[player.x][player.y]]] == undefined){
						if(allowLeftwardMotion(player)){
							player.currentStep.deltax = -cellWidth;
						}
						slipping = true;
						digleft = digright = false;
					}
				}
			}

			// find out if we're picking up gold
			for(n = 0; n < numGolds; n++){
				if(gold[n].x == player.x && gold[n].y == player.y){
					gold[n].sprite.remove();
					numGolds --;
					for(m = n; m < numGolds; m++){
						gold[m] = gold[m + 1];
					}
					gold[m] = undefined;
					n--;
				}
			}
			if(numGolds == 0){
				draw_hidden_ladders();
			}


			// find out if we're picking up a heart
			for(n = 0; n < numHearts; n++){
				if(heart[n].x == player.x && heart[n].y == player.y){
					heart[n].sprite.remove();
					map[heart[n].x][heart[n].y] = characterMap['empty'];
					numHearts --;
					for(m = n; m < numHearts; m++){
						heart[m] = heart[m + 1];
					}
					heart[m] = undefined;
					n--;
					addLife();
				}
			}
			// are we teleporting?
			if(map[player.x][player.y] == characterMap['teleporter'] ){
				if(player.teleported != true){
					player.teleported = true;
					newPos = getNextTeleporter(player.x, player.y);
					player.setPos(newPos.x, newPos.y);
				}
				
			}else{
				player.teleported = false;
			}

			// let the player dig on either side
			if(digLeft){
				digLeft = false;
				var dx = player.x - 1;
				var dy = player.y + 1;
				if(canBeDug(dx, dy)){
					player.digging = true;
					switch(characterMap[map[dx][dy]]){
						case 'brick':
							spriteMap[dx][dy].startSequence('dissolvebrick', {'callback': function(){ player.digging = false;}});
							brickManager.add(dx, dy);
							break;
						case 'ice':
							spriteMap[dx][dy].startSequence('meltice', {'callback': function(){
								player.digging = false;
								finish_ice_melt(dx, dy);
							}});
							break;
					}
					digging = true;
				}
			}else if(digRight){
				digRight = false;
				var dx = player.x + 1;
				var dy = player.y + 1;
				if(canBeDug(dx, dy)){
					player.digging = true;
					switch(characterMap[map[dx][dy]]){
						case 'brick':
							spriteMap[dx][dy].startSequence('dissolvebrick', {'callback': function(){ player.digging = false;}});
							brickManager.add(dx, dy);
							break;
						case 'ice':
							spriteMap[dx][dy].startSequence('meltice', {'callback': function(){
								player.digging = false;
								finish_ice_melt(dx, dy);
							}});
							break;
					}
					digging = true;
				}
			}

			if(!digging && !slipping){
				// determine their direction of movement if any
				var direction;
				var falling = shouldFall(player.x, player.y);
				if(falling){
					direction = {'x':0, 'y':1};
				}else{
					direction = getForcedDirection(player.x, player.y);
				}

				if(direction.x == 0 && direction.y == 0){
					// nothing imposed.  Let's see if they're voluntarily moving
					
					if(keyState[KEYMAP[controls['UP']]] && allowUpwardMotion(player)){
						direction = {'x':0, 'y':-1};
					}else if(keyState[KEYMAP[controls['DOWN']]] && allowDownwardMotion(player)){
						direction = {'x':0, 'y':1};
					}else if(keyState[KEYMAP[controls['LEFT']]] && allowLeftwardMotion(player)){
						direction = {'x':-1, 'y':0};
					}else if(keyState[KEYMAP[controls['RIGHT']]] && allowRightwardMotion(player)){
						direction = {'x':1, 'y':0};
					}
				}

				if(direction.x || direction.y){
					player.currentStep.deltax = direction.x * cellWidth;
					player.currentStep.deltay = direction.y * cellHeight;
					player.currentStep.directionx = direction.x;
					player.currentStep.directiony = direction.y;
				}
			}

			// work out what animation the sprite should be doing
			var spriteName = null;
			if(slipping || digging){
				player.sprite.stopSequence();
				player.sprite.setFrame('player_9');
			}else{
				if(direction.x < 0){
					if(characterMap[map[player.x][player.y]] == 'bar'){
						spriteName = 'playerhangleft';
					}else{
						spriteName = 'playerwalkleft';
					}
				}else if(direction.x > 0){
					if(characterMap[map[player.x][player.y]] == 'bar'){
						spriteName = 'playerhangright';
					}else{
						spriteName = 'playerwalkright';
					}
				}else if(direction.y != 0 && characterMap[map[player.x][player.y]] == 'ladder'){
					spriteName = 'playerclimb';
				}else if(falling){
					player.sprite.stopSequence();
					player.sprite.setFrame('player_5');
				}else{
					player.sprite.stopSequence();
					player.sprite.setFrame('player_9');
				}
			}
			if(spriteName != null){
				player.sprite.startSequence(
					spriteName,
					{
						'iterations' : 0,
						'method' : 'manual',
						'startframe' : player.sprite.currentSequence.currentFrame
					}
				);
			}
		}
		brickManager.cycle();
		if(player.stepping()){
			player.doStep();
			player.sprite.doSequenceStep();
		}
	}
	if(!(animCycle % 3)){
		for(n = 0; n < numAnimCells; n++){
			animCells[n].doSequenceStep();
		}

		for(n = 0; n < numHearts; n++){
			heart[n].sprite.doSequenceStep();
		}

		for(n = 0; n < numBadGuys; n++){
			if(!badGuys[n].stepping()){
				badGuys[n].seek();
			}
			if(badGuys[n].stepping()){
				badGuys[n].doStep();
				badGuys[n].sprite.doSequenceStep();
			}
			if(Math.abs(badGuys[n].drawx - player.drawx) < cellWidth && Math.abs(badGuys[n].drawy - player.drawy) < cellHeight){
				killPlayer();
			}

			// are we teleporting?
			if(map[badGuys[n].x][badGuys[n].y] == characterMap['teleporter'] ){
				if(badGuys[n].teleported != true){
					badGuys[n].teleported = true;
					newPos = getNextTeleporter(badGuys[n].x, badGuys[n].y);
					badGuys[n].setPos(newPos.x, newPos.y);
				}
				
			}else{
				badGuys[n].teleported = false;
			}

			switch(characterMap[map[badGuys[n].x][badGuys[n].y]]){
				case 'water': case 'deepwater': case 'fire':
					killBadGuy(n);
					break;
				case 'floorspike':
					if({'floorspike_1':0, 'floorspike_2': 0, 'floorspike_3':0}[spriteMap[badGuys[n].x][badGuys[n].y].currentFrame] == undefined){
						killBadGuy(n);
					}
					break;
				case 'ceilingspike':
					if({'ceilingspike_1':0, 'ceilingspike_2': 0, 'ceilingspike_3':0}[spriteMap[badGuys[n].x][badGuys[n].y].currentFrame] == undefined){
						killBadGuy(n);
					}
					break;
				case 'blades':
					if({'blades_5':0, 'blades_6':0}[spriteMap[badGuys[n].x][badGuys[n].y].currentFrame] == undefined){
						killBadGuy(n);
					}
					break;
				case 'righthinge':
					if({'righthinge_1':0, 'righthinge_2':0}[spriteMap[badGuys[n].x][badGuys[n].y].currentFrame] != undefined){
						killBadGuy(n);
					}
					break;
				case 'lefthinge':
					if({'lefthinge_1':0, 'lefthinge_2':0}[spriteMap[badGuys[n].x][badGuys[n].y].currentFrame] != undefined){
						killBadGuy(n);
					}
					break;
			}

		}
	}

}

function getNextTeleporter(x, y){
	var n;
	var rval = {'x' : x, 'y' : y};
	for(n = 0; n < numTeleporters; n++){
		if(teleporters[n].x == x && teleporters[n].y == y){
			break;
		}
	}
	if(n < numTeleporters){
		n = (n + 1) % numTeleporters;
		rval = teleporters[n];
	}
	return rval;
}

function killBadGuy(index){
	var newPos = findPointOfReincarnation(badGuys[index].x, badGuys[index].y);
	badGuys[index].die();
	badGuys[index].setPos(newPos.x, newPos.y);
}

function getForcedDirection(x, y){
	var rval = {x : 0, y : 0};
	switch(characterMap[map[x][y]]){
		case 'elevator_up':
			if(allowUpwardMotion({'x':x, 'y':y})){
				rval.y = -1;
			}
			break;
		case 'elevator_down':
			if(allowDownwardMotion({'x':x, 'y':y})){
				rval.y = 1;
			}
			break;
	}
	return rval;
}

function canBeDug(x, y){
	var rval = true;
	var n;
	if(!(x >= 0 && x < mapWidth && y > 0 && y < mapWidth)) return false;

	rval &= (characterMap[map[x][y]] == 'brick' || characterMap[map[x][y]] == 'ice');
	rval &= map[x][y - 1] == characterMap['empty']
	 	|| map[x][y - 1] == characterMap['hiddenladder']
	 	|| map[x][y - 1] == characterMap['bar']
		|| map[x][y - 1] == characterMap['ceilingspike'];
	/* should we allow digging under existing gold?
	if(rval){
		for(n = 0; n < numGolds; n++){
			rval &= gold[n].x != x || gold[n].y != y - 1;
		}
	}
	*/
	return rval;
}

function endLevel(){
	clearInterval(animationCycle);
	currentLevel++;
	loadLevel(currentLevel);
}

function killat(x, y){
	for(n = 0; n < numBadGuys; n++){
		if(badGuys[n].x == x && badGuys[n].y == y){
			killBadGuy(n);
		}
	}
	if(player.x == x && player.y == y){
		killPlayer();
	}
}

function killPlayer(){
	$('#gameCanvas').empty();
	clearInterval(animationCycle);
	player.die();
	if(numLives == 'UNLIMITED'){
		start_level();
	}else{
		numLives--;
		drawLives();
		if(numLives > 0){
			start_level();
		}else{
			$('#landingPage').css('display', 'block');
			gameState = 'menu';
		}
	}
}

function endGame(){
	$('#gameCanvas').empty();
	clearInterval(animationCycle);
	$('#landingPage').css('display', 'block');
	gameState = 'menu';
}

function addLife(){
	if(numLives != 'UNLIMITED'){
		if(numLives < 20){
			numLives++;
			drawLives();
		}
	}
}


function findPointOfReincarnation(x){
	var n, m, y = 0, gotIt = false;
	var rval = {'x':0, 'y':0};
	for(m = 0; m < mapHeight && !gotIt; m++){
		for(n = 0; n < mapWidth && !gotIt; n++){
			if(x + n < mapWidth && canBeEntered(x + n, y)){
				rval.x = x + n;
				rval.y = y;
				gotIt = true;
			}else if(n != 0 && x - n > 0 && canBeEntered(x - n, y)){
				rval.x = x - n;
				rval.y = y;
				gotIt = true;
			}
		}
		y++;
	}
	return rval;
}

function canBeEntered(x, y){
	var rval = false;
	switch(characterMap[map[x][y]]){
		case 'brick': case 'steel': rval = false; case 'ice': break;
		default: rval = true;
	}

	if(rval){
		var n;
		for(n = 0; n < numBadGuys; n++){
			if(badGuys[n].x == x && badGuys[n].y == y){
				rval = false;
				break;
			}
		}
	}
	return rval;
}

function finish_ice_melt(x, y){
	var n, numWaterFrames = 11;
	// should we melt into water, or just disappear?
	if(shouldMeltToWater(x, y)){
		// work out what animation frame this water cell should be set to
		/*
		var testx;
		for(testx = 0; testx < mapWidth && map[testx][y] != characterMap['water']; testx++);
		if(testx < mapWidth){
			startingFrame = spriteMap[testx][y].currentSequence.currentFrame;
			startingFrame += mapWidth + x - testx;
			startingFrame %= numWaterFrames;
		}else{
			startingFrame = 0;
		}
		*/

		// surely this can be done more elegantly...
		startingFrame = (Math.floor(animCycle / 3) + x) % numWaterFrames;

		map[x][y] = characterMap['water'];
		spriteMap[x][y].startSequence(
			'waterwave',
			{
				'iterations' : 0,
				'startframe' : startingFrame,
				'method' : 'manual'
			}
		);
		for(n = 0; n < numAnimCells && animCells[n] != spriteMap[x][y]; n++);
		if(n >= numAnimCells){
			animCells[numAnimCells] = spriteMap[x][y];
			numAnimCells++;
		}
	}else{
		spriteMap[x][y].setFrame('blank');
		map[x][y] = characterMap['empty'];
	}
}

function shouldMeltToWater(x, y){
	rval = true;
	if(y < mapHeight - 1) rval &= canHoldWater(x, y + 1);
	if(rval && x > 0) rval &= canHoldWater(x - 1, y);
	if(rval && x < mapWidth - 1) rval &= canHoldWater(x + 1, y);
	return rval;
}

function canHoldWater(x, y){
	return {
		'empty': 0, 'ladder': 0, 'hidderladder': 0, 'bar': 0, 'fire': 0, 
		'elevator_up': 0, 'elevator_down': 0, 'floorspike': 0, 'ceilingspike': 0, 
		'blades': 0, 'teleporter': 0, 'righthinge': 0, 'lefthinge': 0
	}[characterMap[map[x][y]]] != undefined;
}

function shouldFall(x, y){
	if(y >= mapHeight - 1) return false;
	if(characterMap[map[x][y]] == 'ladder') return false;
	if(characterMap[map[x][y]] == 'bar') return false;
	switch(characterMap[map[x][y + 1]]){
		case 'empty': case 'hiddenladder': case 'water': case 'bar': case 'deepwater': case 'fire': case 'floorspike': case 'ceilingspike': case 'teleporter':
			break;
		case 'blades':
			if({'blades_4': 0, 'blades_5':0, 'blades_6':0}[spriteMap[x][y + 1].currentFrame] != undefined){
				break;
			}
			return false;
		case 'righthinge':
			if({'righthinge_1':0, 'righthinge_2':0}[spriteMap[x][y + 1].currentFrame] == undefined){
				break;
			}
			return false;
		case 'lefthinge':
			if({'lefthinge_1':0, 'lefthinge_2':0}[spriteMap[x][y + 1].currentFrame] == undefined){
				break;
			}
			return false;
		default:
			return false;
	}
	for(n = 0; n < numBadGuys; n++){
		if(badGuys[n].x == x && badGuys[n].y == y + 1){
			break;
		}
	}
	if(n < numBadGuys) return false;
	return true;
}

function allowUpwardMotion(character){
	var x = character.x, y = character.y;
	var rval = false;
	if(y <= 0 && numGolds > 0) return rval;
	if(y < 0) return rval;
	switch(characterMap[map[x][y]]){
		case 'ladder': case 'elevator_up':
			rval = true;
			break;
	}

	if(rval){
		switch(characterMap[map[x][y - 1]]){
			case 'steel': case 'brick': case 'elevator_down': case 'ice':
				rval = false;
				break;
			case 'blades':
				if({'blades_1': 0, 'blades_2':0, 'blades_3':0}[spriteMap[x][y - 1].currentFrame] != undefined){
					rval = false;
				}
				break;
			case 'righthinge':
				if({'righthinge_5': 0}[spriteMap[x][y - 1].currentFrame] == undefined){
					rval = false;
				}
				break;
			case 'lefthinge':
				if({'lefthinge_5': 0}[spriteMap[x][y - 1].currentFrame] == undefined){
					rval = false;
				}
				break;
		}
	}

	if(rval && character != player){
		for(n = 0; n < numBadGuys; n++){
			if(badGuys[n] != character && badGuys[n].x == x){
				if(badGuys[n].y == y - 1 || badGuys[n].y + badGuys[n].currentStep.directiony == y - 1){
					rval = false;
					break;
				}
			}
		}
	}
	return rval;
}

function allowDownwardMotion(character){
	var x = character.x, y = character.y;
	var rval = false;
	if(y >= mapHeight - 1) return rval;
	switch(characterMap[map[x][y]]){
		case 'empty': case 'ladder': case 'hiddenladder': case 'bar': case 'water': case 'deepwater': case 'fire': case 'elevator_down': case 'floorspike': case 'ceilingspike': case 'blades': case 'teleporter': case 'righthinge': case 'lefthinge':
			rval = true;
			break;
	}
	if(rval){
		switch(characterMap[map[x][y + 1]]){
			case 'steel': case 'brick': case 'elevator_up': case 'ice':
				rval = false;
				break;
			case 'blades':
				if({'blades_1': 0, 'blades_2':0, 'blades_3':0}[spriteMap[x][y + 1].currentFrame] != undefined){
					rval = false;
				}
				break;
			case 'righthinge':
				if({'righthinge_1': 0, 'righthinge_2' : 0}[spriteMap[x][y + 1].currentFrame] != undefined){
					rval = false;
				}
				break;
			case 'lefthinge':
				if({'lefthinge_1': 0, 'lefthinge_2' : 0}[spriteMap[x][y + 1].currentFrame] != undefined){
					rval = false;
				}
				break;
		}
	}

	if(rval && character != player){
		for(n = 0; n < numBadGuys; n++){
			if(badGuys[n] != character && badGuys[n].x == x){
				if(badGuys[n].y == y + 1 || badGuys[n].y + badGuys[n].currentStep.directiony == y + 1){
					rval = false;
					break;
				}
			}
		}
	}
	return rval;
}

function allowLeftwardMotion(character){
	var x = character.x, y = character.y;
	var rval = false;
	if(x <= 0) return rval;
	switch(characterMap[map[x - 1][y]]){
		case 'empty': case 'ladder': case 'hiddenladder': case 'bar': case 'water': case 'deepwater': case 'fire': case 'elevator_up': case 'elevator_down': case 'teleporter':
			rval = true;
			break;
		case 'floorspike':
			if({'floorspike_1':0, 'floorspike_2': 0, 'floorspike_3':0}[spriteMap[x - 1][y].currentFrame] != undefined){
				rval = true;
			}
			break;
		case 'ceilingspike':
			if({'ceilingspike_1':0, 'ceilingspike_2': 0, 'ceilingspike_3':0}[spriteMap[x - 1][y].currentFrame] != undefined){
				rval = true;
			}
			break;
		case 'blades':
			if({'blades_1': 0, 'blades_2':0, 'blades_3':0}[spriteMap[x - 1][y].currentFrame] == undefined){
				rval = true;
			}
			break;
		case 'lefthinge':
			if({'lefthinge_5':0, 'lefthinge_4':0}[spriteMap[x - 1][y].currentFrame] != undefined){
				rval = true;
			}
			break;
	}
	rval &= (characterMap[map[x][y]] != 'lefthinge');

	// if it's a bad guy, make sure he's not trying to pass through other bad guys
	if(rval && character != player){
		for(n = 0; n < numBadGuys; n++){
			if(badGuys[n] != character && badGuys[n].y == y){
				if(badGuys[n].x == x - 1 || badGuys[n].x + badGuys[n].currentStep.directionx == x - 1){
					rval = false;
					break;
				}
			}
		}
	}
	return rval;
}

function allowRightwardMotion(character){
	var x = character.x, y = character.y;
	var rval = false;
	if(x >= mapWidth - 1) return rval;
	switch(characterMap[map[x + 1][y]]){
		case 'empty': case 'ladder': case 'hiddenladder': case 'bar': case 'water': case 'deepwater': case 'fire': case 'elevator_up': case 'elevator_down': case 'teleporter':
			rval = true;
			break;
		case 'floorspike':
			if({'floorspike_1':0, 'floorspike_2': 0, 'floorspike_3':0}[spriteMap[x + 1][y].currentFrame] != undefined){
				rval = true;
			}
			break;
		case 'ceilingspike':
			if({'ceilingspike_1':0, 'ceilingspike_2': 0, 'ceilingspike_3':0}[spriteMap[x + 1][y].currentFrame] != undefined){
				rval = true;
			}
			break;
		case 'blades':
			if({'blades_1': 0, 'blades_2':0, 'blades_3':0}[spriteMap[x + 1][y].currentFrame] == undefined){
				rval = true;
			}
			break;
		case 'righthinge':
			if({'righthinge_5':0, 'righthinge_4':0}[spriteMap[x + 1][y].currentFrame] != undefined){
				rval = true;
			}
			break;
			
	}
	rval &= (characterMap[map[x][y]] != 'righthinge');

	// if it's a bad guy, make sure he's not trying to pass through other bad guys
	if(rval && character != player){
		for(n = 0; n < numBadGuys; n++){
			if(badGuys[n] != character && badGuys[n].y == y){
				if(badGuys[n].x == x + 1 || badGuys[n].x + badGuys[n].currentStep.directionx == x + 1){
					rval = false;
					break;
				}
			}
		}
	}
	return rval;
}

function startGame(startingLevel){
	if(startingLevel == undefined) startingLevel = 0;
	gameState = 'initializing';
	sprites = new spriteSet();
	sprites.load('goldRun.sprite', function(){
		player = new playerClass();
		numLives = startingLives;
		drawLives();
		loadLevel(startingLevel);
	});
}

function drawLives(){
	var n, lifeSprite;
	$('#lives').html('LIVES:');
	lifeSprite = new spriteClass(sprites);
	if(numLives == 'UNLIMITED'){
		var img = $('<img src="infinity.gif">');
		var imgWrap = $('<div></div>');
		imgWrap.append(img);
		imgWrap.css({'position':'absolute', 'top':'2px', 'display':'inline-block'});
		$('#lives').append(imgWrap);
	}else{
		for(n = 0; n < numLives; n++){
			lifeSprite.drawFrame($('#lives'), 'player_1');	
		}
	}
}

function loadLevel(levelNum){
	currentLevel = levelNum;
	gameState = 'loading';
	$('#gameCanvas').empty();
	$.post('index.php?action=load', {'level':levelNum}, function(result){
		eval('leveldat = ' + result);
		$('#level').html("LEVEL: " + (levelNum + 1));
		start_level(true);
	});
}

function start_level(firstLoad){
	if(firstLoad == undefined) firstLoad = false;
	var dat, n, m, x, y;
	// initialize the map
	for(x = 0; x < mapWidth; x++){
		map[x] = [];
		spriteMap[x] = [];
		for(y = 0; y < mapHeight; y++){
			map[x][y] = characterMap['empty'];
			spriteMap[x][y] = null;
		}
	}
	var parts = leveldat.split(',');
	x = y = 0;
	brickManager = new brickManagerClass();
	numGolds = 0; gold = [];
	if(firstLoad){
		numHearts = 0; heart = [];
	}
	numBadGuys = 0; badGuys = [];
	numAnimCells = 0; animCells = [];
	numTeleporters = 0; teleporters = [];
	for(n in parts){
		dat = parts[n].split(':');
		for(m = 0; m < dat[1]; m++){
			var sequenceName;
			map[x][y] = 1 * dat[0];
			switch(map[x][y]){
				case characterMap['empty']:
				case characterMap['hiddenladder']:
					break;
				case characterMap['goodguy']:
					map[x][y] = characterMap['empty'];
					player.setPos(x, y);
					break;
				case characterMap['badguy']:
					map[x][y] = characterMap['empty'];
					badGuys[numBadGuys] = new playerClass('badguy');
					badGuys[numBadGuys].setPos(x, y);
					numBadGuys++;
					break;
				case characterMap['gold']:
					map[x][y] = characterMap['empty'];
					gold[numGolds] = {'x' : x, 'y' : y, 'sprite': new spriteClass(sprites)};
					gold[numGolds].sprite.setFrame('gold');
					gold[numGolds].sprite.position(x * sprites.frameWidth, y * sprites.frameHeight);
					numGolds++;
					break;
				case characterMap['heart']:
					map[x][y] = characterMap['empty'];
					if(firstLoad){
						heart[numHearts] = {'x' : x, 'y' : y, 'sprite': new spriteClass(sprites)};
						heart[numHearts].sprite.setFrame('heart_1');
						heart[numHearts].sprite.position(x * sprites.frameWidth, y * sprites.frameHeight);
						numHearts++;
					}
					break;
				case characterMap['water']:
					if(spriteMap[x][y] == null){
						spriteMap[x][y] = new spriteClass(sprites);
						spriteMap[x][y].setFrame('water1');
						spriteMap[x][y].position(x * sprites.frameWidth, y * sprites.frameHeight);
						spriteMap[x][y].draw($('#gameCanvas'));
					}
					spriteMap[x][y].startSequence(
						'waterwave',
						{
							'iterations' : 0,
							'startframe' : x % 11,
							'method' : 'manual'
						}
					);
					animCells[numAnimCells] = spriteMap[x][y];
					animCells[numAnimCells].doSequenceStep();
					numAnimCells++;
					break;
				case characterMap['fire']:
					if(spriteMap[x][y] == null){
						spriteMap[x][y] = new spriteClass(sprites);
						spriteMap[x][y].setFrame('fire1');
						spriteMap[x][y].position(x * sprites.frameWidth, y * sprites.frameHeight);
						spriteMap[x][y].draw($('#gameCanvas'));
					}
					if(x % 2) sequenceName = 'firewave1';
					else sequenceName = 'firewave2';
					spriteMap[x][y].startSequence(
						sequenceName,
						{
							'iterations' : 0,
							'startframe' : x % 7,
							'method' : 'manual'
						}
					);
					animCells[numAnimCells] = spriteMap[x][y];
					animCells[numAnimCells].doSequenceStep();
					numAnimCells++;
					break;
				case characterMap['elevator_up']:
				case characterMap['elevator_down']:
				case characterMap['ceilingspike']:
				case characterMap['floorspike']:
				case characterMap['blades']:
				case characterMap['lefthinge']:
				case characterMap['righthinge']:
					if(spriteMap[x][y] == null){
						spriteMap[x][y] = new spriteClass(sprites);
						spriteMap[x][y].setFrame(characterMap[map[x][y]] + '_1');
						spriteMap[x][y].position(x * sprites.frameWidth, y * sprites.frameHeight);
						spriteMap[x][y].draw($('#gameCanvas'));
					}
					spriteMap[x][y].startSequence(
						characterMap[map[x][y]],
						{
							'iterations' : 0,
							'method' : 'manual'
						}
					);
					animCells[numAnimCells] = spriteMap[x][y];
					numAnimCells++;

					break;
				case characterMap['ice']:
					if(spriteMap[x][y] == null){
						spriteMap[x][y] = new spriteClass(sprites);
						spriteMap[x][y].position(x * sprites.frameWidth, y * sprites.frameHeight);
						spriteMap[x][y].draw($('#gameCanvas'));
					}
					spriteMap[x][y].setFrame(characterMap[map[x][y]] + '_1');
					break;
				case characterMap['teleporter']:
					if(spriteMap[x][y] == null){
						spriteMap[x][y] = new spriteClass(sprites);
						spriteMap[x][y].setFrame(characterMap[map[x][y]] + '_1');
						spriteMap[x][y].position(x * sprites.frameWidth, y * sprites.frameHeight);
						spriteMap[x][y].draw($('#gameCanvas'));
					}
					spriteMap[x][y].startSequence('teleporter', {'iterations' : 0, 'method' : 'manual'});
					animCells[numAnimCells] = spriteMap[x][y];
					numAnimCells++;

					teleporters[numTeleporters] = {'x' : x, 'y' : y};
					numTeleporters++;
					break;
				default:
					if(spriteMap[x][y] == null){
						spriteMap[x][y] = new spriteClass(sprites);
						spriteMap[x][y].setFrame(characterMap[dat[0]]);
						spriteMap[x][y].position(x * sprites.frameWidth, y * sprites.frameHeight);
						spriteMap[x][y].draw($('#gameCanvas'));
					}else{
						spriteMap[x][y].setFrame(characterMap[dat[0]]);
					}
			}

			x++;
			if(x >= mapWidth){
				x = 0;
				y++;
			}
		}
	}

	// draw the characters last, as we want them at the top layer
	for(n = 0; n < numGolds; n++){
		gold[n].sprite.draw($('#gameCanvas'));
	}
	for(n = 0; n < numHearts; n++){
		heart[n].sprite.draw($('#gameCanvas'));
		heart[n].sprite.startSequence('heart', {'iterations' : 0, 'method' : 'manual'});
	}
	for(n = 0; n < numBadGuys; n++){
		badGuys[n].sprite.appendTo($('#gameCanvas'));
		badGuys[n].sprite.startSequence('badguywalkright', {'iterations' : 0, 'method' : 'manual'});
	}
	player.sprite.appendTo($('#gameCanvas'));
	player.sprite.startSequence('playerblink', {'iterations' : 0});
//	startPlay();
	gameState = 'ready';
}

function startPlay(){
	animCycle = 0;
	digLeft = digRight = false;
	animationCycle = setInterval(function(){doAnimation()}, ANIMATION_FREQUENCY);
	gameState = 'playing';
}
