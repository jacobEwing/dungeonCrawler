var kbListener = function(){
	this.keyState = {};
	this.initialize();
	this.KEYMAP = {};
	this.REF_KEYMAP = {};
};

kbListener.prototype.initialize = function(){
	var n;
	this.KEYMAP = {
		'UP' : 38,		'DOWN' : 40,		'LEFT' : 37,		'RIGHT' : 39,
		'ESC' : 27,		'ENTER' : 13,		'TAB' : 9,		'SPACE' : 32,
		'SHIFT' : 16,		'CTRL' : 17,		'ALT' : 18,		'PAUSE' : 19,
		'BACKSPACE' : 8,	'CAPS_LOCK' : 20,	'NUM_LOCK' : 144,	'SCROLL_LOCK' : 145,
		'PGUP' : 33,		'PGDN' : 34,		'END' : 35,
		'HOME' : 36,		'INSERT' : 45,		'DELETE' : 46,
		'TILDE' : 192,		"'" : 222,		'[' : 219,		']' : 221,
		'\\' : 220,		';' : 59,		'=' : 61,		'-' : 173,
		'META' : 91,		'MENU' : 93,
		'NUMPAD_*' : 106,	'NUMPAD_+' : 107,	'NUMPAD_-' : 109,	'NUMPAD_/' : 111,
		',' : 188,		'.' : 190

	};
	for(n = 65; n < 91; n++) this.KEYMAP[String.fromCharCode(n)] = n;
	for(n = 0; n < 10; n++) this.KEYMAP[n] = 48 + n;
	for(n = 1; n <= 12; n++) this.KEYMAP['F' + n] = 111 + n;
	for(n = 0; n < 10; n++) this.KEYMAP['NUMPAD_' + n] = 96 + n;
	this.REV_KEYMAP = {};
	for(n in this.KEYMAP){
		this.keyState[n] = 0;
		this.REV_KEYMAP[this.KEYMAP[n]] = n;
	}
}

kbListener.prototype.listen = function(element){
	element.onkeydown = function(e){
		this.keyState[e.which] = 1;
	}
	element.onkeyup = function(e){
		this.keyState[e.which] = 0;
	}
}
