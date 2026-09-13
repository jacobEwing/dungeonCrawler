'use strict';

// let's define trim as we need it here
if (typeof trim === "undefined") {
    var trim = function(stringToTrim) {
        return String(stringToTrim).replace(/^\s+|\s+$/g, "");
    };
}

var cSprite = function(newTemplate){
    	if(!(this instanceof cSprite)) {
		return new cSprite(newTemplate);
	}

	for(var n in cSprite.defaults){
		this[n] = cSprite.defaults[n];
	}
	// these can't be copied from csprites, or we get the same object in multiple sprites
	this.position = {x : 0, y : 0};
	this.drawOffset = {x : 0, y : 0};
	this.children = Array();

	if(newTemplate != undefined){
		this.setTemplate(newTemplate);
	}
};

cSprite.defaults = {
	template : null,
	image : null,
	scale : 1,
	zIndex : 0,
	frame: null,
	frameIndex : 0,
	frameName: null,
	frameWidth: 0,
	frameHeight: 0,
	rotation: 0,
	centerx : 0,
	centery : 0,
	currentFrame : null,
	currentSequence : null,
	currentSequenceName : null,
	animating : null,
	imageWidth : 0,
	imageHeight : 0,

	currentFrameTime : 0,
	sequenceIterations : 0,
	sequenceCallback : null,
	sequenceMethod : 'auto',
	sequenceFrameRate : 0,


	// parent/child sprite management variables
	numChildren : 0,
	myParent : 0
};

cSprite.prototype.setTemplate = function(template){
	this.template = template;
	this.image = template.image;

	this.imageWidth = this.image.naturalWidth || this.image.width;
	this.imageHeight = this.image.naturalHeight || this.image.height;

	this.frameWidth = template.frameWidth;
	this.frameHeight = template.frameHeight;
};

cSprite.prototype.setFrame = function(frameName) {
	this.frameName = frameName;
	this.frame = this.template.frames[frameName];
	if (!this.frame) {
		throw new Error("Frame not found: " + frameName);
	}
};

cSprite.prototype.startSequence = function(sequenceName, callback) {
    var seq = this.template.sequences[sequenceName];
    if (!seq) return;

    this.animating = true;
    this.currentSequenceName = sequenceName;
    this.currentSequence = seq;          // reference to the immutable definition
    this.frameIndex = 0;
    this.currentFrameTime = 0;
    this.sequenceIterations = (seq.iterations !== undefined) ? seq.iterations : 0;
    this.sequenceCallback = callback || seq.callback || null;
    this.sequenceMethod = seq.method || 'auto';
    this.sequenceFrameRate = seq.frameRate || this.template.defaultFrameRate;

    this.doSequenceStep();
};

cSprite.prototype.rotate = function(angle){
	this.rotation += angle;
};

cSprite.prototype.drawRandomArea = function(context, drawx, drawy, width, height, randomKey){
	// width and height are the pixel width and height, which are scaled up by this sprites current scale
	var x, y;

	width *= 1;
	width = width > this.imageWidth ? this.imageWidth : (width < 0 ? 0 : width);

	height *= 1;
	height = height > this.imageHeight ? this.imageHeight : (height < 0 ? 0 : height);

	if(width == 0 || height == 0) return;
	if(randomKey == undefined){
		x = Math.floor(Math.random() * (this.imageWidth - width));
		y = Math.floor(Math.random() * (this.imageHeight - height));
	}else{
		randomKey = Math.sin(randomKey) * 10000;
		randomKey -= Math.floor(randomKey);
		x = Math.floor(randomKey * (this.imageWidth - width));
		randomKey = Math.sin(randomKey) * 10000;
		randomKey -= Math.floor(randomKey);
		y = Math.floor(randomKey * (this.imageHeight - height));
	}

	this.drawArea(context, drawx, drawy, x, y, width, height);
}

cSprite.prototype.drawArea = function(context, drawx, drawy, readx1, ready1, width, height){
	context.save();
	context.drawImage(
		this.image,
		readx1, ready1,
		width, height,
		drawx * this.scale, drawy * this.scale,
		width * this.scale, height * this.scale
	);
	context.restore();
}

