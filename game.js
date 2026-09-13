'use strict';

// ---- module-level constants ----
var gameScale = 5;
var cellSize = 12;

// Old model: walkSpeed = 3, meaning 3 pixels per 70ms setInterval tick.
// New model: pixels per second.  Tuned empirically.
var walkSpeed = 44;

// How many water animation steps happen per second of wall-clock time.
var waterCycleRate = 14;

// --- combat timing ---
var ATTACK_DURATION = 0.4;    // seconds, matches the 4-frame attack sequences at 100ms/frame
var ATTACK_HIT_TIME = 0.15;   // seconds into the attack when damage is applied
var ATTACK_COOLDOWN = 0.3;    // seconds after an attack before another can start
var ATTACK_HIT_ARC  = Math.PI / 4;   // ±45° cone in front of the attacker

// Octant-indexed attack sequence names.  Note the sprite files use
// 'front'/'back' for the cardinal up/down (as seen from the viewer) and
// 'up_left'/'down_right' etc. for the diagonals, which don't match the
// walking sequence naming.
var ATTACK_SEQUENCES = [
	'attackup',        // 0 up
	'attackupright',   // 1 upright
	'attackright',     // 2 right
	'attackdownright', // 3 downright
	'attackdown',      // 4 down
	'attackdownleft',  // 5 downleft
	'attackleft',      // 6 left
	'attackupleft'     // 7 upleft
];

// ============================================================================
// characterClass
// ============================================================================

// Octant-indexed walk sequence names, matching the frameIndex computed in
// Character.act().  Index 0 is up, 2 is right, 4 is down, 6 is left, etc.
var WALK_SEQUENCES = [
	['walkup',        'back_idle'],
	['walkupright',   'back_right_idle'],
	['walkright',     'right_idle'],
	['walkdownright', 'front_right_idle'],
	['walkdown',      'front_idle'],
	['walkdownleft',  'front_left_idle'],
	['walkleft',      'left_idle'],
	['walkupleft',    'back_left_idle']
];

// Half-width of a cardinal octant, in degrees.  22.5° would make all eight
// octants exactly 45° wide (the standard split).  Larger values make
// cardinals wider and diagonals narrower, and vice versa.  Default 25° gives
// 50° cardinals and 40° diagonals, which is close to what you described.
var WALK_CARDINAL_HALF_WIDTH_DEG = 20;

// Determine which of the eight walk-direction octants the vector (dx, dy)
// points into, using WALK_CARDINAL_HALF_WIDTH_DEG as the boundary from each
// cardinal axis.  Returns an integer 0..7 matching WALK_SEQUENCES.
function computeWalkOctant(dx, dy){
	if(dx == 0 && dy == 0) return null;

	// rel_ang returns: 0 = up, π/2 = right, π = down, 3π/2 = left.
	var alpha = rel_ang(0, 0, dx, dy);

	// Map alpha into [0, 8); integers 0..7 sit at the eight compass points.
	var f = (4 * alpha / Math.PI) % 8;
	if(f < 0) f += 8;

	var halfWidth = WALK_CARDINAL_HALF_WIDTH_DEG / 45;  // as a fraction of 45°
	var nearest = Math.round(f);
	var dist = Math.abs(f - nearest);
	var isCardinal = (nearest % 2 == 0);
	var limit = isCardinal ? halfWidth : (1 - halfWidth);

	if(dist < limit){
		return ((nearest % 8) + 8) % 8;
	}

	// Crossed the boundary; step into the adjacent octant in the direction
	// the angle is heading.
	var direction = (f > nearest) ? 1 : -1;
	return (((nearest + direction) % 8) + 8) % 8;
}

// ============================================================================
// Entity hierarchy
// ============================================================================

// Base class for anything that has a position on the map, a sprite, and the
// ability to walk around.  Subclasses (Player, Enemy, NPC) implement their own
// findTarget() to decide where to go; everything else is shared.
class Entity {
	constructor(game, options){
		options = options || {};

		this.game = game;
		this.category = options.category || 'entity';

		this.position = {x : 0, y : 0};
		this.mapPos = {x : 0, y : 0};
		this.sprite = null;

		this.currentSequence = null;
		this.currentEndFrame = null;

		this.skills = {
			speed  : options.speed  != undefined ? options.speed  : walkSpeed,
			vision : options.vision != undefined ? options.vision : 6
		};

		this.target = null;
		this.walkPath = [];
		this.possessions = [];
		this.moveBudget = 0;
		this.walkOctant = null;

		this.motionData = {
			xTally : 0,
			yTally : 0,
			lastDirX : 0,
			lastDirY : 0,
			hasDir : false
		};

		// --- combat / life state ---
		this.maxHealth    = options.health      != undefined ? options.health      : 10;
		this.health       = this.maxHealth;
		this.isAlive      = true;
		this.attackPower  = options.attackPower != undefined ? options.attackPower : 5;
		this.attackRange  = options.attackRange != undefined ? options.attackRange : 18;

		// Last octant the entity faced, updated by updateWalkOctant and by
		// explicit attack facing.  Never null after the first update — we
		// default to down so sprites have something to restore to.
		this.facing = 4;

		// Combat timers.  attackTimer > 0 means an attack is playing out;
		// attackCooldown > 0 blocks the next attack.
		this.attackTimer      = 0;
		this.attackCooldown   = 0;
		this.attackHitApplied = false;
	}

	setMapPos(x, y){
		this.mapPos.x = x;
		this.mapPos.y = y;
		this.position.x = cellSize * x;
		this.position.y = cellSize * y;
	}

