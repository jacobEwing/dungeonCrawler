var mouseHandler = function(){
};

mouseHandler.prototype.listen = function(element){
	var evt;
	var eventChecks = {
		'mousedown' : this.handleMouseDown,
		'mouseup' : this.handleMouseUp
	};
	for(evt in eventChecks){
		element.addEventListener(evt, eventChecks[evt]);
	}
}


