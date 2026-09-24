'use strict';

// ============================================================================
// Entity — base class for anything that has a position, a sprite, and the
// ability to walk around.
// ============================================================================

class Entity {
	constructor(game, options){
		options = options || {};

		this.game = game;
		this.category = options.category || 'entity';

		this.position = {x : 0, y : 0};
		this.mapPos = {x : 0, y : 0};
		this.sprite = null;

		this.sequence = null;
		this.currentEndFrame = null;

		this.skills = {
			speed  : options.speed  != undefined ? options.speed  : walkSpeed,
			vision : options.vision != undefined ? options.vision : 6
		};

		this.target = null;
		this.walkPath = [];
		this.possessions = options.possessions || [];
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
		this.mortal = options.mortal != undefined ? options.mortal : true;
		this.attackPower  = options.attackPower != undefined ? options.attackPower : 5;
		this.attackRange  = options.attackRange != undefined ? options.attackRange : 18;

		this.facing = 4;

		this.attackTimer      = 0;
		this.attackCooldown   = 0;
		this.attackHitApplied = false;
		this.defense = options.defense != undefined ? options.defense : 0;
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

		var result = [];

		var mapped = this.game.activeMap.mappedItems;
		if(mapped[x] != undefined && mapped[x][y] != undefined){
			result = result.concat(mapped[x][y]);
		}

		for(var n = 0; n < this.game.characters.length; n++){
			var c = this.game.characters[n];
			if(c === this) continue;
			if(c.mapPos.x === x && c.mapPos.y === y){
				result.push(c);
			}
		}

		return result;
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
					var ny = this.position.y + sgndy;
					if(this.canWalkOn(this.position.x, ny) && this.canOccupy(this.position.x, ny)){
						this.position.y = ny;
					}
				}
				var nx = this.position.x + sgndx;
				if(this.canWalkOn(nx, this.position.y) && this.canOccupy(nx, this.position.y)){
					this.position.x = nx;
				}
			}
		}else{
			for(i = 0; i < absdy && i < pixelsBudget; i++){
				md.xTally += absdx;
				if(md.xTally >= absdy){
					md.xTally -= absdy;
					var nx2 = this.position.x + sgndx;
					if(this.canWalkOn(nx2, this.position.y) && this.canOccupy(nx2, this.position.y)){
						this.position.x = nx2;
					}
				}
				var ny2 = this.position.y + sgndy;
				if(this.canWalkOn(this.position.x, ny2) && this.canOccupy(this.position.x, ny2)){
					this.position.y = ny2;
				}
			}
		}

		this.mapPos = {
			x : Math.floor(this.position.x / cellSize),
			y : Math.floor(this.position.y / cellSize)
		};

		this.onMoved();
	}

	onMoved(){
	}

	findTarget(dtSeconds){
	}

	// Returns an array of { x, y, r } circles in world coordinates describing
	// this entity's collision footprint at the given proposed position (or the
	// current position if none is supplied).  Falls back to a single circle
	// matching the historical frame-width heuristic when the sprite has no
	// collision block.
	getCollisionCircles(px, py){
		if(px == undefined) px = this.position.x;
		if(py == undefined) py = this.position.y;

		// [migrated] sprite.template → sprite.sheet
		var block = this.sprite && this.sprite.sheet
			? this.sprite.sheet.collision
			: null;

		if(block && block.circles){
			var out = [];
			for(var n = 0; n < block.circles.length; n++){
				var c = block.circles[n];
				out.push({
					x : px + c.offsetX,
					y : py + c.offsetY,
					r : c.radius
				});
			}
			return out;
		}

		// Fallback: current behavior.  Circle centered at the anchor with
		// radius frameWidth/2.
		var fw = this.sprite ? this.sprite.frameWidth : 0;
		return [{ x : px, y : py, r : fw / 2 }];
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

		// Defense reduces incoming damage, with a floor of 1 so that a
		// highly-armoured entity can't become completely immune.
		var reduced = Math.max(1, amount - this.defense);

		if(!this.mortal){
			this.health = Math.max(1, this.health - reduced);
			return;
		}

		this.health -= reduced;
		if(this.health <= 0){
			this.health = 0;
			this.isAlive = false;
			this.onDeath();
		}
	}
	onDeath(){
		if(this.sprite) this.sprite.stop();
	}

	idleFrame(){
		return WALK_SEQUENCES[this.facing][1];
	}

	isVisible(){
		var map = this.game.activeMap;
		if(!map || !map.hideMap) return true;
		var pos = this.mapPos;
		if(pos.x < 0 || pos.y < 0
				|| pos.x >= map.hideMap.length
				|| pos.y >= map.hideMap[pos.x].length){
			return false;
		}
		return map.hideMap[pos.x][pos.y] === false;
	}

	// True when the entity's cell is currently within the camera view (plus a
	// small margin).  Unlike isVisible(), this does not depend on fog-of-war
	// reveal and can go back to false when the player walks away.  Used by the
	// spawn-point leashing logic so a chaser doesn't pop out of existence
	// while the player is watching.
	isOnScreen(){
	    var game = this.game;
	    if(!game.viewRange || !game.player) return false;

	    var dx = this.mapPos.x - game.player.mapPos.x;
	    var dy = this.mapPos.y - game.player.mapPos.y;

	    var halfW = Math.ceil(game.viewRange.width  / 2) + 2;
	    var halfH = Math.ceil(game.viewRange.height / 2) + 2;

	    return Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
	}

	startAttack(){
		if(!this.isAlive) return false;
		if(this.attackTimer > 0 || this.attackCooldown > 0) return false;

		this.attackTimer = ATTACK_DURATION;
		this.attackHitApplied = false;

		var seq = ATTACK_SEQUENCES[this.facing];
		this.sprite.play(seq);
		this.sequence = seq;

		return true;
	}

	applyAttackDamage(){
		var game = this.game;
		var attackAngle = -Math.PI / 2 + this.facing * Math.PI / 4;
		var rangeSq = this.attackRange * this.attackRange;

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

			// A wall between attacker and target absorbs the blow.  This is what
			// stops enemies from clawing at the player through a one-cell wall.
			if(!game.activeMap.hasLineOfSight(
				this.position.x, this.position.y,
				other.position.x, other.position.y
			)){
				continue;
			}

			var angleToTarget = Math.atan2(dy, dx);
			var diff = angleToTarget - attackAngle;
			while(diff >  Math.PI) diff -= 2 * Math.PI;
			while(diff < -Math.PI) diff += 2 * Math.PI;
			if(Math.abs(diff) > ATTACK_HIT_ARC) continue;

			other.takeDamage(this.attackPower);
		}
	}

	// [migrated] The sprite runtime no longer self-drives via setTimeout —
	// animation only advances when update(dtMs) is called.  We do the actual
	// per-frame logic in _act(), then unconditionally advance the sprite clock
	// in act() so every exit path from _act() (including the two early
	// returns) still ticks the animation.
	act(dtSeconds){
		if(!this.isAlive) return;

		this._act(dtSeconds);

		if(this.sprite) this.sprite.update(dtSeconds * 1000);
	}

	_act(dtSeconds){
		var self = this;

		if(this.attackCooldown > 0) this.attackCooldown -= dtSeconds;

		if(this.attackTimer > 0){
			this.attackTimer -= dtSeconds;

			var elapsed = ATTACK_DURATION - this.attackTimer;
			if(!this.attackHitApplied && elapsed >= ATTACK_HIT_TIME){
				this.applyAttackDamage();
				this.attackHitApplied = true;
			}

			if(this.attackTimer <= 0){
				this.attackTimer = 0;
				this.attackCooldown = ATTACK_COOLDOWN;
				this.sprite.stop();
				this.sprite.setFrame(this.idleFrame());
				this.sequence = null;
			}

			return;
		}

		this.findTarget(dtSeconds);

		// findTarget may have just started an attack (mouse click on an
		// enemy, or an enemy entering melee range).  If so, the attack
		// sequence owns the sprite — do not fall through to the walk
		// animation logic, which would play() over the attack we just
		// started.
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
			if(this.sequence != null){
				this.sprite.stop();
				this.sprite.setFrame(this.currentEndFrame);
				this.sequence = null;
			}
		}else if(sequence != this.sequence){
			this.currentEndFrame = endFrame;
			this.sequence = sequence;
			// [migrated] play(name, fn) → play(name, { onComplete: fn })
			this.sprite.play(sequence, { onComplete: function(){
				self.sequence = null;
				self.sprite.setFrame(endFrame);
			} });
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

	// Can this entity stand at (newX, newY) without overlapping another
	// solid entity?  Corpses and dead entities are ignored.
	canOccupy(newX, newY){
		var game = this.game;

		// The player is not in game.characters, so check them separately.
		if(this !== game.player && game.player.sprite){
			if(this._overlaps(game.player, newX, newY)) return false;
		}

		var chars = game.characters;
		for(var n = 0; n < chars.length; n++){
			var other = chars[n];
			if(other === this) continue;
			if(other.category === 'corpse') continue;
			if(!other.isAlive) continue;
			if(!other.sprite) continue;
			if(this._overlaps(other, newX, newY)) return false;
		}
		return true;
	}

	_overlaps(other, newX, newY){
		var otherCircles = other.getCollisionCircles();

		// Escape hatch: if we already overlap at the current position, allow
		// the move.  Otherwise an entity spawned on top of another could never
		// step out.
		var nowCircles = this.getCollisionCircles();
		if(this._circlesOverlap(nowCircles, otherCircles)) return false;

		// Would we overlap at the proposed position?
		var newCircles = this.getCollisionCircles(newX, newY);
		return this._circlesOverlap(newCircles, otherCircles);
	}

	_circlesOverlap(listA, listB){
		for(var i = 0; i < listA.length; i++){
			var A = listA[i];
			for(var j = 0; j < listB.length; j++){
				var B = listB[j];
				var dx = A.x - B.x;
				var dy = A.y - B.y;
				var rr = A.r + B.r;
				if(dx * dx + dy * dy < rr * rr) return true;
			}
		}
		return false;
	}
}