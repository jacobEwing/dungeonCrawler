'use strict';

class CharacterPanel extends Panel {
	constructor(game){
		super(game, 'character');
	}

	buildContent(){
		var p = this.game.player;
		if(!p) return '';

		var esc = this.game.escapeHtml.bind(this.game);
		var b = p.baseStats;
		var html = '';

		// Health (special format: current / max)
		html += '<div class="panel-row"><span>Health</span><span>'
		      + p.health + ' / ' + p.maxHealth + '</span></div>';

		html += this.statRow('Attack',  p.attackPower,   b.attackPower);
		html += this.statRow('Defense', p.defense,       b.defense);
		html += this.statRow('Vision',  p.skills.vision, b.vision);

		// Speed is shown as a percentage of the base walking speed, since the
		// raw number (pixels per second) isn't meaningful to a player.
		var speedPct = Math.round(100 * p.skills.speed / walkSpeed);
		var speedBasePct = Math.round(100 * b.speed / walkSpeed);
		html += this.statRow('Speed', speedPct, speedBasePct, '%');

		html += '<div class="panel-row"><span>Gold</span><span>'
		      + esc(p.gold) + '</span></div>';

		return html;
	}

	// One row showing an effective value, with a coloured bonus/penalty
	// annotation when the effective value differs from the base.
	statRow(label, effective, base, suffix){
		suffix = suffix || '';
		var esc = this.game.escapeHtml.bind(this.game);
		var bonus = effective - base;
		var display = esc(effective) + suffix;

		if(bonus !== 0){
			var sign = bonus > 0 ? '+' : '';
			var cls = bonus > 0 ? 'stat-bonus positive' : 'stat-bonus negative';
			display += ' <span class="' + cls + '">(' + sign + bonus + suffix + ')</span>';
		}

		return '<div class="panel-row"><span>' + esc(label) + '</span><span>'
		     + display + '</span></div>';
	}
}