cSprite.prototype.draw = function(context, params) {
	if (!params) params = {};

	var x = this.position.x + this.drawOffset.x;
	var y = this.position.y + this.drawOffset.y;
	var drawScale = this.scale;

	var frameX = 0;
	var frameY = 0;
	var frameWidth = this.imageWidth;
	var frameHeight = this.imageHeight;
	var frameCenterX = this.template.centerx;
	var frameCenterY = this.template.centery;

	if (this.frame) {
		frameX = this.frame.x;
		frameY = this.frame.y;
		frameWidth = this.frame.width;
		frameHeight = this.frame.height;
		frameCenterX = this.frame.centerx;
		frameCenterY = this.frame.centery;
	}

	for (var n in params) {
		if (!params.hasOwnProperty(n)) continue;
		switch (n) {
			case 'x': x = params[n] + this.drawOffset.x; break;
			case 'y': y = params[n] + this.drawOffset.y; break;
			case 'scale': drawScale = params[n]; break;
			case 'frameWidth': frameWidth = params[n]; break;
			case 'frameHeight': frameHeight = params[n]; break;
			case 'frameX': frameX = params[n]; break;
			case 'frameY': frameY = params[n]; break;
		}
	}

	context.save();
	try {
		if (this.frame && this.frame.drawOffset) {
			x += this.frame.drawOffset.x;
			y += this.frame.drawOffset.y;
		}

		context.translate(x * drawScale, y * drawScale);
		context.rotate(this.rotation);
		context.scale(drawScale, drawScale);
		context.translate(-frameCenterX, -frameCenterY);

		for (var i = 0; i < this.children.length; i++) {
			if (this.children[i].zIndex > this.zIndex) {
				this.children[i].draw(context);
			}
		}

		context.drawImage(
				this.image,
				frameX, frameY,
				frameWidth, frameHeight,
				0, 0,
				frameWidth, frameHeight
				);

		for (var j = 0; j < this.children.length; j++) {
			if (this.children[j].zIndex <= this.zIndex) {
				this.children[j].draw(context);
			}
		}

	} finally {
		context.restore();
	}
};
cSprite.prototype.setScale = function(newScale){
	this.scale = newScale;
	/*
	this.centerx = this.centery = 0;
	if(this.frame != undefined){
		this.centerx = this.frame.centerx;
		this.centery = this.frame.centery;
	}

	// also need to adjust our element's position, as that will be
	// dependent on scale when we have a center point other than 0,0
	this.element.style.left = (this.position.x - this.centerx * this.scale) + 'px';
	this.element.style.top = (this.position.y - this.centery * this.scale) + 'px';
	
	this.image.style.width = this.image.width * this.scale + 'px';
	this.image.style.height = this.image.height * this.scale + 'px';

	if(this.frame != undefined){
		this.setFrameSize(this.frame.width * this.scale, this.frame.height * this.scale);
		this.refreshFrame();
	}else{
		this.element.style.width = this.image.width * this.scale + 'px';
		this.element.style.height = this.image.height * this.scale + 'px';
	}
	*/
};

cSprite.prototype.setPosition = function(x, y, useScale){
	this.centerx = this.centery = 0;
	this.position.x = x;
	this.position.y = y;
	if(this.frame != undefined){
		this.centerx = this.frame.centerx;
		this.centery = this.frame.centery;
	}
};

// parent/child sprite management functions

cSprite.prototype.detach = function(oldChild) {
	if (oldChild === undefined) {
		if (this.myParent) {
			this.myParent.detach(this);
		}
		this.myParent = 0;
		return;
	}

	var index = this.children.indexOf(oldChild);
	if (index !== -1) {
		this.children.splice(index, 1);
		this.numChildren = this.children.length;
		oldChild.myParent = 0;
	}
};

