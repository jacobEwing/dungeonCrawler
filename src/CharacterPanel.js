'use strict';

class CharacterPanel extends Panel {
	constructor(game){
		super(game, 'character');
	}

	buildContent(){
		var p = this.game.player;
		if(!p) return '';

		var esc = this.game.escapeHtml.bind(this.game);
		var html = '';

		html += '<div class="panel-row"><span>Health</span><span>'
		      + p.health + ' / ' + p.maxHealth + '</span></div>';

		html += '<div class="panel-row"><span>Gold</span><span>'
		      + esc(p.gold) + '</span></div>';

		html += '<div class="panel-row"><span>Vision</span><span>'
		      + esc(p.skills.vision) + '</span></div>';

		return html;
	}
}
