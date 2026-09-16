'use strict';

// Base class for all UI panels.  A panel owns a DOM shell that already exists
// in game.html (identified by `#panel-<name>`), and populates its .panel-body
// on demand via buildContent().  Subclasses override buildContent() and
// nothing else.
//
// Lifecycle:
//   open()    — refresh content, then show the shell
//   close()   — hide the shell
//   refresh() — rebuild content in place (called on open, and safe to call
//               at any time to reflect state changes)
class Panel {
	constructor(game, name){
		this.game = game;
		this.name = name;
		this.el = document.getElementById('panel-' + name);
		this.bodyEl = this.el ? this.el.querySelector('.panel-body') : null;
	}

	open(){
		if(!this.el) return;
		this.refresh();
		this.el.classList.add('visible');
	}

	close(){
		if(!this.el) return;
		this.el.classList.remove('visible');
	}

	isOpen(){
		return !!(this.el && this.el.classList.contains('visible'));
	}

	refresh(){
		if(!this.bodyEl) return;
		this.bodyEl.innerHTML = this.buildContent();
	}

	// Subclasses override.  Returns an HTML string for the panel body.
	buildContent(){
		return '';
	}
}