cSprite.prototype.attach = function(newChild) {
	if (newChild === this) {
		throw new Error("Cannot attach a sprite to itself");
	}
	newChild.detach();
	newChild.myParent = this;
	this.children.push(newChild);
	this.numChildren = this.children.length;
};

cSprite.prototype.attachTo = function(newParent){
	this.detach();
	newParent.attach(this);
};

cSprite.prototype.doSequenceStep = function() {
	if (!this.animating || !this.currentSequence) return;

	var seq = this.currentSequence;
	var frames = seq.frames;
	if (!frames || frames.length === 0) {
		this.animating = false;
		return;
	}

	// Set the current frame
	this.setFrame(frames[this.frameIndex]);

	// Advance the frame index
	this.frameIndex++;
	if (this.frameIndex >= frames.length) {
		// End of sequence reached
		if (this.sequenceIterations === 1) {
			// Play once and stop
			this.animating = false;
			this.currentSequence = null;
			if (typeof this.sequenceCallback === 'function') {
				this.sequenceCallback.call(this);
			}
			return;
		} else if (this.sequenceIterations === 0) {
			// Infinite loop
			this.frameIndex = 0;
		} else {
			// Finite iterations remaining
			this.sequenceIterations--;
			this.frameIndex = 0;
		}
	}

	// Schedule the next frame if the method is 'auto'
	if (this.sequenceMethod === 'auto') {
		var delay = this.sequenceFrameRate;
		if (seq.frameTimes && seq.frameTimes.length > 0) {
			delay = seq.frameTimes[this.currentFrameTime];
			this.currentFrameTime = (this.currentFrameTime + 1) % seq.frameTimes.length;
		}
		setTimeout(() => this.doSequenceStep(), delay);
	}
};

////////////////////////////////////////////////////////////////////////////////////

var spriteSet = function(filename, callback){
	if (!(this instanceof spriteSet)) {
		return new spriteSet(filename, callback);
	}

	for(var n in spriteSet.defaults){
		this[n] = spriteSet.defaults[n];
	}
	this.frames = [];
	this.frameNames = [];
	this.sequences = {};

	if(filename != undefined){
		this.load(filename, callback);
	}

}

spriteSet.defaults = {
	defaultFrameRate : 40,
	centerx : 0,
	centery : 0,
	image : null,
	scale : 1
};

spriteSet.prototype.newSprite = function(){
	var sprite = new cSprite(this);
	sprite.scale = this.scale;
	return sprite;
};

spriteSet.prototype.setScale = function(scale){
	this.scale = scale;
}

spriteSet.prototype.load = function(fileName, callback){
	var me = this;
	if(typeof(fileName) == 'object'){
		// this allows passing in a raw json object instead of a file
		me.loadJSON(fileName, callback);
	} else {
		var loc = window.location.pathname;
		var dir = loc.substring(0, loc.lastIndexOf('/'));
		var client = new XMLHttpRequest();

		client.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {

				try{
					var data = JSON.parse(this.responseText);
					me.loadJSON(data, callback);

				}catch(e){
					throw "spriteSet::load: " + e;
				}
			}
		}
		client.open('GET', dir + '/' + fileName);
		client.send();
	}
};

spriteSet.prototype.addFrame = function(id, params){
	var parts, arg, val, n;
	var newFrame = {
		'x': 0,
		'y': 0,
		'width': this.frameWidth,
		'height': this.frameHeight,
		'centerx': this.centerx,
		'centery': this.centery
	};
	for(n in params){
		switch(trim(n).toLowerCase()){
			case 'width':
				newFrame.width = 1 * params[n];
				break;
			case 'height':
				newFrame.height = 1 * params[n];
				break;
			case 'x': case 'left':
				newFrame['x'] = 1 * newFrame['x'] + 1 * params[n];
				break;
			case 'xoffset':
				newFrame['x'] = 1 * newFrame['x'] + 1 * params[n];
				break;
			case 'y': case 'top':
				newFrame['y'] = 1 * newFrame['y'] + 1 * params[n];
				break;
			case 'yoffset':
				newFrame['y'] = 1 * newFrame['y'] + 1 * params[n];
				break;
			case 'centerx': case 'cx':
				newFrame['centerx'] = 1 * params[n];
				break;
			case 'centery': case 'cy':
				newFrame['centery'] = 1 * params[n];
				break;
		}
	}
	this.frames[id] = newFrame;
};

