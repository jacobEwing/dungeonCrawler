'use strict';

// ============================================================================
// Game
// ============================================================================

class Game {
	constructor(canvas, overlay){
		this.canvas = canvas;
		this.overlay = overlay;
		this.ctx = canvas.getContext('2d');

		this.spriteSets = {};
		this.sprites = {};
		this.mousePointers = {};
		this.playerSpriteSet = new spriteSet();

		this.maps = [];
		this.activeMap = null;
		this.player = null;

		this.viewRange = {};
		this.screenMiddle = { x : 0, y : 0 };
		this.showGameGrid = false;
		this.isTransitioning = false;

		this.keyboard = null;
		this.mouse = null;
		this.lastFrameTime = 0;
		this.gamePaused = false;

		this.waterCycle = 0;
		this.waterCycleAccum = 0;

		this.renderView = createRenderView(this);
	}

	// Entities belong to the map they were spawned on.  Reading game.characters
	// returns the active map's entity list.  Writing to it (via push, splice, etc.)
	// modifies that same list.  When the player transitions to a new map, the
	// old map's entities stop being updated and stop rendering, but stay intact
	// for when the player returns.
	get characters(){
		return this.activeMap ? this.activeMap.entities : [];
	}

	// ------------------------------------------------------------------
	// initialization
	// ------------------------------------------------------------------

	async init(){
		this.setupCanvas();
		//this.writeText(5, 5, "DungeonCrawler v.0.0");

		try {
			await this.loadSpriteSets();
			await this.loadPlayerSprite();
			await this.loadMap('maps/Map2.map');
			for(let n = 0; n < 3; n++){
				let theta = Math.random() * 2 * Math.PI;
				let radius = 3 + Math.floor(Math.random() * 3);
				let dx = Math.floor(Math.sin(theta) * radius);
				let dy = Math.floor(Math.cos(theta) * radius);

				await this.spawnEntity(Enemy, n % 2 ? 'sprites/knight.sprite' : 'sprites/humanFemale.sprite', {
					x : this.activeMap.playerPos.x + dx,
					y : this.activeMap.playerPos.y + dy,
					speed : 20,
					vision: 4
				});
			}


			this.initializeEvents();
			await this.loadMousePointers();

			this.startGameLoop();
		} catch(e){
			console.error("Initialization failed:", e);
			throw e;
		}
	}

	setupCanvas(){
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;

		this.screenMiddle = { x : this.canvas.width >> 1, y : this.canvas.height >> 1 };
		this.viewRange = {
			width:  Math.ceil(this.canvas.width  / (gameScale * cellSize)) + 1,
			height: Math.ceil(this.canvas.height / (gameScale * cellSize)) + 1
		};

		this.ctx.webkitImageSmoothingEnabled = false;
		this.ctx.mozImageSmoothingEnabled = false;
		this.ctx.imageSmoothingEnabled = false;

		window.addEventListener('resize', () => this.handleResize());
	}

	async loadSpriteSets(){
		var spriteList = [
			{'name' : 'grass', 'file' : 'grass.sprite'},
			{'name' : 'tree', 'file' : 'tree.sprite'},
			{'name' : 'stone', 'file': 'stone.sprite'},
			{'name' : 'ground', 'file' : 'ground.sprite'},
			{'name' : 'sand', 'file' : 'sand.sprite'},
			{'name' : 'sandTiles', 'file' : 'sandTiles.sprite'},
			{'name' : 'dungeonElements', 'file' : 'dungeonElements.sprite'},
			{'name' : 'longGrass', 'file' : 'longGrass.sprite'},
			{'name' : 'caveEntrance' , 'file' : 'caveEntrance.sprite'},
			{'name' : 'waterWaves' , 'file' : 'waterWaves.sprite'},
			{'name' : 'rat', 'file' : 'rat.sprite'}
		];

		while(spriteList.length > 0){
			const dat = spriteList.pop();
			const set = new spriteSet();
			await set.load('sprites/' + dat.file);
			this.spriteSets[dat.name] = set;
			this.sprites[dat.name] = new cSprite(set);
			this.sprites[dat.name].setScale(gameScale);
		}

		this.sprites.waterWaves.setFrame('0');
	}

