'use strict';

class MouseHandler {
	constructor(){
		this.isDown = false;
		this.lastEvent = null;
		this.handlers = {
			mousedown : [],
			mousemove : [],
			mouseup   : []
		};
	}

	on(eventName, handler){
		if(!this.handlers[eventName]){
			throw new Error("MouseHandler.on: unknown event '" + eventName + "'");
		}
		this.handlers[eventName].push(handler);
	}

	fire(eventName, e){
		var list = this.handlers[eventName];
		for(var n = 0; n < list.length; n++){
			list[n](e);
		}
	}

	listen(element){
		var me = this;
		var events = ['mousedown', 'mousemove', 'mouseup'];
		events.forEach(function(name){
			element.addEventListener(name, function(e){
				me.lastEvent = e;
				if(name === 'mousedown' && (e.buttons & 1)) me.isDown = true;
				if(name === 'mouseup'   && !(e.buttons & 1)) me.isDown = false;
				me.fire(name, e);
			});
		});
	}
}