	canWalkOn(posx, posy){
		var roundX = Math.floor(posx / cellSize);
		var roundY = Math.floor(posy / cellSize);
		var map = this.game.activeMap.map;
		if(roundX < 0 || roundY < 0 || roundX >= map.length || roundY >= map[roundX].length){
			return false;
		}
		return {'#' : 1, 'W' : 1}[map[roundX][roundY]] == undefined;
	}

	currentMapVal(){
		var map = this.game.activeMap.map;
		var pos = this.mapPos;
		if(pos.x < 0 || pos.y < 0 || pos.x >= map.length || pos.y >= map[pos.x].length){
			return null;
		}
		return map[pos.x][pos.y];
	}

	touchingItems(){
		var x = this.mapPos.x;
		var y = this.mapPos.y;
		var mapped = this.game.activeMap.mappedItems;
		if(mapped[x] == undefined || mapped[x][y] == undefined) return [];
		return mapped[x][y].slice();
	}

	moveTowardsTarget(pixelsBudget){
		if(this.target == null) return;

		var dx = this.target.x - this.position.x;
		var dy = this.target.y - this.position.y;
		var sgndx = Math.sign(dx);
		var absdx = Math.abs(dx);
		var sgndy = Math.sign(dy);
		var absdy = Math.abs(dy);
		var i;

		var md = this.motionData;

		if(!md.hasDir || sgndx !== md.lastDirX || sgndy !== md.lastDirY){
			md.xTally = absdx >> 1;
			md.yTally = absdy >> 1;
			md.lastDirX = sgndx;
			md.lastDirY = sgndy;
			md.hasDir = true;
		}

		if(absdx >= absdy){
			for(i = 0; i < absdx && i < pixelsBudget; i++){
				md.yTally += absdy;
				if(md.yTally >= absdx){
					md.yTally -= absdx;
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
				md.xTally += absdx;
				if(md.xTally >= absdy){
					md.xTally -= absdy;
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

		this.onMoved();
	}

	// Hook called after the entity's position has changed.  Player overrides
	// this to update the camera-anchoring state; base implementation does
	// nothing.
	onMoved(){
	}

	// Subclasses override this to select a new this.target when appropriate.
	// The base class never picks a target on its own.
	findTarget(dtSeconds){
	}

	updateWalkOctant(){
		if(this.target == null){
			this.walkOctant = null;
			return;
		}
		var dx = this.target.x - this.position.x;
		var dy = this.target.y - this.position.y;
		if(dx == 0 && dy == 0){
			this.walkOctant = null;
			return;
		}
		this.walkOctant = computeWalkOctant(dx, dy);
		this.facing = this.walkOctant;
	}

	takeDamage(amount){
		if(!this.isAlive) return;
		this.health -= amount;
		if(this.health <= 0){
			this.health = 0;
			this.isAlive = false;
			this.onDeath();
		}
	}

	onDeath(){
		// Subclasses override.  Base: nothing; the game loop removes dead
		// entities that aren't the player.
	}

	// Returns the idle frame name matching the current facing octant.
	idleFrame(){
		return WALK_SEQUENCES[this.facing][1];
	}

	// Begin an attack in the current facing direction.  Returns true if the
	// attack started (i.e. wasn't blocked by an existing attack or a cooldown).
	startAttack(){
		if(!this.isAlive) return false;
		if(this.attackTimer > 0 || this.attackCooldown > 0) return false;

		this.attackTimer = ATTACK_DURATION;
		this.attackHitApplied = false;

		var seq = ATTACK_SEQUENCES[this.facing];
		this.sprite.startSequence(seq);
		this.currentSequence = seq;

		return true;
	}

	// Called once per attack when the windup reaches ATTACK_HIT_TIME.  Finds
	// every entity of a different category in range and within the attack arc,
	// and applies damage.
	applyAttackDamage(){
		var game = this.game;
		var attackAngle = -Math.PI / 2 + this.facing * Math.PI / 4;
		var rangeSq = this.attackRange * this.attackRange;

		// Candidate list: everything in characters, plus the player if we're not them.
		var candidates = [];
		for(var n = 0; n < game.characters.length; n++){
			candidates.push(game.characters[n]);
		}
		if(this !== game.player) candidates.push(game.player);

		for(var n = 0; n < candidates.length; n++){
			var other = candidates[n];
			if(other === this) continue;
			if(!other.isAlive) continue;
			if(other.category === this.category) continue;

			var dx = other.position.x - this.position.x;
			var dy = other.position.y - this.position.y;
			if(dx * dx + dy * dy > rangeSq) continue;

			var angleToTarget = Math.atan2(dy, dx);
			var diff = angleToTarget - attackAngle;
			// Normalize to [-π, π]
			while(diff >  Math.PI) diff -= 2 * Math.PI;
			while(diff < -Math.PI) diff += 2 * Math.PI;
			if(Math.abs(diff) > ATTACK_HIT_ARC) continue;

			other.takeDamage(this.attackPower);
		}
	}

	act(dtSeconds){
		var self = this;

		// --- combat timers ---
		if(this.attackCooldown > 0) this.attackCooldown -= dtSeconds;

		if(this.attackTimer > 0){
			this.attackTimer -= dtSeconds;

			// Apply damage once, partway through the attack.
			var elapsed = ATTACK_DURATION - this.attackTimer;
			if(!this.attackHitApplied && elapsed >= ATTACK_HIT_TIME){
				this.applyAttackDamage();
				this.attackHitApplied = true;
			}

			if(this.attackTimer <= 0){
				this.attackTimer = 0;
				this.attackCooldown = ATTACK_COOLDOWN;
				this.sprite.stopSequence();
				this.sprite.setFrame(this.idleFrame());
				this.currentSequence = null;
				this.sprite.currentSequence = null;
			}

			// While attacking, do not move or change walk animation.
			return;
		}

		this.findTarget(dtSeconds);
		if(this.attackTimer > 0) return;

		var scale = 1;

		if(this.target != null){
			var adx = Math.abs(this.target.x - this.position.x);
			var ady = Math.abs(this.target.y - this.position.y);
			var hyp = Math.sqrt(adx * adx + ady * ady);
			if(hyp > 0) scale = Math.max(adx, ady) / hyp;
		}

		this.moveBudget += this.skills.speed * dtSeconds * scale;
		var pixelsThisTick = Math.floor(this.moveBudget);
		this.moveBudget -= pixelsThisTick;

		var sequence = null, endFrame;

		if(this.target != null){
			var tdx = this.target.x - this.position.x;
			var tdy = this.target.y - this.position.y;

			if(tdx == 0 && tdy == 0){
				this.target = null;
				this.advanceWaypoint();
			}else{
				if(pixelsThisTick > 0){
					var oldx = this.position.x;
					var oldy = this.position.y;
					this.moveTowardsTarget(pixelsThisTick);
					if(this.position.x == oldx && this.position.y == oldy){
						this.target = null;
					}
				}

				if(this.target != null && this.walkOctant != null){
					sequence = WALK_SEQUENCES[this.walkOctant][0];
					endFrame = WALK_SEQUENCES[this.walkOctant][1];
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
		}
	}

	distanceToMouseEvent(e){
		var px = this.sprite.position.x;
		var py = this.sprite.position.y;
		py += this.sprite.frameHeight - 1;
		px += this.sprite.frameWidth >> 1;

		return {
			x : Math.floor(e.clientX / gameScale) - px,
			y : Math.floor(e.clientY / gameScale) - py
		};
	}

	setTarget(dx, dy){
		var game = this.game;
		this.target = null;

		var target = {
			x : Math.round(this.position.x + dx),
			y : Math.round(this.position.y + dy)
		};

		if(!this.collidesOnPath(this.position.x, this.position.y, target.x, target.y)){
			this.walkPath = [target];
			return;
		}

		var gridRadius = Math.max(game.viewRange.width, game.viewRange.height) >> 1;

		var gridTarget = {
			x : Math.floor(target.x / cellSize) - this.mapPos.x,
			y : Math.floor(target.y / cellSize) - this.mapPos.y
		};

		var collisionMap = game.activeMap.readCollisionMap(
			this.mapPos.x - gridRadius,
			this.mapPos.y - gridRadius,
			this.mapPos.x + gridRadius + 1,
			this.mapPos.y + gridRadius + 1
		);

		var graph = new Graph(collisionMap);
		var start = graph.grid[gridRadius][gridRadius];

		var endX = gridTarget.x + gridRadius;
		var endY = gridTarget.y + gridRadius;
		if(
			endX < 0 || endY < 0
			|| endX >= graph.grid.length
			|| endY >= graph.grid[0].length
		){
			this.walkPath = [];
			return;
		}

		var end = graph.grid[endX][endY];
		var path = astar.search(graph, start, end);

		this.walkPath = [];

		for(var p = 0; p < path.length - 1; p++){
			this.walkPath[this.walkPath.length] = {
				x : cellSize * (this.mapPos.x + path[p].x - gridRadius + .5),
				y : cellSize * (this.mapPos.y + path[p].y - gridRadius + .5)
			};
		}
		this.walkPath[this.walkPath.length] = target;

		this.walkPath = this.optimizePath(this.walkPath);
	}

	optimizePath(path){
		if(path.length < 3) return path;

		for(var idx = path.length - 2; idx > 0; idx--){
			if(!this.collidesOnPath(path[idx - 1].x, path[idx - 1].y, path[idx + 1].x, path[idx + 1].y)){
				path.splice(idx, 1);
			}
		}

		if(path.length > 1){
			if(!this.collidesOnPath(this.position.x, this.position.y, path[1].x, path[1].y)){
				path.splice(0, 1);
			}
		}

		return path;
	}

	collidesOnPath(x1, y1, x2, y2){
		var tally = 0, i;
		var dx = x2 - x1;
		var dy = y2 - y1;
		var sgndx = Math.sign(dx);
		var absdx = Math.abs(dx);
		var sgndy = Math.sign(dy);
		var absdy = Math.abs(dy);
		var rval = false;

		if(absdx >= absdy){
			for(i = 0; i < absdx && rval == false; i++){
				tally += absdy;
				if(tally >= absdx){
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
	}

	advanceWaypoint(){
		if(this.target == null && this.walkPath.length > 0){
			this.target = this.walkPath.shift();
			this.updateWalkOctant();
			return true;
		}
		return false;
	}
}


// ----------------------------------------------------------------------------
// Player — input-driven targeting, and the anchor for the camera.
// ----------------------------------------------------------------------------

class Player extends Entity {
	constructor(game){
		super(game, {
			category    : 'player',
			health      : 100,
			attackPower : 15,
			attackRange : 20
		});
		this.damageFlash = 0;
	}

	findTarget(dtSeconds){
		this.advanceWaypoint();
	}

	onMoved(){
		this.game.activeMap.playerPos = {
			x : this.mapPos.x,
			y : this.mapPos.y
		};
		this.game.checkOverlay();
	}

	setMapPos(x, y){
		super.setMapPos(x, y);
		if(this.game.activeMap){
			this.game.activeMap.playerPos.x = x;
			this.game.activeMap.playerPos.y = y;
		}
	}

	takeDamage(amount){
		super.takeDamage(amount);
		this.damageFlash = 0.3;    // seconds of red vignette
	}

	onDeath(){
		console.log('Player died.');
		this.game.gamePaused = true;
	}

	act(dtSeconds){
		if(this.damageFlash > 0) this.damageFlash -= dtSeconds;
		super.act(dtSeconds);
	}
}

// ----------------------------------------------------------------------------
// Enemy — wander/idle AI for now.  Combat comes in slice 5b.
// ----------------------------------------------------------------------------

class Enemy extends Entity {
	constructor(game, options){
		super(game, options || {});
		this.category = 'enemy';

		// AI state machine.  Values currently used:
		//   'idle'   — standing still until aiTimer elapses
		//   'wander' — walking toward this.target; when reached, back to idle
		this.aiState = 'idle';
		this.aiTimer = 0.5 + Math.random() * 2.0;   // seconds until next decision

		// How far the enemy will wander from its current position when idle,
		// in cells.
		this.wanderRadius = 3;
	}

	findTarget(dtSeconds){
		var game   = this.game;
		var player = game.player;

		// --- player visible? ---
		var dx = player.position.x - this.position.x;
		var dy = player.position.y - this.position.y;
		var distSq = dx * dx + dy * dy;
		var visionPx = this.skills.vision * cellSize;
		var visionSq = visionPx * visionPx;

		if(player.isAlive && distSq < visionSq){
			var rangeSq = this.attackRange * this.attackRange;

			if(distSq <= rangeSq){
				// In melee range: face the player and swing.
				this.target = null;
				this.walkPath = [];
				this.aiState = 'attack';
				if(this.attackCooldown <= 0 && this.attackTimer <= 0){
					var oct = computeWalkOctant(dx, dy);
					if(oct != null) this.facing = oct;
					this.startAttack();
				}
				return;
			}

			// Out of melee range but visible: chase.
			this.aiState = 'chase';
			if(this.target == null && this.walkPath.length == 0){
				this.setTarget(dx, dy);
			}
			this.advanceWaypoint();
			return;
		}

		// --- player not visible: wander as before ---
		if(this.target != null || this.walkPath.length > 0){
			this.advanceWaypoint();
			return;
		}

		this.aiTimer -= dtSeconds;
		if(this.aiTimer > 0) return;

		if(Math.random() < 0.5){
			this.aiState = 'idle';
			this.aiTimer = 0.5 + Math.random() * 2.0;
		}else{
			var angle  = Math.random() * Math.PI * 2;
			var radius = Math.random() * this.wanderRadius * cellSize;
			var tx = Math.round(this.position.x + Math.cos(angle) * radius);
			var ty = Math.round(this.position.y + Math.sin(angle) * radius);

			this.aiState = 'wander';
			this.setTarget(tx - this.position.x, ty - this.position.y);
			this.advanceWaypoint();
			this.aiTimer = 0.5 + Math.random() * 2.0;
		}
	}
}

// ============================================================================
// renderView — factory, closed over per-frame state
// ============================================================================

function createRenderView(game){
	var frameName;
	var playerLayer;
	var topLayer;
	var randomKey, worldPosition, treeFrame;
	var x, y, mapX, mapY, gridX, gridY, n;
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
				r = Math.sin(r) + 1;
				r *= 500;
				r -= Math.floor(r);
				r *= 100;
				r = Math.floor(r);
				r = (r + game.waterCycle) % 20;
				if(r < 5){
					game.sprites.waterWaves.setFrame(r);
				}else{
					game.sprites.waterWaves.setFrame(5);
				}
				game.sprites.waterWaves.setPosition(gridX, gridY, false);
				game.sprites.waterWaves.draw(game.ctx);
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
						otherTexture = area.spritemap[area.map[readX][readY]];
					}
				}
				if(otherTexture != 'sand'){
					renderCell(area, otherTexture, true);
				}

				switch(bitsum){
					case 3:
						game.sprites.sandTiles.setFrame('corner');
						game.sprites.sandTiles.rotation = Math.PI;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 5:
						game.sprites.sandTiles.setFrame('corner');
						game.sprites.sandTiles.rotation = 3 * Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 10:
						game.sprites.sandTiles.setFrame('corner');
						game.sprites.sandTiles.rotation = Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 12:
						game.sprites.sandTiles.setFrame('corner');
						game.sprites.sandTiles.rotation = 0;
						game.sprites.sandTiles.setPosition(gridX, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 7:
						game.sprites.sandTiles.setFrame('edge');
						game.sprites.sandTiles.rotation = 3 * Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 13:
						game.sprites.sandTiles.setFrame('edge');
						game.sprites.sandTiles.rotation = 0;
						game.sprites.sandTiles.setPosition(gridX, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 14:
						game.sprites.sandTiles.setFrame('edge');
						game.sprites.sandTiles.rotation = Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 11:
						game.sprites.sandTiles.setFrame('edge');
						game.sprites.sandTiles.rotation = Math.PI;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 1:
						game.sprites.sandTiles.setFrame('tip');
						game.sprites.sandTiles.rotation = Math.PI;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 2:
						game.sprites.sandTiles.setFrame('tip');
						game.sprites.sandTiles.rotation = Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 4:
						game.sprites.sandTiles.setFrame('tip');
						game.sprites.sandTiles.rotation = 3 * Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 8:
						game.sprites.sandTiles.setFrame('tip');
						game.sprites.sandTiles.rotation = 0;
						game.sprites.sandTiles.setPosition(gridX, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 9:
						game.sprites.sandTiles.setFrame('wall');
						game.sprites.sandTiles.rotation = 0;
						game.sprites.sandTiles.setPosition(gridX, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 6:
						game.sprites.sandTiles.setFrame('wall');
						game.sprites.sandTiles.rotation = Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 15:
						game.sprites.sand.drawRandomArea(game.ctx, gridX, gridY, cellSize, cellSize, randomKey);
						break;
				}
				break;
			case 'stone floor':
				game.sprites.ground.rotate(Math.floor(randomKey * 4) * Math.PI / 2);
				game.sprites.ground.drawRandomArea(game.ctx, gridX, gridY, cellSize, cellSize, randomKey);
				break;
			case 'stone wall':
				if(mapY == area.map[0].length || area.spritemap[area.map[mapX][mapY + 1]] != 'stone wall'){
					game.sprites.stone.setFrame(Math.floor(randomKey * 10) + 10);
				}else{
					game.sprites.stone.setFrame(Math.floor(randomKey * 10));
				}
				game.sprites.stone.draw(game.ctx, {x : gridX, y : gridY});
				break;
			case 'trees':
				game.sprites.grass.rotate(Math.PI / 2);
				game.sprites.grass.drawRandomArea(game.ctx, gridX, gridY, cellSize, cellSize, randomKey);

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
				playerLayer[playerLayer.length] = {
					doing : 'tree',
					sprite : game.sprites.tree,
					frame : 'trunk' + treeFrame,
					x : gridX,
					y : gridY
				};
				topLayer[topLayer.length] = {
					sprite : game.sprites.tree,
					frame : 'greens' + treeFrame,
					x : gridX,
					y : gridY
				};
				break;
			case 'grass':
				game.sprites.grass.rotate(Math.PI / 2);
				game.sprites.grass.drawRandomArea(game.ctx, gridX, gridY, cellSize, cellSize, randomKey);

				if(!underlay && randomKey < .5){
					var brushFrame = 100 * randomKey;
					brushFrame = Math.floor(Math.abs(9 * Math.sin(brushFrame - Math.floor(brushFrame))));
					playerLayer[playerLayer.length] = {
						doing : 'grass',
						sprite : game.sprites.longGrass,
						frame : brushFrame,
						x : gridX,
						y : gridY
					};
				}
				break;
		}
		if(game.showGameGrid){
			game.ctx.strokeStyle = "rgba(0,0,0, 0.2)";
			game.ctx.strokeRect(gridX * gameScale, gridY * gameScale, cellSize * gameScale, cellSize * gameScale);
		}
	};

	return function(area){
		var o;
		playerLayer = [];
		topLayer = [];

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
			x : game.player.position.x % cellSize,
			y : game.player.position.y % cellSize
		};
		game.ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);

		var middleX = Math.floor(game.screenMiddle.x / (gameScale * cellSize)) + 1;
		var middleY = Math.floor(game.screenMiddle.y / (gameScale * cellSize)) + 1;

		for(y = -1; y <= game.viewRange.height + 1; y++){
			mapY = game.player.mapPos.y + y - middleY;
			if(mapY < 0 || mapY > area.map[0].length - 1) continue;

			for(x = -1; x <= game.viewRange.width + 1; x++){
				mapX = game.player.mapPos.x + x - middleX;
				if(mapX < 0 || mapX > area.map.length - 1) continue;

				if(area.hideMap[mapX][mapY] === true){
					continue;
				}

				gridX = x * cellSize - worldPosition.x;
				gridY = y * cellSize - worldPosition.y;

				randomKey = Math.abs(Math.sin(mapX + mapY * area.map.length) * 10000);
				randomKey -= Math.floor(randomKey);
				renderCell(area, area.spritemap[area.map[mapX][mapY]]);

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
								game.sprites.dungeonElements.setFrame(frameName);
								game.sprites.dungeonElements.draw(game.ctx, {x : gridX, y: gridY});
								break;
							case 'caveEntrance':
								game.sprites.caveEntrance.setFrame(frameName);
								game.sprites.caveEntrance.draw(game.ctx, {x : gridX, y : gridY});
						}
					}
				}
			}
		}

		for(o of playerLayer){
			o.sprite.setFrame(o.frame);
			o.sprite.draw(game.ctx, { x : o.x, y : o.y });
		}

		if(game.player.walkPath.length > 0){
			var pointerx = cellSize * middleX + game.player.walkPath[game.player.walkPath.length - 1].x - game.player.position.x;
			var pointery = cellSize * middleY + game.player.walkPath[game.player.walkPath.length - 1].y - game.player.position.y;
			game.mousePointers.target.draw(game.ctx, { x : pointerx, y : pointery });
		}else if(game.player.target != null){
			var pointerx2 = cellSize * middleX + game.player.target.x - game.player.position.x;
			var pointery2 = cellSize * middleY + game.player.target.y - game.player.position.y;
			game.mousePointers.target.draw(game.ctx, { x : pointerx2, y : pointery2 });
		}

		for(o of game.characters){
			var offset = {
				x : o.sprite.frameWidth >> 1,
				y : o.sprite.frameHeight - 1
			};
			o.sprite.draw(game.ctx, {
				x : cellSize * middleX + o.position.x - game.player.position.x - offset.x,
				y : cellSize * middleY + o.position.y - game.player.position.y - offset.y
			});
		}

		game.player.sprite.setPosition(
			cellSize * middleX - (game.player.sprite.frameWidth >> 1),
			cellSize * middleY - game.player.sprite.frameHeight + 1,
			1
		);
		game.player.sprite.draw(game.ctx);

		for(o of topLayer){
			o.sprite.setFrame(o.frame);
			o.sprite.draw(game.ctx, { x : o.x, y : o.y });
		}

		// --- damage vignette ---
		if(game.player && game.player.damageFlash > 0){
			var alpha = Math.min(0.6, game.player.damageFlash * 2);
			game.ctx.save();
			game.ctx.fillStyle = 'rgba(180, 0, 0, ' + alpha + ')';
			game.ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
			game.ctx.restore();
		}

		// --- HP readout ---
		if(game.player && game.player.isAlive){
			var hpText = 'HP ' + game.player.health + '/' + game.player.maxHealth;
			game.ctx.save();
			game.ctx.font = '14px monospace';
			game.ctx.fillStyle = '#000';
			game.ctx.fillText(hpText, 11, 21);
			game.ctx.fillStyle = '#FFF';
			game.ctx.fillText(hpText, 10, 20);
			game.ctx.restore();
		}
	};
}


// ============================================================================
// Game
// ============================================================================

class Game {
	constructor(canvas, overlay){
		this.canvas = canvas;
		this.overlay = overlay;
		this.ctx = canvas.getContext('2d');

		this.spriteSets = {};
		this.sprites = {};
		this.mousePointers = {};
		this.playerSpriteSet = new spriteSet();

		this.maps = [];
		this.activeMap = null;
		this.characters = [];
		this.player = null;

		this.viewRange = {};
		this.screenMiddle = { x : 0, y : 0 };
		this.showGameGrid = false;
		this.isTransitioning = false;

		this.keyboard = null;
		this.mouse = null;
		this.lastFrameTime = 0;
		this.gamePaused = false;

		this.waterCycle = 0;
		this.waterCycleAccum = 0;

		this.renderView = createRenderView(this);
	}

	// ------------------------------------------------------------------
	// initialization
	// ------------------------------------------------------------------

	async init(){
		this.setupCanvas();
		this.writeText(5, 5, "DungeonCrawler v.0.0");

		try {
			await this.loadSpriteSets();
			await this.loadPlayerSprite();
			await this.loadMap('maps/test.map');

			await this.spawnEntity(Enemy, 'sprites/knight.sprite', {
				x : this.activeMap.playerPos.x + 3,
				y : this.activeMap.playerPos.y + 2,
				speed : 20,
				vision: 4
			});

			this.initializeEvents();
			await this.loadMousePointers();

			this.startGameLoop();
		} catch(e){
			console.error("Initialization failed:", e);
			throw e;
		}
	}

	setupCanvas(){
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;

		this.screenMiddle = { x : this.canvas.width >> 1, y : this.canvas.height >> 1 };
		this.viewRange = {
			width:  Math.ceil(this.canvas.width  / (gameScale * cellSize)) + 1,
			height: Math.ceil(this.canvas.height / (gameScale * cellSize)) + 1
		};

		this.ctx.webkitImageSmoothingEnabled = false;
		this.ctx.mozImageSmoothingEnabled = false;
		this.ctx.imageSmoothingEnabled = false;

		window.addEventListener('resize', () => this.handleResize());
	}

	async loadSpriteSets(){
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

		while(spriteList.length > 0){
			const dat = spriteList.pop();
			const set = new spriteSet();
			await set.load('sprites/' + dat.file);
			this.spriteSets[dat.name] = set;
			this.sprites[dat.name] = new cSprite(set);
			this.sprites[dat.name].setScale(gameScale);
		}

		this.sprites.waterWaves.setFrame('0');
	}

	async loadPlayerSprite(){
		this.player = new Player(this);

		await this.playerSpriteSet.load("sprites/foo.sprite");
		this.player.sprite = new cSprite(this.playerSpriteSet);
		this.player.sprite.setScale(gameScale);
		this.player.sprite.setPosition(this.screenMiddle.x, this.screenMiddle.y, true);
		this.player.sprite.setFrame('front_idle');
	}

	// Load (and cache) a spriteSet by name.  If it's already loaded, returns the
	// cached instance.
	async loadSpriteSet(name, file){
		if(this.spriteSets[name] != undefined) return this.spriteSets[name];
		const set = new spriteSet();
		await set.load(file);
		this.spriteSets[name] = set;
		return set;
	}

	// Spawn an Entity subclass into the world.  Class must be a subclass of
	// Entity.  spriteFile is a path like 'sprites/rat.sprite'.  options are
	// passed through to the entity's constructor and can also include x, y,
	// initialFrame, and spriteName.
	async spawnEntity(Class, spriteFile, options){
		options = options || {};

		var setName = options.spriteName != undefined
			? options.spriteName
			: spriteFile.replace(/^.*\//, '').replace(/\.sprite$/, '');

		var set = await this.loadSpriteSet(setName, spriteFile);

		var entity = new Class(this, options);
		entity.sprite = new cSprite(set);
		entity.sprite.setScale(gameScale);
		entity.sprite.setFrame(options.initialFrame || 'front_idle');

		if(options.x != undefined && options.y != undefined){
			entity.setMapPos(options.x, options.y);
		}

		this.characters.push(entity);
		return entity;
	}

	async loadMap(mapFile){
		const map = new mapBuilder();
		await map.loadImageMap(mapFile);
		this.maps.push(map);
		this.activeMap = map;

		this.player.position.x = Math.floor(cellSize * (this.activeMap.playerPos.x + .5));
		this.player.position.y = Math.floor(cellSize * (this.activeMap.playerPos.y + .5));
		this.player.mapPos = {
			x : this.activeMap.playerPos.x,
			y : this.activeMap.playerPos.y
		};
		this.player.skills.vision = 5;

		for(let x = 0; x < this.activeMap.width; x++){
			for(let y = 0; y < this.activeMap.height; y++){
				this.activeMap.hideMap[x][y] = false;
			}
		}

		this.renderView(this.activeMap);
	}

	initializeEvents(){
		this.keyboard = new KeyboardListener();
		this.keyboard.listen();
		this.keyboard.onCombo(['CTRL', 'G'], () => {
			this.showGameGrid = !this.showGameGrid;
		});

		this.overlay.addEventListener('contextmenu', (e) => e.preventDefault());

		this.mouse = new MouseHandler();
		this.mouse.lastTarget = null;
		this.mouse.consumedByInteraction = false;
		this.mouse.listen(this.overlay);
		this.mouse.on('mousedown', (e) => this.handlePointerDown(e));
		this.mouse.on('mousemove', (e) => {
			if(this.mouse.isDown) this.handlePointer(e);
		});
		this.mouse.on('mouseup', (e) => {
			this.mouse.lastTarget = null;
			this.mouse.consumedByInteraction = false;
		});
	}

	async loadMousePointers(){
		var pointerList = [
			{'name' : 'target', 'file' : 'target.sprite'}
		];

		while(pointerList.length > 0){
			const dat = pointerList.pop();
			const set = new spriteSet();
			await set.load('sprites/' + dat.file);
			this.mousePointers[dat.name] = new cSprite(set);
			this.mousePointers[dat.name].setScale(gameScale);
		}

		this.mousePointers['target'].startSequence('spin', {
			iterations: 0,
			method : 'manual'
		});
	}

	// ------------------------------------------------------------------
	// the loop
	// ------------------------------------------------------------------

	startGameLoop(){
		this.lastFrameTime = 0;
		requestAnimationFrame((t) => this.loop(t));
	}

	loop(time){
		if(this.lastFrameTime === 0) this.lastFrameTime = time;
		var dt = (time - this.lastFrameTime) / 1000;
		this.lastFrameTime = time;

		if(dt > 0.1) dt = 0.1;

		if(!this.gamePaused && this.activeMap != null){
			this.playGame(dt);
		}

		requestAnimationFrame((t) => this.loop(t));
	}

	playGame(dt){
		var n;

		if(this.mouse != null && this.mouse.isDown && !this.mouse.consumedByInteraction && this.mouse.lastEvent != null){
			this.handlePointer(this.mouse.lastEvent);
		}

		this.player.act(dt);
		for(n = 0; n < this.characters.length; n++){
			this.characters[n].act(dt);
		}

		// advance the water animation by wall-clock time
		this.waterCycleAccum += dt * waterCycleRate;
		while(this.waterCycleAccum >= 1){
			this.waterCycleAccum -= 1;
			this.waterCycle++;
		}

		// Remove any entities that died this frame (player death handled separately).
		for(var n = this.characters.length - 1; n >= 0; n--){
			var c = this.characters[n];
			if(!c.isAlive){
				// TODO (slice 5c): drop loot / leave a corpse.
				this.characters.splice(n, 1);
			}
		}

		this.renderView(this.activeMap);
	}

	// ------------------------------------------------------------------
	// input handling
	// ------------------------------------------------------------------
	handlePointer(e){
		if(!(e.buttons & 1)) return;

		var delta = this.player.distanceToMouseEvent(e);

		// The world-space point under the cursor.  This is the quantity that
		// actually needs to change before we re-run pathfinding — it changes
		// when the mouse moves AND when the player walks, but stays constant
		// when both are still, which is the case we want to short-circuit.
		var worldTarget = {
			x : this.player.position.x + delta.x,
			y : this.player.position.y + delta.y
		};

		if(
			this.mouse.lastTarget != null
			&& this.mouse.lastTarget.x === worldTarget.x
			&& this.mouse.lastTarget.y === worldTarget.y
		){
			return;
		}
		this.mouse.lastTarget = worldTarget;

		if(delta.x * delta.x + delta.y * delta.y < cellSize * cellSize){
			// clicked on the cell we're standing on
			if(!this.handleActiveCellClick()){
				this.player.setTarget(delta.x, delta.y);
			}
		}else{
			this.player.setTarget(delta.x, delta.y);
		}
	}

	handlePointerDown(e){
		if(!(e.buttons & 1)) return;

		var delta = this.player.distanceToMouseEvent(e);
		var worldX = this.player.position.x + delta.x;
		var worldY = this.player.position.y + delta.y;

		var clickTarget = this.findClickTarget(worldX, worldY);
		if(clickTarget && this.interactWith(clickTarget)){
			this.mouse.consumedByInteraction = true;
			this.mouse.lastTarget = { x : worldX, y : worldY };
			return;
		}

		// No interactive target under the cursor — treat the press as the start
		// of a normal walk.
		this.mouse.consumedByInteraction = false;
		this.handlePointer(e);
	}

	handleActiveCellClick(){
		var items = this.player.touchingItems();

		for(var item of items){
			switch(item.content){
				case 'stairup':
				case 'stairdown':
				case 'caveEntrance':
					this.useEntrance(item);
					break;
				default:
					console.log(item.content);
			}
		}

		return items.length;
	}

	findClickTarget(worldX, worldY){
		var padding = 4;   // world pixels of extra hit area around each sprite

		var best = null;
		var bestDistSq = Infinity;

		for(var n = 0; n < this.characters.length; n++){
			var c = this.characters[n];
			if(!c.isAlive) continue;
			if(c === this.player) continue;

			if(this.pointInEntityBounds(c, worldX, worldY, padding)){
				var dx = c.position.x - this.player.position.x;
				var dy = c.position.y - this.player.position.y;
				var d2 = dx * dx + dy * dy;
				if(d2 < bestDistSq){
					bestDistSq = d2;
					best = c;
				}
			}
		}

		if(best != null) return { type : 'entity', target : best };
		return null;
	}

	pointInEntityBounds(entity, worldX, worldY, padding){
		// Sprites are anchored center-bottom at entity.position.  See the draw
		// offsets in renderView: x -= frameWidth/2, y -= frameHeight - 1.
		var halfW  = entity.sprite.frameWidth / 2;
		var height = entity.sprite.frameHeight;

		var cx = entity.position.x;
		var cy = entity.position.y;

		return worldX >= cx - halfW - padding
			&& worldX <= cx + halfW + padding
			&& worldY >= cy - height - padding
			&& worldY <= cy + padding;
	}

	interactWith(clickTarget){
		if(clickTarget.type !== 'entity') return false;

		var target = clickTarget.target;
		var player = this.player;

		var dx = target.position.x - player.position.x;
		var dy = target.position.y - player.position.y;
		var distSq = dx * dx + dy * dy;
		var rangeSq = player.attackRange * player.attackRange;

		if(distSq > rangeSq) return false;

		var oct = computeWalkOctant(dx, dy);
		if(oct != null) player.facing = oct;

		return player.startAttack();
	}
	// ------------------------------------------------------------------
	// map transitions
	// ------------------------------------------------------------------

	useEntrance(entrance){
		if(this.isTransitioning) return;
		this.isTransitioning = true;

		if(entrance.target == undefined){
			var mapIdx = this.maps.length;
			this.maps[mapIdx] = new mapBuilder();
			this.maps[mapIdx].build({
				category : 'dungeon',
				width : 30,
				height: 30,
				roomscale: .8,
				stairup: true,
				stairdown: true
			});
			entrance.target = this.maps[mapIdx];

			var linkTarget = (oppositeKey) => {
				var opposite = entrance.target.items[oppositeKey];
				if(opposite == undefined || opposite.length === 0) return;
				entrance.target.playerPos = {
					x : opposite[0].x,
					y : opposite[0].y
				};
				if(opposite[0].target == undefined){
					opposite[0].target = this.activeMap;
				}
			};

			switch(entrance.content){
				case 'stairup':     linkTarget('stairdown'); break;
				case 'stairdown':   linkTarget('stairup');   break;
				case 'caveEntrance':linkTarget('stairup');   break;
			}
		}

		this.player.target = null;
		this.gamePaused = true;

		var opacity = 1, faderate = .2;
		this.canvas.style.opacity = opacity;

		var fadeOut = () => {
			opacity -= faderate;
			this.canvas.style.opacity = opacity;
			if(opacity > faderate){
				setTimeout(fadeOut, 30);
			}else{
				this.activeMap = entrance.target;
				this.player.setMapPos(this.activeMap.playerPos.x, this.activeMap.playerPos.y);
				this.player.position.x += cellSize >> 1;
				this.player.position.y += cellSize >> 1;
				this.checkOverlay();
				this.renderView(this.activeMap);
				this.gamePaused = false;
				this.canvas.style.opacity = 0;
				setTimeout(fadeIn, 500);
			}
		};

		var fadeIn = () => {
			opacity += faderate;
			this.canvas.style.opacity = opacity;
			if(opacity < 1){
				setTimeout(fadeIn, 30);
			}else{
				this.canvas.style.opacity = 1;
				this.isTransitioning = false;
			}
		};

		fadeOut();
	}

	// ------------------------------------------------------------------
	// overlay / fog of war
	// ------------------------------------------------------------------

	checkOverlay(){
		var x, y, cx, cy;
		for(x = -this.player.skills.vision; x <= this.player.skills.vision; x++){
			cx = x + this.player.mapPos.x;
			if(cx >= 0 && cx < this.activeMap.width){
				for(y = -this.player.skills.vision; y <= this.player.skills.vision; y++){
					cy = y + this.player.mapPos.y;
					if(cy >= 0 && cy < this.activeMap.height){
						if(squareDistance(x, y, 0, 0) < Math.pow(this.player.skills.vision, 2)){
							this.activeMap.hideMap[cx][cy] = false;
						}
					}
				}
			}
		}
	}

	// ------------------------------------------------------------------
	// misc
	// ------------------------------------------------------------------

	handleResize(){
		if(this.canvas == undefined) return;
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this.screenMiddle = { x : this.canvas.width >> 1, y : this.canvas.height >> 1 };
		this.viewRange = {
			width:  Math.ceil(this.canvas.width  / (gameScale * cellSize)) + 1,
			height: Math.ceil(this.canvas.height / (gameScale * cellSize)) + 1
		};
		// canvas resize resets context state — re-disable smoothing
		this.ctx.webkitImageSmoothingEnabled = false;
		this.ctx.mozImageSmoothingEnabled = false;
		this.ctx.imageSmoothingEnabled = false;

		if(this.activeMap != undefined){
			this.renderView(this.activeMap);
		}
	}

	writeText(x, y, text){
		var shadow = document.createElement('span');
		shadow.textContent = text;
		shadow.style.position = 'absolute';
		shadow.style.left = (x + 2) + 'px';
		shadow.style.top  = (y + 2) + 'px';
		shadow.style.color = '#000';
		this.overlay.appendChild(shadow);

		var span = document.createElement('span');
		span.textContent = text;
		span.style.position = 'absolute';
		span.style.left = x + 'px';
		span.style.top  = y + 'px';
		span.style.color = '#FFF';
		this.overlay.appendChild(span);
	}
}


// ============================================================================
// bootstrap
// ============================================================================
window.addEventListener('load', function(){
	var canvas = document.getElementById('gameCanvas');
	var overlay = document.getElementById('overlay');
	var game = new Game(canvas, overlay);
	game.init().catch(function(e){
		console.error("Fatal error during initialization:", e);
	});
});
