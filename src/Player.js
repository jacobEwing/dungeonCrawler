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
}