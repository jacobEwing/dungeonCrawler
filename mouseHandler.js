var mouseHandler = function(){
	this.stateQueue = [];
	var n;
	for(n = 0; n < 5; n++){
		this.stateQueue[this.stateQueue.length] = {time : 0, e : {}};
	}
};

mouseHandler.prototype.listen = function(element){
	var evt, me = this;
	var eventChecks = {
		'mousemove' : 'handleMouseMove',
		'mousedown' : 'handleMouseDown',
		'mouseup' : 'handleMouseUp'
	};
	for(evt in eventChecks){
		element.addEventListener(evt, function(e){me.handleEvent.call(me, e)});
	}
}

mouseHandler.prototype.handleEvent = function(e){
	var delta;
	if(this.stateQueue[0].e.buttons == e.buttons){
		this.stateQueue[0] = {
			time : Date.now(),
			e : e
		}
	}else{
		this.stateQueue.pop();
		this.stateQueue.unshift({
			time : Date.now(),
			e : e
		});
	}
}
/*

 assssigned from game.js

 sprites:
 mouse.pointers.target

*/
