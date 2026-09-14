'use strict';

class Enemy extends Entity {
	constructor(game, options){
		super(game, options || {});
		this.category = 'enemy';

		this.aiState = 'idle';
		this.aiTimer = 0.5 + Math.random() * 2.0;

		this.wanderRadius = 3;

		// Seed some loot for the corpse to drop.
		if(this.possessions.length === 0){
			this.possessions.push({
				name   : 'gold',
				amount : 1 + Math.floor(Math.random() * 5)
			});
		}
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

		if(!this.spawnPoint) return;

		this.spawnPoint.activeEntity = null;

		if(this.spawnPoint.mode === SPAWN_MODE.PERSISTENT
		   || this.spawnPoint.mode === SPAWN_MODE.RESET_ON_ENTER){
			this.spawnPoint.exhausted = true;
		}else{
			// SPAWN_MODE.RESPAWN (and any future mode that recycles via
			// cooldown rather than exhaustion).
			this.spawnPoint.cooldownTimer = SPAWN_RESPAWN_COOLDOWN;
		}
	}
}
