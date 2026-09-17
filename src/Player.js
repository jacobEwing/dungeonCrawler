'use strict';

class Player extends Entity {
	constructor(game){
		super(game, {
			category    : 'player',
			health      : 100,
			attackPower : 15,
			attackRange : 20
		});
		this.damageFlash = 0;
		this.gold = 0;

		// When set, the player is committed to an action against a specific
		// entity: walking to it, then interacting with it on arrival.
		// Overrides ordinary click-to-walk until it completes or is cleared.
		//
		// { type : 'attack' | 'loot' | 'talk',
		//   target : Entity,
		//   lastCellX : number, lastCellY : number }
		this.pendingAction = null;
	}

	// ------------------------------------------------------------------
	// pending-action API
	// ------------------------------------------------------------------

	setPendingAction(type, target){
		this.pendingAction = {
			type : type,
			target : target,
			lastCellX : null,
			lastCellY : null
		};
		// Discard any existing walk route so the next findTarget call
		// computes a fresh one toward the new target.
		this.target = null;
		this.walkPath = [];
	}

	clearPendingAction(){
		this.pendingAction = null;
	}

	actionRange(actionType){
		// All action types currently share the melee range.  Future actions
		// (talk, use) can override here.
		return this.attackRange;
	}

	hasReach(target){
		return this.game.activeMap.hasLineOfSight(
			this.position.x, this.position.y,
			target.position.x, target.position.y
		);
	}

	executePendingAction(){
		var tgt = this.pendingAction.target;

		if(this.pendingAction.type === 'attack'){
			var dx = tgt.position.x - this.position.x;
			var dy = tgt.position.y - this.position.y;
			var oct = computeWalkOctant(dx, dy);
			if(oct != null) this.facing = oct;
			// No-ops while attack is in progress or on cooldown; fires
			// again as soon as the cooldown expires.  This is what makes
			// the attack continuous.
			this.startAttack();
		}else if(this.pendingAction.type === 'loot'){
			this.game.lootCorpse(tgt);
			this.pendingAction = null;
		}else if(this.pendingAction.type === 'talk'){
			// Placeholder for future dialogue UI.
			this.pendingAction = null;
		}
	}

	// ------------------------------------------------------------------
	// movement / action selection
	// ------------------------------------------------------------------

	findTarget(dtSeconds){
		if(this.pendingAction){
			var tgt = this.pendingAction.target;

			if(!tgt || this.game.characters.indexOf(tgt) === -1){
				// Target no longer exists on this map.
				this.pendingAction = null;
			}else{
				var dx = tgt.position.x - this.position.x;
				var dy = tgt.position.y - this.position.y;
				var distSq = dx * dx + dy * dy;
				var range = this.actionRange(this.pendingAction.type);

				if(distSq <= range * range && this.hasReach(tgt)){
					// In range and unobstructed — execute.
					this.target = null;
					this.walkPath = [];
					this.executePendingAction();
					return;
				}

				// Otherwise keep closing.  Repath if the target moved to a
				// new cell, or if we've run out of route (blocked, or
				// arrived somewhere that isn't close enough).
				var cellChanged =
					this.pendingAction.lastCellX !== tgt.mapPos.x
					|| this.pendingAction.lastCellY !== tgt.mapPos.y;
				var routeExhausted = this.target == null && this.walkPath.length === 0;

				if(cellChanged || routeExhausted){
					this.setTarget(dx, dy);
					this.pendingAction.lastCellX = tgt.mapPos.x;
					this.pendingAction.lastCellY = tgt.mapPos.y;
				}
			}
		}

		this.advanceWaypoint();
	}

	onMoved(){
		this.game.activeMap.playerPos = {
			x : this.mapPos.x,
			y : this.mapPos.y
		};
		this.game.updateVisibility();
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
		this.damageFlash = 0.3;
	}

	onDeath(){
		console.log('Player died.');
		this.game.gamePaused = true;
	}

	act(dtSeconds){
		if(this.damageFlash > 0) this.damageFlash -= dtSeconds;
		super.act(dtSeconds);
	}

	// Place an item into its designated equipment slot.  If the slot is already
	// occupied, the current occupant is unequipped back to inventory.
	// Returns true on success, false if the item can't be equipped or already is.
	equipItem(item){
		if(!item || !item.isEquippable()) return false;
		if(item.equipped) return false;

		for(var n = 0; n < this.possessions.length; n++){
			var other = this.possessions[n];
			if(other !== item && other.equipped && other.slot === item.slot){
				other.equipped = false;
			}
		}

		item.equipped = true;
		this.refreshWeaponSprite();
		return true;
	}

	// Move an equipped item back to the inventory grid.
	unequipItem(item){
		if(!item || !item.equipped) return false;
		item.equipped = false;
		this.refreshWeaponSprite();
		return true;
	}

	// Look at the currently-equipped items and (re)build the weapon sprite
	// reference that the renderer will layer over the player.  Called whenever
	// equipment changes, and after load.
	refreshWeaponSprite(){
		var equipped = null;
		for(var n = 0; n < this.possessions.length; n++){
			var it = this.possessions[n];
			if(it.equipped && it.weaponSprite){
				equipped = it;
				break;
			}
		}

		if(equipped){
			var set = this.game.spriteSets[equipped.weaponSprite];
			if(set){
				this.weaponSprite = new cSprite(set);
				this.weaponSprite.setScale(gameScale);
				return;
			}
		}

		this.weaponSprite = null;
	}
}
