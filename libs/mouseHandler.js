'use strict';

var mouseHandler = function(){
	this.isDown = false;
	this.lastEvent = null;
	this.handlers = {
		mousedown : [],
		mousemove : [],
		mouseup   : []
	};
};

mouseHandler.prototype.on = function(eventName, handler){
	if(!this.handlers[eventName]){
		throw new Error("mouseHandler.on: unknown event '" + eventName + "'");
	}
	this.handlers[eventName].push(handler);
};

mouseHandler.prototype.fire = function(eventName, e){
	var list = this.handlers[eventName];
	for(var n = 0; n < list.length; n++){
		list[n](e);
	}
};

mouseHandler.prototype.listen = function(element){
	var me = this;
	var events = ['mousedown', 'mousemove', 'mouseup'];
	events.forEach(function(name){
		element.addEventListener(name, function(e){
			me.lastEvent = e;
			if(name === 'mousedown' && (e.buttons & 1)) me.isDown = true;
			if(name === 'mouseup' && !(e.buttons & 1))    me.isDown = false;
			me.fire(name, e);
		});
	});
};