	async loadPlayerSprite(){
		this.player = new Player(this);

		await this.playerSpriteSet.load("sprites/player.sprite");
		this.player.sprite = new cSprite(this.playerSpriteSet);
		this.player.sprite.setScale(gameScale);
		this.player.sprite.setPosition(this.screenMiddle.x, this.screenMiddle.y, true);
		this.player.sprite.setFrame('front_idle');
	}

	// Load (and cache) a spriteSet by name.  If it's already loaded, returns the
	// cached instance.
	async loadSpriteSet(name, file){
		if(this.spriteSets[name] != undefined) return this.spriteSets[name];
		const set = new spriteSet();
		await set.load(file);
		this.spriteSets[name] = set;
		return set;
	}

	// Spawn an Entity subclass into the world.  Class must be a subclass of
	// Entity.  spriteFile is a path like 'sprites/rat.sprite'.  options are
	// passed through to the entity's constructor and can also include x, y,
	// initialFrame, and spriteName.
	async spawnEntity(Class, spriteFile, options){
		options = options || {};
		if(!this.activeMap){
			throw new Error("spawnEntity: cannot spawn before a map is loaded");
		}

		var setName = options.spriteName != undefined
			? options.spriteName
			: spriteFile.replace(/^.*\//, '').replace(/\.sprite$/, '');

		var set = await this.loadSpriteSet(setName, spriteFile);

		var entity = new Class(this, options);
		entity.sprite = new cSprite(set);
		entity.sprite.setScale(gameScale);
		entity.sprite.setFrame(options.initialFrame || 'front_idle');

		if(options.x != undefined && options.y != undefined){
			entity.setMapPos(options.x, options.y);
		}

		this.characters.push(entity);
		return entity;
	}

	async loadMap(mapFile){
		const map = new mapBuilder();
		await map.loadImageMap(mapFile);
		this.maps.push(map);
		this.activeMap = map;

		this.player.position.x = Math.floor(cellSize * (this.activeMap.playerPos.x + .5));
		this.player.position.y = Math.floor(cellSize * (this.activeMap.playerPos.y + .5));
		this.player.mapPos = {
			x : this.activeMap.playerPos.x,
			y : this.activeMap.playerPos.y
		};
		this.player.skills.vision = 5;

		for(let x = 0; x < this.activeMap.width; x++){
			for(let y = 0; y < this.activeMap.height; y++){
				this.activeMap.hideMap[x][y] = false;
			}
		}

		this.renderView(this.activeMap);
	}

	initializeEvents(){
		this.keyboard = new KeyboardListener();
		this.keyboard.listen();
		this.keyboard.onCombo(['CTRL', 'G'], () => {
			this.showGameGrid = !this.showGameGrid;
		});

		this.overlay.addEventListener('contextmenu', (e) => e.preventDefault());

		this.mouse = new MouseHandler();
		this.mouse.lastTarget = null;
		this.mouse.consumedByInteraction = false;
		this.mouse.listen(this.overlay);
		this.mouse.on('mousedown', (e) => this.handlePointerDown(e));
		this.mouse.on('mousemove', (e) => {
			if(this.mouse.isDown) this.handlePointer(e);
		});
		this.mouse.on('mouseup', (e) => {
			this.mouse.lastTarget = null;
			this.mouse.consumedByInteraction = false;
		});
	}

	async loadMousePointers(){
		var pointerList = [
			{'name' : 'target', 'file' : 'target.sprite'}
		];

		while(pointerList.length > 0){
			const dat = pointerList.pop();
			const set = new spriteSet();
			await set.load('sprites/' + dat.file);
			this.mousePointers[dat.name] = new cSprite(set);
			this.mousePointers[dat.name].setScale(gameScale);
		}

		this.mousePointers['target'].startSequence('spin', {
			iterations: 0,
			method : 'manual'
		});
	}

	// ------------------------------------------------------------------
	// the loop
	// ------------------------------------------------------------------

	startGameLoop(){
		this.lastFrameTime = 0;
		requestAnimationFrame((t) => this.loop(t));
	}

	loop(time){
		if(this.lastFrameTime === 0) this.lastFrameTime = time;
		var dt = (time - this.lastFrameTime) / 1000;
		this.lastFrameTime = time;

		if(dt > 0.1) dt = 0.1;

		if(!this.gamePaused && this.activeMap != null){
			this.playGame(dt);
		}

		requestAnimationFrame((t) => this.loop(t));
	}

	playGame(dt){
		var n;

		if(this.mouse != null && this.mouse.isDown && !this.mouse.consumedByInteraction && this.mouse.lastEvent != null){
			this.handlePointer(this.mouse.lastEvent);
		}

		this.player.act(dt);
		for(n = 0; n < this.characters.length; n++){
			this.characters[n].act(dt);
		}

		// advance the water animation by wall-clock time
		this.waterCycleAccum += dt * waterCycleRate;
		while(this.waterCycleAccum >= 1){
			this.waterCycleAccum -= 1;
			this.waterCycle++;
		}

		// Convert dead enemies into corpses; keep corpses in the world.
		for(var n = this.characters.length - 1; n >= 0; n--){
			var c = this.characters[n];
			if(c.isAlive) continue;
			if(c.category === 'corpse') continue;
			if(c === this.player) continue;

			this.spawnCorpseFor(c);
			this.characters.splice(n, 1);
		}

		this.renderView(this.activeMap);
	}

	// ------------------------------------------------------------------
	// input handling
	// ------------------------------------------------------------------
	handlePointer(e){
		if(!(e.buttons & 1)) return;

		var delta = this.player.distanceToMouseEvent(e);

		// The world-space point under the cursor.  This is the quantity that
		// actually needs to change before we re-run pathfinding — it changes
		// when the mouse moves AND when the player walks, but stays constant
		// when both are still, which is the case we want to short-circuit.
		var worldTarget = {
			x : this.player.position.x + delta.x,
			y : this.player.position.y + delta.y
		};

		if(
			this.mouse.lastTarget != null
			&& this.mouse.lastTarget.x === worldTarget.x
			&& this.mouse.lastTarget.y === worldTarget.y
		){
			return;
		}
		this.mouse.lastTarget = worldTarget;

		if(delta.x * delta.x + delta.y * delta.y < cellSize * cellSize){
			// clicked on the cell we're standing on
			if(!this.handleActiveCellClick()){
				this.player.setTarget(delta.x, delta.y);
			}
		}else{
			this.player.setTarget(delta.x, delta.y);
		}
	}

	handlePointerDown(e){
		if(!(e.buttons & 1)) return;

		var delta = this.player.distanceToMouseEvent(e);
		var worldX = this.player.position.x + delta.x;
		var worldY = this.player.position.y + delta.y;

		var clickTarget = this.findClickTarget(worldX, worldY);
		if(clickTarget && this.interactWith(clickTarget)){
			this.mouse.consumedByInteraction = true;
			this.mouse.lastTarget = { x : worldX, y : worldY };
			return;
		}

		// No interactive target under the cursor — treat the press as the start
		// of a normal walk.
		this.mouse.consumedByInteraction = false;
		this.handlePointer(e);
	}

	handleActiveCellClick(){
		var items = this.player.touchingItems();

		for(var item of items){
			// Corpse entities
			if(item.category === 'corpse'){
				this.lootCorpse(item);
				continue;
			}

			// Map items with a .content string
			switch(item.content){
				case 'stairup':
				case 'stairdown':
				case 'caveEntrance':
					this.useEntrance(item);
					break;
				default:
					console.log(item.content);
			}
		}

		return items.length;
	}

	findClickTarget(worldX, worldY){
		var padding = 4;   // world pixels of extra hit area around each sprite

		var best = null;
		var bestDistSq = Infinity;

		for(var n = 0; n < this.characters.length; n++){
			var c = this.characters[n];
			if(c === this.player) continue;

			if(this.pointInEntityBounds(c, worldX, worldY, padding)){
				var dx = c.position.x - this.player.position.x;
				var dy = c.position.y - this.player.position.y;
				var d2 = dx * dx + dy * dy;
				if(d2 < bestDistSq){
					bestDistSq = d2;
					best = c;
				}
			}
		}

		if(best != null) return { type : 'entity', target : best };
		return null;
	}

	pointInEntityBounds(entity, worldX, worldY, padding){
		// Sprites are anchored center-bottom at entity.position.  See the draw
		// offsets in renderView: x -= frameWidth/2, y -= frameHeight - 1.
		var halfW  = entity.sprite.frameWidth / 2;
		var height = entity.sprite.frameHeight;

		var cx = entity.position.x;
		var cy = entity.position.y;

		return worldX >= cx - halfW - padding
			&& worldX <= cx + halfW + padding
			&& worldY >= cy - height - padding
			&& worldY <= cy + padding;
	}

	interactWith(clickTarget){
		if(clickTarget.type !== 'entity') return false;

		var target = clickTarget.target;
		var player = this.player;

		var dx = target.position.x - player.position.x;
		var dy = target.position.y - player.position.y;
		var distSq = dx * dx + dy * dy;
		var rangeSq = player.attackRange * player.attackRange;

		if(distSq > rangeSq) return false;

		// Corpses are lootable, not attackable.
		if(target.category === 'corpse'){
			this.lootCorpse(target);
			return true;
		}

		// Living entities are attacked.  Face them, then swing.
		var oct = computeWalkOctant(dx, dy);
		if(oct != null) player.facing = oct;

		return player.startAttack();
	}

	spawnCorpseFor(deadEntity){
		var corpse = new Corpse(this, {
			facing      : deadEntity.facing,
			possessions : deadEntity.possessions
		});

		// Reuse the dead entity's sprite template (image + frame definitions),
		// but as a fresh sprite instance so its animation state doesn't
		// bleed over from the death frame.
		corpse.sprite = new cSprite(deadEntity.sprite.template);
		corpse.sprite.setScale(gameScale);

		// Show the idle frame in the direction the entity died facing.  A
		// proper death sprite would be better; this is a placeholder that
		// reads as "a knight, standing still, dead."
		corpse.sprite.setFrame(WALK_SEQUENCES[deadEntity.facing][1]);

		// Snap to the exact pixel where the entity fell, not the cell center.
		corpse.position.x = deadEntity.position.x;
		corpse.position.y = deadEntity.position.y;
		corpse.mapPos.x = deadEntity.mapPos.x;
		corpse.mapPos.y = deadEntity.mapPos.y;

		this.characters.push(corpse);
		return corpse;
	}

	lootCorpse(corpse){
		var lootedAny = false;

		for(var item of corpse.possessions){
			if(item.name === 'gold'){
				this.player.gold += item.amount;
				console.log('Picked up ' + item.amount + ' gold.');
				lootedAny = true;
			}else{
				this.player.possessions.push(item);
				console.log('Picked up: ' + (item.name || 'item'));
				lootedAny = true;
			}
		}

		if(!lootedAny){
			console.log('Corpse is empty.');
		}
		corpse.possessions = [];

		// Remove the corpse from the world after looting, whether or not
		// anything was actually in it.
		var idx = this.characters.indexOf(corpse);
		if(idx !== -1) this.characters.splice(idx, 1);
	}

	// ------------------------------------------------------------------
	// map transitions
	// ------------------------------------------------------------------

	useEntrance(entrance){
		if(this.isTransitioning) return;
		this.isTransitioning = true;

		if(entrance.target == undefined){
			var mapIdx = this.maps.length;
			this.maps[mapIdx] = new mapBuilder();
			this.maps[mapIdx].build({
				category : 'dungeon',
				width : 30,
				height: 30,
				roomscale: .8,
				stairup: true,
				stairdown: true
			});
			entrance.target = this.maps[mapIdx];

			var linkTarget = (oppositeKey) => {
				var opposite = entrance.target.items[oppositeKey];
				if(opposite == undefined || opposite.length === 0) return;
				entrance.target.playerPos = {
					x : opposite[0].x,
					y : opposite[0].y
				};
				if(opposite[0].target == undefined){
					opposite[0].target = this.activeMap;
				}
			};

			switch(entrance.content){
				case 'stairup':     linkTarget('stairdown'); break;
				case 'stairdown':   linkTarget('stairup');   break;
				case 'caveEntrance':linkTarget('stairup');   break;
			}
		}

		this.player.target = null;
		this.gamePaused = true;

		var opacity = 1, faderate = .2;
		this.canvas.style.opacity = opacity;

		var fadeOut = () => {
			opacity -= faderate;
			this.canvas.style.opacity = opacity;
			if(opacity > faderate){
				setTimeout(fadeOut, 30);
			}else{
				this.activeMap = entrance.target;
				this.player.setMapPos(this.activeMap.playerPos.x, this.activeMap.playerPos.y);
				this.player.position.x += cellSize >> 1;
				this.player.position.y += cellSize >> 1;
				this.checkOverlay();
				this.renderView(this.activeMap);
				this.gamePaused = false;
				this.canvas.style.opacity = 0;
				setTimeout(fadeIn, 500);
			}
		};

		var fadeIn = () => {
			opacity += faderate;
			this.canvas.style.opacity = opacity;
			if(opacity < 1){
				setTimeout(fadeIn, 30);
			}else{
				this.canvas.style.opacity = 1;
				this.isTransitioning = false;
			}
		};

		fadeOut();
	}

	// ------------------------------------------------------------------
	// overlay / fog of war
	// ------------------------------------------------------------------

	checkOverlay(){
		var x, y, cx, cy;
		for(x = -this.player.skills.vision; x <= this.player.skills.vision; x++){
			cx = x + this.player.mapPos.x;
			if(cx >= 0 && cx < this.activeMap.width){
				for(y = -this.player.skills.vision; y <= this.player.skills.vision; y++){
					cy = y + this.player.mapPos.y;
					if(cy >= 0 && cy < this.activeMap.height){
						if(squareDistance(x, y, 0, 0) < Math.pow(this.player.skills.vision, 2)){
							this.activeMap.hideMap[cx][cy] = false;
						}
					}
				}
			}
		}
	}

	// ------------------------------------------------------------------
	// misc
	// ------------------------------------------------------------------

	handleResize(){
		if(this.canvas == undefined) return;
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		this.screenMiddle = { x : this.canvas.width >> 1, y : this.canvas.height >> 1 };
		this.viewRange = {
			width:  Math.ceil(this.canvas.width  / (gameScale * cellSize)) + 1,
			height: Math.ceil(this.canvas.height / (gameScale * cellSize)) + 1
		};
		// canvas resize resets context state — re-disable smoothing
		this.ctx.webkitImageSmoothingEnabled = false;
		this.ctx.mozImageSmoothingEnabled = false;
		this.ctx.imageSmoothingEnabled = false;

		if(this.activeMap != undefined){
			this.renderView(this.activeMap);
		}
	}

	writeText(x, y, text){
		var shadow = document.createElement('span');
		shadow.textContent = text;
		shadow.style.position = 'absolute';
		shadow.style.left = (x + 2) + 'px';
		shadow.style.top  = (y + 2) + 'px';
		shadow.style.color = '#000';
		this.overlay.appendChild(shadow);

		var span = document.createElement('span');
		span.textContent = text;
		span.style.position = 'absolute';
		span.style.left = x + 'px';
		span.style.top  = y + 'px';
		span.style.color = '#FFF';
		this.overlay.appendChild(span);
	}

	async spawnNearPlayer(Class, spriteFile, count, options){
	    options = options || {};
	    var radiusMin = options.radiusMin != undefined ? options.radiusMin : 3;
	    var radiusMax = options.radiusMax != undefined ? options.radiusMax : 6;

	    for(var n = 0; n < count; n++){
		var theta  = Math.random() * 2 * Math.PI;
		var radius = radiusMin + Math.floor(Math.random() * (radiusMax - radiusMin + 1));
		var dx = Math.floor(Math.sin(theta) * radius);
		var dy = Math.floor(Math.cos(theta) * radius);

		var opts = Object.assign({}, options);
		opts.x = this.player.mapPos.x + dx;
		opts.y = this.player.mapPos.y + dy;
		delete opts.radiusMin;
		delete opts.radiusMax;

		await this.spawnEntity(Class, spriteFile, opts);
	    }
	}
}


