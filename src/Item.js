'use strict';

// An item the player can carry.  Thin wrapper today; the class exists so we
// have a single place to add behavior later (use, examine, stat effects)
// and so we can rely on instanceof checks throughout the codebase.
class Item {
	constructor(data){
		data = data || {};
		this.name     = data.name || 'unknown';
		this.category = data.category || 'misc';
		this.quantity = data.quantity != undefined ? data.quantity : 1;
		this.slot     = data.slot != undefined ? data.slot : null;
		this.equipped = data.equipped === true;
	}

	// True if this item can be placed in an equipment slot.  Non-equippable
	// items (valuables, potions, misc) return false.
	isEquippable(){
		return this.slot != null;
	}
}
