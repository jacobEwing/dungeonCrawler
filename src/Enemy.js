'use strict';

class Enemy extends Entity {
	constructor(game, options){
		super(game, options || {});
		this.category = 'enemy';

		this.aiState = 'idle';
		this.aiTimer = 0.5 + Math.random() * 2.0;

		this.wanderRadius = 3;

		// Loot table is resolved by key at construction, but rolled only on death.
		this.lootTable = options.lootTableKey != undefined
			? (LOOT_TABLES[options.lootTableKey] || null)
			: null;

		// Starting gold and possessions are zero for enemies; the loot roll
		// populates them when the enemy dies.
		this.gold = 0;
	}

	findTarget(dtSeconds){
		var game   = this.game;
		var player = game.player;

		var dx = player.position.x - this.position.x;
		var dy = player.position.y - this.position.y;
		var distSq = dx * dx + dy * dy;
		var visionPx = this.skills.vision * cellSize;
		var visionSq = visionPx * visionPx;

		if(
			player.isAlive
			&& distSq < visionSq
			&& this.game.activeMap.hasLineOfSight(
				this.position.x, this.position.y,
				player.position.x, player.position.y
			)
		){
			var rangeSq = this.attackRange * this.attackRange;

			if(distSq <= rangeSq){
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

			this.aiState = 'chase';
			if(this.target == null && this.walkPath.length == 0){
				this.setTarget(dx, dy);
			}
			this.advanceWaypoint();
			return;
		}

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

	onDeath(){
		super.onDeath();

		if(!this._lootRolled){
			this._lootRolled = true;
			this.rollLoot();
		}

		if(this.spawnPoint){
			this.spawnPoint.activeEntity = null;

			if(this.spawnPoint.mode === SPAWN_MODE.PERSISTENT
					|| this.spawnPoint.mode === SPAWN_MODE.RESET_ON_ENTER){
				this.spawnPoint.exhausted = true;
			}else{
				this.spawnPoint.cooldownTimer = SPAWN_RESPAWN_COOLDOWN;
			}
		}
	}

	// Roll each entry in the loot table independently.  Weight is relative to
	// the sum of all weights in the table, so entries don't need to total 100.
	rollLoot(){
		if(!this.lootTable) return;

		var totalWeight = 0;
		for(var n = 0; n < this.lootTable.length; n++){
			totalWeight += this.lootTable[n].weight;
		}
		if(totalWeight <= 0) return;

		for(var m = 0; m < this.lootTable.length; m++){
			var entry = this.lootTable[m];
			if(Math.random() * totalWeight >= entry.weight) continue;

			if(entry.gold){
				var range = entry.gold.max - entry.gold.min + 1;
				this.gold += entry.gold.min + Math.floor(Math.random() * range);
			}
			if(entry.item){
				// Copy so the table's literal is never mutated.
				this.possessions.push(Object.assign({}, entry.item));
			}
		}
	}
}