// This overly complicated argument processing allows us to go through each
// argument and wait for it to be processed.  The big advantage here is that we
// can simply wait for an image to be fully loaded before returning the
// callback.  Using a callback on each call to this function allows this
// without getting a huge call stack.
spriteSet.prototype.loadJSON = function(data, callback){
	var me = this;
	var key = Object.keys(data)[0];
	var rfunc;

	if(key != undefined){
		var val = data[key];
		delete data[key];
		rfunc = () => {
			setTimeout( () => { me.loadJSON(data, callback);}, 0);
		};

		switch(key.toLowerCase()){
			case 'image':
				this.setImage(val, rfunc);
				break;
			case 'framewidth':
				this.frameWidth = 1 * val;
				rfunc();
				break;
			case 'frameheight':
				this.frameHeight = 1 * val;
				rfunc();
				break;
			case 'centerx': case 'cx':
				this.centerx = 1 * val;
				rfunc();
				break;
			case 'centery': case 'cy':
				this.centery = 1 * val;
				rfunc();
				break;
			case 'framerate':
				this.defaultFrameRate = 1 * val;
				rfunc();
				break;
			case 'frames':
				this.load_frames(val);
				rfunc();
				break;
			case 'sequences':
				this.load_sequences(val);
				rfunc();
				break;
			default:
				rfunc();
		}
	}else if(callback != undefined){
		callback.call(this, data);
	}
};

spriteSet.prototype.setFrameSize = function(w, h){
	this.frameWidth = w;
	this.frameHeight = h;
};

// load animation sequences from a JSON object
spriteSet.prototype.load_sequences = function(data){
	var name, param, newSequence, n;

	for(name in data){
		newSequence = {
			'name': name,
			'frames':[],
			'frameRate': this.defaultFrameRate
		};
		for(param in data[name]){
			switch(param.toLowerCase()){
				case 'frames':
					for(n = 0; n < data[name][param].length; n++){
						newSequence.frames[n] = data[name][param][n];
					}
					break;
				case 'framerate':
					newSequence.frameRate = 1 * data[name][param];
					break;
			}
		}
		this.sequences[newSequence.name] = newSequence;
	}
};

// load frames from a JSON object passed in
spriteSet.prototype.load_frames = function(data){
	var name, arg;
	for(name in data){
		this.frames[name] = {
			'x': 0,
			'y': 0,
			'width': this.frameWidth,
			'height': this.frameHeight,
			'centerx': this.centerx,
			'centery': this.centery,
			'drawOffset' : {x : 0, y : 0}
		};
		this.frameNames[this.frameNames.length] = name;
		for(arg in data[name]){
			switch(arg.toLowerCase()){
				case 'width':
					this.frames[name].width = 1 * data[name][arg];
					break;
				case 'height':
					this.frames[name].height = 1 * data[name][arg];
					break;
				case 'x':
					this.frames[name]['x'] += this.frameWidth * data[name][arg];
					break;
				case 'xoffset':
					this.frames[name]['x'] += 1 * data[name][arg];
					break;
				case 'y':
					this.frames[name]['y'] += this.frameHeight * data[name][arg];
					break;
				case 'yoffset':
					this.frames[name]['y'] += 1 * data[name][arg];
					break;
				case 'centerx': case 'cx':
					this.frames[name]['centerx'] = 1 * data[name][arg];
					break;
				case 'centery': case 'cy':
					this.frames[name]['centery'] = 1 * data[name][arg];
					break;
				case 'drawoffset':
					this.frames[name].drawOffset = data[name][arg];
					break;
			}
		}
	}
};

spriteSet.prototype.setImage = function(filename, callback){
	this.image = new Image();
	if(typeof(callback) == 'function'){
		this.image.onload = callback;
	}
	this.image.src = filename;
};
