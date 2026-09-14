'use strict';

class Corpse extends Entity {
	constructor(game, options){
		super(game, options || {});
		this.category = 'corpse';
		this.isAlive = false;
		this.facing = options.facing != undefined ? options.facing : 4;
	}
}