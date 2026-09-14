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

		// Registry of entity types that can be referenced by name from map JSON
		// or from spawn tables.
		this.spawnRegistry = {
			knight : {
				Class : Enemy,
				spriteFile : 'sprites/knight.sprite',
				options : { speed : 20, vision : 5 }
			},
			humanFemale : {
				Class : Enemy,
				spriteFile : 'sprites/humanFemale.sprite',
				options : { speed : 18, vision : 5 }
			}
		};

		// Dungeons pull spawns from this list of registry keys.
		this.dungeonSpawnTable = ['knight', 'humanFemale'];

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
			await this.loadMap(MAP_FILE);

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
		this.populateRawSpawns(map);
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

		this.updateVisibility();
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
			var c = this.characters[n];
			if(!c.isVisible()) continue;
			c.act(dt);
		}

		this.updateSpawnPoints(dt);

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
			if(!this.isCellCurrentlyVisible(c.mapPos.x, c.mapPos.y)) continue;

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

		// Wall between player and target blocks interaction, regardless of
		// range.
		if(!this.activeMap.hasLineOfSight(
			player.position.x, player.position.y,
			target.position.x, target.position.y
		)){
			return false;
		}

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
		corpse.spawnPoint = deadEntity.spawnPoint;

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

			var resolvedSpawns = this.dungeonSpawnTable.map(
				key => this.resolveSpawn(key)
			);

			this.maps[mapIdx].build({
				category : 'dungeon',
				width : 30,
				height : 30,
				roomscale : .8,
				stairup : true,
				stairdown : true,
				spawnMode : SPAWN_MODE.RESPAWN,
				spawnTable : resolvedSpawns
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
				// Reset spawn state on entry, if this map is in resetOnEnter mode.
				if(this.activeMap.spawnMode === SPAWN_MODE.RESET_ON_ENTER){
					this.activeMap.resetSpawnPoints();
				}

				this.player.setMapPos(this.activeMap.playerPos.x, this.activeMap.playerPos.y);
				this.player.setMapPos(this.activeMap.playerPos.x, this.activeMap.playerPos.y);
				this.player.position.x += cellSize >> 1;
				this.player.position.y += cellSize >> 1;
				this.updateVisibility();
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

	// Recompute which cells the player can currently see, and reveal any
	// newly-seen cells in the permanent hideMap.  Cheap enough to call on
	// every player movement; early-outs if the player's map cell hasn't
	// changed since the last call.
	updateVisibility(){
		if(!this.activeMap || !this.player) return;

		var map = this.activeMap;
		var cx = this.player.mapPos.x;
		var cy = this.player.mapPos.y;

		if(map._lastVisX === cx && map._lastVisY === cy && map.visibilityMap){
			return;
		}
		map._lastVisX = cx;
		map._lastVisY = cy;

		var radius = this.player.skills.vision;
		var r2 = radius * radius;
		var px = this.player.position.x;
		var py = this.player.position.y;

		map.visibilityMap = {};

		for(var dx = -radius; dx <= radius; dx++){
			var mx = cx + dx;
			if(mx < 0 || mx >= map.width) continue;

			var col = {};
			map.visibilityMap[mx] = col;

			for(var dy = -radius; dy <= radius; dy++){
				var my = cy + dy;
				if(my < 0 || my >= map.height) continue;

				// Outside the Euclidean radius — not visible, don't bother
				// with an LOS check.
				if(dx * dx + dy * dy > r2){
					col[my] = false;
					continue;
				}

				// Target the centre of the cell we're checking.
				var tx = mx * cellSize + cellSize / 2;
				var ty = my * cellSize + cellSize / 2;

				var visible = map.hasLineOfSight(px, py, tx, ty);
				col[my] = visible;

				// Permanent reveal: once seen, always remembered.
				if(visible){
					map.hideMap[mx][my] = false;
				}
			}
		}
	}

	isCellCurrentlyVisible(cx, cy){
		var map = this.activeMap;
		if(!map || !map.visibilityMap) return false;
		var col = map.visibilityMap[cx];
		if(!col) return false;
		return col[cy] === true;
	}

	// ------------------------------------------------------------------
	// misc
	// ------------------------------------------------------------------
	updateSpawnPoints(dt){
		if(!this.activeMap) return;
		if(!this.activeMap.spawnPoints) return;

		var player = this.player;
		if(!player) return;

		var activationSq   = (SPAWN_ACTIVATION_CELLS   * cellSize) * (SPAWN_ACTIVATION_CELLS   * cellSize);
		var deactivationSq = (SPAWN_DEACTIVATION_CELLS * cellSize) * (SPAWN_DEACTIVATION_CELLS * cellSize);

		for(var n = 0; n < this.activeMap.spawnPoints.length; n++){
			var sp = this.activeMap.spawnPoints[n];

			if(sp.exhausted) continue;

			if(sp.cooldownTimer > 0){
				sp.cooldownTimer -= dt;
			}

			// Distance from player to the spawn point, in pixels squared.
			var px = sp.x * cellSize;
			var py = sp.y * cellSize;
			var dx = player.position.x - px;
			var dy = player.position.y - py;
			var distSq = dx * dx + dy * dy;

			// Recycle an active, living entity that's too far away.
			if(
			  sp.activeEntity
			  && sp.activeEntity.isAlive
			  && distSq > deactivationSq
			  && !sp.activeEntity.isOnScreen()
			){
				var idx = this.characters.indexOf(sp.activeEntity);
				if(idx !== -1) this.characters.splice(idx, 1);
				sp.activeEntity = null;
				continue;
			}

			// Spawn a new entity if conditions are right.
			if(
				sp.activeEntity == null
				&& !sp.spawning
				&& sp.cooldownTimer <= 0
				&& distSq < activationSq
			){
				this.materializeSpawnPoint(sp);
			}
		}
	}

	materializeSpawnPoint(sp){
		if(sp.spawning) return;
		sp.spawning = true;

		var options = Object.assign({}, sp.options, { x : sp.x, y : sp.y });

		this.spawnEntity(sp.Class, sp.spriteFile, options).then(entity => {
			entity.spawnPoint = sp;
			sp.activeEntity = entity;
			sp.spawning = false;
		}).catch(err => {
			console.error("Failed to materialize spawn point", sp, err);
			sp.spawning = false;
		});
	}

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

	// Turn a spawn descriptor (registry key string, or an object with a
	// `type` field plus optional `options` overrides) into the full
	// {Class, spriteFile, options} shape that mapBuilder expects.
	resolveSpawn(entry){
		if(typeof entry === 'object' && entry.Class){
			return entry;    // already resolved
		}

		var key = typeof entry === 'string' ? entry : entry.type;
		var proto = this.spawnRegistry[key];
		if(!proto){
			throw new Error("Unknown spawn type: " + key);
		}

		var options = Object.assign({}, proto.options);
		if(typeof entry === 'object' && entry.options){
			Object.assign(options, entry.options);
		}

		return {
			Class : proto.Class,
			spriteFile : proto.spriteFile,
			options : options
		};
	}

	// Resolve any hand-placed spawns that were declared in the map file.
	populateRawSpawns(map){
		if(!map.rawSpawns || map.rawSpawns.length === 0) return;

		for(var entry of map.rawSpawns){
			var resolved = this.resolveSpawn(entry);
			map.addSpawnPoint({
				x : entry.x,
				y : entry.y,
				Class : resolved.Class,
				spriteFile : resolved.spriteFile,
				options : resolved.options
			});
		}
	}
}


