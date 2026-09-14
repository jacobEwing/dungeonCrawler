'use strict';

// ============================================================================
// renderView — factory, closed over per-frame state
// ============================================================================

function createRenderView(game){
	var frameName;
	var playerLayer;
	var topLayer;
	var randomKey, worldPosition, treeFrame;
	var x, y, mapX, mapY, gridX, gridY, n;
	var itemsIndex;

	var renderCell = function(area, sprite, underlay){
		underlay = underlay == undefined ? false : (underlay ? true : false);
		var bitsum, readX, readY;
		var neighbourList = {
			1 : {dx : 0, dy : -1},
			2 : {dx : -1, dy : 0},
			4 : {dx : 1, dy : 0},
			8 : {dx : 0, dy : 1}
		};
		switch(sprite){
			case 'water':
				var r = mapX + mapY * area.map.length;
				r = Math.sin(r) + 1;
				r *= 500;
				r -= Math.floor(r);
				r *= 100;
				r = Math.floor(r);
				r = (r + game.waterCycle) % 20;
				if(r < 5){
					game.sprites.waterWaves.setFrame(r);
				}else{
					game.sprites.waterWaves.setFrame(5);
				}
				game.sprites.waterWaves.setPosition(gridX, gridY, false);
				game.sprites.waterWaves.draw(game.ctx);
				break;
			case 'sand':
				var otherTexture = 'sand';
				bitsum = 0;
				for(n in neighbourList){
					readX = mapX + neighbourList[n].dx;
					readY = mapY + neighbourList[n].dy;
					if(readX < 0 || readY < 0 || readX > area.map.length || readY > area.map[0].length){
						bitsum += 1 * n;
					}else if(area.spritemap[area.map[readX][readY]] == 'sand'){
						bitsum += 1 * n;
					}else{
						otherTexture = area.spritemap[area.map[readX][readY]];
					}
				}
				if(otherTexture != 'sand'){
					renderCell(area, otherTexture, true);
				}

				switch(bitsum){
					case 3:
						game.sprites.sandTiles.setFrame('corner');
						game.sprites.sandTiles.rotation = Math.PI;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 5:
						game.sprites.sandTiles.setFrame('corner');
						game.sprites.sandTiles.rotation = 3 * Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 10:
						game.sprites.sandTiles.setFrame('corner');
						game.sprites.sandTiles.rotation = Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 12:
						game.sprites.sandTiles.setFrame('corner');
						game.sprites.sandTiles.rotation = 0;
						game.sprites.sandTiles.setPosition(gridX, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 7:
						game.sprites.sandTiles.setFrame('edge');
						game.sprites.sandTiles.rotation = 3 * Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 13:
						game.sprites.sandTiles.setFrame('edge');
						game.sprites.sandTiles.rotation = 0;
						game.sprites.sandTiles.setPosition(gridX, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 14:
						game.sprites.sandTiles.setFrame('edge');
						game.sprites.sandTiles.rotation = Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 11:
						game.sprites.sandTiles.setFrame('edge');
						game.sprites.sandTiles.rotation = Math.PI;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 1:
						game.sprites.sandTiles.setFrame('tip');
						game.sprites.sandTiles.rotation = Math.PI;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 2:
						game.sprites.sandTiles.setFrame('tip');
						game.sprites.sandTiles.rotation = Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 4:
						game.sprites.sandTiles.setFrame('tip');
						game.sprites.sandTiles.rotation = 3 * Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX, gridY + cellSize, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 8:
						game.sprites.sandTiles.setFrame('tip');
						game.sprites.sandTiles.rotation = 0;
						game.sprites.sandTiles.setPosition(gridX, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 9:
						game.sprites.sandTiles.setFrame('wall');
						game.sprites.sandTiles.rotation = 0;
						game.sprites.sandTiles.setPosition(gridX, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 6:
						game.sprites.sandTiles.setFrame('wall');
						game.sprites.sandTiles.rotation = Math.PI / 2;
						game.sprites.sandTiles.setPosition(gridX + cellSize, gridY, false);
						game.sprites.sandTiles.draw(game.ctx);
						break;
					case 15:
						game.sprites.sand.drawRandomArea(game.ctx, gridX, gridY, cellSize, cellSize, randomKey);
						break;
				}
				break;
			case 'stone floor':
				game.sprites.ground.rotate(Math.floor(randomKey * 4) * Math.PI / 2);
				game.sprites.ground.drawRandomArea(game.ctx, gridX, gridY, cellSize, cellSize, randomKey);
				break;
			case 'stone wall':
				if(mapY == area.map[0].length || area.spritemap[area.map[mapX][mapY + 1]] != 'stone wall'){
					game.sprites.stone.setFrame(Math.floor(randomKey * 10) + 10);
				}else{
					game.sprites.stone.setFrame(Math.floor(randomKey * 10));
				}
				game.sprites.stone.draw(game.ctx, {x : gridX, y : gridY});
				break;
			case 'trees':
				game.sprites.grass.rotate(Math.PI / 2);
				game.sprites.grass.drawRandomArea(game.ctx, gridX, gridY, cellSize, cellSize, randomKey);

				if(randomKey < 0.1){
					treeFrame = 1;
				}else if(randomKey < .36){
					treeFrame = 2;
				}else if(randomKey < .53){
					treeFrame = 3;
				}else if(randomKey < .8){
					treeFrame = 4;
				}else{
					treeFrame = 5;
				}
				playerLayer[playerLayer.length] = {
					doing : 'tree',
					sprite : game.sprites.tree,
					frame : 'trunk' + treeFrame,
					x : gridX,
					y : gridY
				};
				topLayer[topLayer.length] = {
					sprite : game.sprites.tree,
					frame : 'greens' + treeFrame,
					x : gridX,
					y : gridY
				};
				break;
			case 'grass':
				game.sprites.grass.rotate(Math.PI / 2);
				game.sprites.grass.drawRandomArea(game.ctx, gridX, gridY, cellSize, cellSize, randomKey);

				if(!underlay && randomKey < .5){
					var brushFrame = 100 * randomKey;
					brushFrame = Math.floor(Math.abs(9 * Math.sin(brushFrame - Math.floor(brushFrame))));
					playerLayer[playerLayer.length] = {
						doing : 'grass',
						sprite : game.sprites.longGrass,
						frame : brushFrame,
						x : gridX,
						y : gridY
					};
				}
				break;
		}
		if(game.showGameGrid){
			game.ctx.strokeStyle = "rgba(0,0,0, 0.2)";
			game.ctx.strokeRect(gridX * gameScale, gridY * gameScale, cellSize * gameScale, cellSize * gameScale);
		}
	};

	return function(area){
		var o;
		playerLayer = [];
		topLayer = [];

		itemsIndex = {};
		for(var itemName in area.items){
			var itemList = area.items[itemName];
			for(var ii = 0; ii < itemList.length; ii++){
				var it = itemList[ii];
				var ikey = it.x + ',' + it.y;
				if(itemsIndex[ikey] == undefined) itemsIndex[ikey] = [];
				itemsIndex[ikey].push(it);
			}
		}

		worldPosition = {
			x : game.player.position.x % cellSize,
			y : game.player.position.y % cellSize
		};
		game.ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);

		var middleX = Math.floor(game.screenMiddle.x / (gameScale * cellSize)) + 1;
		var middleY = Math.floor(game.screenMiddle.y / (gameScale * cellSize)) + 1;

		for(y = -1; y <= game.viewRange.height + 1; y++){
			mapY = game.player.mapPos.y + y - middleY;
			if(mapY < 0 || mapY > area.map[0].length - 1) continue;

			for(x = -1; x <= game.viewRange.width + 1; x++){
				mapX = game.player.mapPos.x + x - middleX;
				if(mapX < 0 || mapX > area.map.length - 1) continue;

				if(area.hideMap[mapX][mapY] === true){
					continue;
				}

				gridX = x * cellSize - worldPosition.x;
				gridY = y * cellSize - worldPosition.y;

				randomKey = Math.abs(Math.sin(mapX + mapY * area.map.length) * 10000);
				randomKey -= Math.floor(randomKey);
				renderCell(area, area.spritemap[area.map[mapX][mapY]]);

				var cellItems = itemsIndex[mapX + ',' + mapY];
				if(cellItems != undefined){
					for(var ci = 0; ci < cellItems.length; ci++){
						var cellItem = cellItems[ci];
						frameName = {
							'stairup' : 'stairsUp',
							'stairdown' : 'stairsDown',
							'caveEntrance' : 'caveEntrance'
						}[cellItem.content];
						switch(frameName){
							case 'stairsUp': case 'stairsDown':
								game.sprites.dungeonElements.setFrame(frameName);
								game.sprites.dungeonElements.draw(game.ctx, {x : gridX, y: gridY});
								break;
							case 'caveEntrance':
								game.sprites.caveEntrance.setFrame(frameName);
								game.sprites.caveEntrance.draw(game.ctx, {x : gridX, y : gridY});
						}
					}
				}
			}
		}

		for(o of playerLayer){
			o.sprite.setFrame(o.frame);
			o.sprite.draw(game.ctx, { x : o.x, y : o.y });
		}

		// Dim every cell that has been seen but is not currently visible.
		// Batched into a single path so it's a single fill call.
		game.ctx.save();
		game.ctx.beginPath();

		for(y = -1; y <= game.viewRange.height + 1; y++){
			mapY = game.player.mapPos.y + y - middleY;
			if(mapY < 0 || mapY > area.map[0].length - 1) continue;

			for(x = -1; x <= game.viewRange.width + 1; x++){
				mapX = game.player.mapPos.x + x - middleX;
				if(mapX < 0 || mapX > area.map.length - 1) continue;

				if(area.hideMap[mapX][mapY] === true) continue;
				if(game.isCellCurrentlyVisible(mapX, mapY)) continue;
				if(game.hasVisibleNeighbour(mapX, mapY)) continue;

				gridX = x * cellSize - worldPosition.x;
				gridY = y * cellSize - worldPosition.y;

				game.ctx.rect(
					gridX * gameScale,
					gridY * gameScale,
					cellSize * gameScale,
					cellSize * gameScale
				);
			}
		}
		game.ctx.fillStyle = 'rgba(0, 0, 0, ' + VISIBILITY_DIM_ALPHA + ')';
		game.ctx.fill();



		game.ctx.beginPath();

		for(y = -1; y <= game.viewRange.height + 1; y++){
			mapY = game.player.mapPos.y + y - middleY;
			if(mapY < 0 || mapY > area.map[0].length - 1) continue;

			for(x = -1; x <= game.viewRange.width + 1; x++){
				mapX = game.player.mapPos.x + x - middleX;
				if(mapX < 0 || mapX > area.map.length - 1) continue;

				if(area.hideMap[mapX][mapY] === true) continue;
				if(game.isCellCurrentlyVisible(mapX, mapY)) continue;
				if(!game.hasVisibleNeighbour(mapX, mapY)) continue;

				gridX = x * cellSize - worldPosition.x;
				gridY = y * cellSize - worldPosition.y;

				game.ctx.rect(
					gridX * gameScale,
					gridY * gameScale,
					cellSize * gameScale,
					cellSize * gameScale
				);
			}
		}

		game.ctx.fillStyle = 'rgba(0, 0, 0, ' + (VISIBILITY_DIM_ALPHA * DIM_NEAR_FACTOR) + ')';
		game.ctx.fill();



		game.ctx.restore();


		if(game.player.walkPath.length > 0){
			var pointerx = cellSize * middleX + game.player.walkPath[game.player.walkPath.length - 1].x - game.player.position.x;
			var pointery = cellSize * middleY + game.player.walkPath[game.player.walkPath.length - 1].y - game.player.position.y;
			game.mousePointers.target.draw(game.ctx, { x : pointerx, y : pointery });
		}else if(game.player.target != null){
			var pointerx2 = cellSize * middleX + game.player.target.x - game.player.position.x;
			var pointery2 = cellSize * middleY + game.player.target.y - game.player.position.y;
			game.mousePointers.target.draw(game.ctx, { x : pointerx2, y : pointery2 });
		}

		for(o of game.characters){
			if(!game.isCellCurrentlyVisible(o.mapPos.x, o.mapPos.y)) continue;

			var offset = {
				x : o.sprite.frameWidth >> 1,
				y : o.sprite.frameHeight - 1
			};
			o.sprite.draw(game.ctx, {
				x : cellSize * middleX + o.position.x - game.player.position.x - offset.x,
				y : cellSize * middleY + o.position.y - game.player.position.y - offset.y
			});
		}

		game.player.sprite.setPosition(
			cellSize * middleX - (game.player.sprite.frameWidth >> 1),
			cellSize * middleY - game.player.sprite.frameHeight + 1,
			1
		);
		game.player.sprite.draw(game.ctx);

		for(o of topLayer){
			o.sprite.setFrame(o.frame);
			o.sprite.draw(game.ctx, { x : o.x, y : o.y });
		}

		// --- damage vignette ---
		if(game.player && game.player.damageFlash > 0){
			var alpha = Math.min(0.6, game.player.damageFlash * 2);
			game.ctx.save();
			game.ctx.fillStyle = 'rgba(180, 0, 0, ' + alpha + ')';
			game.ctx.fillRect(0, 0, game.canvas.width, game.canvas.height);
			game.ctx.restore();
		}

		// --- HP readout ---
		if(game.player && game.player.isAlive){
			var hpText = 'HP ' + game.player.health + '/' + game.player.maxHealth;
			game.ctx.save();
			game.ctx.font = '14px monospace';
			game.ctx.fillStyle = '#000';
			game.ctx.fillText(hpText, 11, 21);
			game.ctx.fillStyle = '#FFF';
			game.ctx.fillText(hpText, 10, 20);
			game.ctx.restore();
		}

		// --- Gold readout ---
		if(game.player){
			var goldText = 'Gold ' + game.player.gold;
			game.ctx.save();
			game.ctx.font = '14px monospace';
			game.ctx.fillStyle = '#000';
			game.ctx.fillText(goldText, 11, 41);
			game.ctx.fillStyle = '#FFD700';
			game.ctx.fillText(goldText, 10, 40);
			game.ctx.restore();
		}
	};
}
