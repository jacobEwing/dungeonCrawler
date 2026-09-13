'use strict';

class KeyboardListener {
	constructor(){
		this.keyState = {};
		this.KEYMAP = {};
		this.REV_KEYMAP = {};
		this.combos = [];
		this.initialize();
	}

	initialize(){
		var n, customMaps;

		this.KEYMAP = {
			'UP' : 38,        'DOWN' : 40,      'LEFT' : 37,      'RIGHT' : 39,
			'ESC' : 27,       'ENTER' : 13,     'TAB' : 9,        'SPACE' : 32,
			'SHIFT' : 16,     'CTRL' : 17,      'ALT' : 18,       'PAUSE' : 19,
			'BACKSPACE' : 8,  'CAPS_LOCK' : 20, 'NUM_LOCK' : 144, 'SCROLL_LOCK' : 145,
			'PGUP' : 33,      'PGDN' : 34,      'END' : 35,
			'HOME' : 36,      'INSERT' : 45,    'DELETE' : 46,
			'TILDE' : 192,    "'" : 222,        '[' : 219,        ']' : 221,
			'\\' : 220,       ';' : 59,         '=' : 61,         '-' : 173,
			'META' : 91,      'MENU' : 93,
			'NUMPAD_*' : 106, 'NUMPAD_+' : 107, 'NUMPAD_-' : 109, 'NUMPAD_/' : 111,
			',' : 188,        '.' : 190
		};

		switch(true){
			case !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0:
				customMaps = {';' : 186, '=' : 187, '-' : 189, 'PRTSCR' : 44};
				break;
			case typeof InstallTrigger !== 'undefined':
				customMaps = {';' : 59,  '=' : 61,  '-' : 173, 'PRTSCR' : 42};
				break;
			case Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0:
				customMaps = {';' : 186, '=' : 187, '-' : 189, 'PRTSCR' : 44};
				break;
			case !!window.chrome:
				customMaps = {';' : 186, '=' : 187, '-' : 189, 'PRTSCR' : 42};
				break;
			case /*@cc_on!@*/false || !!document.documentMode:
				customMaps = {';' : 186, '=' : 187, '-' : 189, 'PRTSCR' : 42};
				break;
			default:
				customMaps = {';' : 186, '=' : 187, '-' : 189, 'PRTSCR' : 42};
		}

		for(var character in customMaps){
			this.KEYMAP[character] = customMaps[character];
		}

		for(n = 65; n < 91; n++) this.KEYMAP[String.fromCharCode(n)] = n;
		for(n = 0; n < 10; n++)  this.KEYMAP[n] = 48 + n;
		for(n = 1; n <= 12; n++) this.KEYMAP['F' + n] = 111 + n;
		for(n = 0; n < 10; n++)  this.KEYMAP['NUMPAD_' + n] = 96 + n;

		for(n in this.KEYMAP){
			this.keyState[n] = 0;
			this.REV_KEYMAP[this.KEYMAP[n]] = n;
		}
	}

	checkCombos(key){
		for(var combo of this.combos){
			if(this.REV_KEYMAP[key] == combo.sequence[combo.currentIndex].toUpperCase()){
				combo.currentIndex++;
				if(combo.currentIndex >= combo.sequence.length){
					combo.currentIndex = 0;
					combo.callback();
				}
			}else{
				combo.currentIndex = 0;
			}
		}
	}

	onCombo(sequence, callback){
		this.combos[this.combos.length] = {
			sequence : sequence,
			callback : callback,
			currentIndex : 0
		};
	}

	listen(element){
		var me = this;
		if(element == undefined) element = document;

		var downfunction = function(e){
			if(me.REV_KEYMAP[e.which] !== undefined){
				e.preventDefault();
			}
			me.keyState[e.which] = 1;
			me.checkCombos(e.which);
		};
		var upfunction = function(e){
			me.keyState[e.which] = 0;
		};

		element.addEventListener("keydown", downfunction);
		element.addEventListener("keyup", upfunction);
	}
}
