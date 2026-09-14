'use strict';

window.addEventListener('load', function(){
	var canvas = document.getElementById('gameCanvas');
	var overlay = document.getElementById('overlay');
	var game = new Game(canvas, overlay);
	window.__game = game;    // debug hook
	game.init().catch(function(e){
		console.error("Fatal error during initialization:", e);
	});
});