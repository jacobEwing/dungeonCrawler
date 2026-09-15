'use strict';

// Wraps localStorage for now.  Deliberately thin: the game speaks JSON,
// SaveManager just moves strings in and out.  A future IndexedDB or file
// backend would implement the same four methods and slot in unchanged.
class SaveManager {
	constructor(storageKey){
		this.storageKey = storageKey || 'dungeoncrawler.save';
	}

	hasSave(){
		return localStorage.getItem(this.storageKey) != null;
	}

	save(data){
		try {
			localStorage.setItem(this.storageKey, JSON.stringify(data));
			return true;
		} catch(e){
			console.error("SaveManager::save failed:", e);
			return false;
		}
	}

	load(){
		try {
			var str = localStorage.getItem(this.storageKey);
			if(!str) return null;
			return JSON.parse(str);
		} catch(e){
			console.error("SaveManager::load failed:", e);
			return null;
		}
	}

	clear(){
		localStorage.removeItem(this.storageKey);
	}
}
