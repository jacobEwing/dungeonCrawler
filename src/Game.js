'use strict';

// ============================================================================
// Game
// ============================================================================

class Game {
	constructor(canvas, overlay){
		this.canvas = canvas;
		this.overlay = overlay;
		this.ctx = canvas.getContext('2d');
		this.saveManager = new SaveManager();

		this.spriteSets = {};
		this.sprites = {};
		this.mousePointers = {};
		// CSS cursor per action.  Uses url(...) with a fallback, so missing images
		// silently fall through to the fallback cursor rather than breaking.
		this.cursors = {
			default	: 'default',
			attack	: 'url(images/cursor_attack.png) 0 0, crosshair',
			loot	: 'url(images/cursor_loot.png)   0 0, pointer',
			talk	: 'url(sprites/cursor_talk.png)   8 8, pointer'
		};

		this.currentCursor = 'default';
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

		this.activePanel = null;   // name string of the open panel, or null

		// Panel instances.  Populated here because the DOM shells already exist
		// by the time the Game is constructed.
		this.panels = {
			inventory : new InventoryPanel(this),
			character : new CharacterPanel(this)
		};
		this.renderView = createRenderView(this);

		// Registry of entity types that can be referenced by name from map JSON
		// or from spawn tables.
		this.spawnRegistry = {
			knight : {
				Class : Enemy,
				spriteFile : 'sprites/knight.sprite',
				options : { speed : 20, vision : 5, lootTableKey : 'knight' }
			},
			humanFemale : {
				Class : Enemy,
				spriteFile : 'sprites/humanFemale.sprite',
				options : { speed : 18, vision : 5, lootTableKey : 'humanFemale'  }
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
		await this.waitForFonts();

		try {
			await this.loadSpriteSets();
			await this.loadPlayerSprite();
			await this.loadMap(MAP_FILE);

			this.initializeEvents();
			await this.loadMousePointers();

			this.setupSidebarIcons();

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

		//document.documentElement.style.setProperty('--game-scale', gameScale + 'px');
		document.documentElement.style.setProperty('--ui-font', UI_FONT_FAMILY);


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
			{'name' : 'rat', 'file' : 'rat.sprite'},
			{'name' : 'treasures', 'file' : 'treasures.sprite' },
			{'name' : 'valuable', 'file' : 'valuables.sprite' }, // valuable inventory items
			{'name' : 'ui', 'file' : 'ui.sprite'} // ui components

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
		this.renderCharacterIcon();
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
		map.file = mapFile;
		map.assignId();
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
		this.keyboard.onCombo(['CTRL', 'S'], () => this.handleSave());
		this.keyboard.onCombo(['CTRL', 'L'], () => this.handleLoad());

		this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());


		this.mouse = new MouseHandler();
		this.mouse.lastTarget = null;
		this.mouse.consumedByInteraction = false;
		this.mouse.listen(this.canvas);
		this.mouse.on('mousedown', (e) => this.handlePointerDown(e));
		this.mouse.on('mousemove', (e) => {
			if(this.mouse.isDown && !this.mouse.consumedByInteraction) this.handlePointer(e);
			this.updateCursor(e);
		});
		this.mouse.on('mouseup', (e) => {
			this.mouse.lastTarget = null;
			this.mouse.consumedByInteraction = false;
		});

		document.getElementById('btn-inventory').addEventListener('click', () => this.togglePanel('inventory'));
		document.getElementById('btn-character').addEventListener('click', () => this.togglePanel('character'));
		document.getElementById('btn-save').addEventListener('click', () => this.handleSave());
		document.getElementById('btn-load').addEventListener('click', () => this.handleLoad());

		document.querySelectorAll('.panel-close').forEach(btn => {
			btn.addEventListener('click', () => this.closePanel());
		});
		document.getElementById('ui-backdrop').addEventListener('click', () => this.closePanel());

		this.keyboard.onPress('I', () => this.togglePanel('inventory'));
		this.keyboard.onPress('C', () => this.togglePanel('character'));
		this.keyboard.onPress('ESC', () => this.closePanel());
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

		if(!this.gamePaused && this.activePanel == null && this.activeMap != null){
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

		this.player.clearPendingAction();

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
		if(clickTarget){
			var action = this.actionForTarget(clickTarget.target);
			if(action){
				this.player.setPendingAction(action, clickTarget.target);
				this.mouse.consumedByInteraction = true;
				this.mouse.lastTarget = { x : worldX, y : worldY };
				return;
			}
		}

		// No interactive target — start a normal walk, and cancel any pending
		// action the player was committed to.
		this.player.clearPendingAction();
		this.mouse.consumedByInteraction = false;
		this.handlePointer(e);
	}

	// Which action (if any) does the player perform against this entity?
	actionForTarget(target){
		if(target.category === 'corpse') return 'loot';
		if(target.category === 'enemy'  && target.isAlive) return 'attack';
		// Future: if(target.category === 'npc') return 'talk';
		return null;
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

	spawnCorpseFor(deadEntity){
		var corpse = new Corpse(this, {
			facing	  : deadEntity.facing,
			possessions : deadEntity.possessions,
			gold        : deadEntity.gold || 0
		});

		corpse.spawnPoint = deadEntity.spawnPoint;

		var treasureSprite = this.pickTreasureSprite(corpse);
		if(treasureSprite){
			corpse.sprite = new cSprite(this.spriteSets.treasures);
			corpse.sprite.setScale(gameScale);
			corpse.sprite.startSequence(treasureSprite, {
				iterations : 0,
				method	 : 'auto'
			});
		}else{
			// fall back to the old visual for empty corpses
			corpse.sprite = new cSprite(deadEntity.sprite.template);
			corpse.sprite.setScale(gameScale);
			corpse.sprite.setFrame(WALK_SEQUENCES[deadEntity.facing][1]);
		}

		corpse.position.x = deadEntity.position.x;
		corpse.position.y = deadEntity.position.y;
		corpse.mapPos.x = deadEntity.mapPos.x;
		corpse.mapPos.y = deadEntity.mapPos.y;

		this.characters.push(corpse);
		return corpse;
	}

	pickTreasureSprite(corpse){
		var hasGold  = corpse.gold > 0;
		var hasItems = corpse.possessions && corpse.possessions.length > 0;

		if(hasItems) return 'chestSparkle';
		if(hasGold)  return 'goldSparkle';
		return null;
	}

	lootCorpse(corpse){
		var lootedAny = false;

		if(corpse.gold > 0){
			this.player.gold += corpse.gold;
			console.log('Picked up ' + corpse.gold + ' gold.');
			corpse.gold = 0;
			lootedAny = true;
		}

		for(var itemData of corpse.possessions){
			// Corpse possessions may be Item instances (from a fresh loot roll) or
			// plain objects (from an older save).  Normalize to Item either way.
			var item = itemData instanceof Item ? itemData : new Item(itemData);
			this.player.possessions.push(item);

			var suffix = item.quantity > 1 ? ' ×' + item.quantity : '';
			console.log('Picked up: ' + item.name + suffix);
			lootedAny = true;
		}

		if(!lootedAny){
			console.log('Corpse is empty.');
		}
		corpse.possessions = [];

		var idx = this.characters.indexOf(corpse);
		if(idx !== -1) this.characters.splice(idx, 1);

		if(this.activePanel === 'inventory'){
			this.panels.inventory.refresh();
		}
	}

	// ------------------------------------------------------------------
	// map transitions
	// ------------------------------------------------------------------

	useEntrance(entrance){
		if(this.isTransitioning) return;
		this.isTransitioning = true;

		// Capture the source map before we reassign activeMap, so we can find
		// the return entrance in the target.
		var sourceMap = this.activeMap;

		if(entrance.target == undefined){
			var mapIdx = this.maps.length;
			this.maps[mapIdx] = new mapBuilder();

			var resolvedSpawns = this.dungeonSpawnTable.map(
				key => this.resolveSpawn(key)
			);

			var seed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;

			this.maps[mapIdx].build({
				category : 'dungeon',
				width : 30,
				height : 30,
				roomscale : .8,
				stairup : true,
				stairdown : true,
				spawnMode : SPAWN_MODE.RESPAWN,
				spawnTable : resolvedSpawns,
				seed : seed
			});
			this.maps[mapIdx].seed = seed;
			this.maps[mapIdx].assignId();
			entrance.target = this.maps[mapIdx];

			var linkTarget = (oppositeKey) => {
				var opposite = entrance.target.items[oppositeKey];
				if(opposite == undefined || opposite.length === 0) return;
				entrance.target.playerPos = {
					x : opposite[0].x,
					y : opposite[0].y
				};
				if(opposite[0].target == undefined){
					opposite[0].target = sourceMap;
				}
			};

			switch(entrance.content){
				case 'stairup':		linkTarget('stairdown'); break;
				case 'stairdown':	linkTarget('stairup');   break;
				case 'caveEntrance':	linkTarget('stairup');   break;
			}
		}

		// Determine where the player lands on the target map.  Look for an
		// entrance in the target whose own .target is the map we're leaving —
		// that's the "opposite" stair, and it's where the player should
		// emerge.  Fall back to the map's default playerPos, then to the map
		// centre, if no match is found.
		var targetMap = entrance.target;
		var landingPos = null;
		for(var content in targetMap.items){
			var list = targetMap.items[content];
			for(var i = 0; i < list.length; i++){
				if(list[i].target === sourceMap){
					landingPos = { x : list[i].x, y : list[i].y };
					break;
				}
			}
			if(landingPos) break;
		}
		if(!landingPos){
			landingPos = targetMap.playerPos;
		}
		if(!landingPos){
			landingPos = {
				x : Math.floor(targetMap.width  / 2),
				y : Math.floor(targetMap.height / 2)
			};
		}

		this.player.target = null;
		this.player.clearPendingAction();
		this.gamePaused = true;

		var opacity = 1, faderate = .2;
		this.canvas.style.opacity = opacity;

		var fadeOut = () => {
			opacity -= faderate;
			this.canvas.style.opacity = opacity;
			if(opacity > faderate){
				setTimeout(fadeOut, 30);
			}else{
				this.activeMap = targetMap;
				if(this.activeMap.spawnMode === SPAWN_MODE.RESET_ON_ENTER){
					this.activeMap.resetSpawnPoints();
				}

				this.player.setMapPos(landingPos.x, landingPos.y);
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
				if(dx * dx + dy * dy >= r2){
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

	hasVisibleNeighbour(cx, cy){
		for(var dx = -1; dx <= 1; dx++){
			for(var dy = -1; dy <= 1; dy++){
				if(dx === 0 && dy === 0) continue;
				if(this.isCellCurrentlyVisible(cx + dx, cy + dy)) return true;
			}
		}
		return false;
	}

	// Fresh visibility check for a specific cell, using the player's current
	// pixel position as the LOS origin — not the cached visibilityMap, which
	// can lag the player by up to a cell's worth of movement.  Includes a
	// margin of SPAWN_VIEW_MARGIN_CELLS cells beyond the vision radius, so a
	// spawn never fires at the very edge of the view.
	isCellVisibleForSpawning(cx, cy){
		if(!this.activeMap || !this.player) return false;

		var px = this.player.position.x;
		var py = this.player.position.y;
		var tx = cx * cellSize + cellSize / 2;
		var ty = cy * cellSize + cellSize / 2;

		var marginCells = this.player.skills.vision + SPAWN_VIEW_MARGIN_CELLS;
		var radiusPx = marginCells * cellSize;
		var dx = tx - px;
		var dy = ty - py;
		if(dx * dx + dy * dy >= radiusPx * radiusPx) return false;

		return this.activeMap.hasLineOfSight(px, py, tx, ty);
	}

	// ------------------------------------------------------------------
	// save / load
	// ------------------------------------------------------------------

	serialize(){
		if(!this.player || !this.player.isAlive) return null;
		if(this.isTransitioning) return null;
		if(!this.activeMap) return null;

		var data = {
			version : 1,
			player : this.serializePlayer(),
			maps : {},
			entrances : {}
		};

		for(var n = 0; n < this.maps.length; n++){
			var map = this.maps[n];
			data.maps[map.id] = this.serializeMap(map);
		}

		// Entrance links: walk every item on every map and record any with a
		// target reference.
		for(var m = 0; m < this.maps.length; m++){
			var srcMap = this.maps[m];
			for(var content in srcMap.items){
				var list = srcMap.items[content];
				for(var i = 0; i < list.length; i++){
					var item = list[i];
					if(item.target && item.target.id){
						var srcKey = srcMap.id + ':' + item.x + ',' + item.y;
						data.entrances[srcKey] = item.target.id;
					}
				}
			}
		}

		return data;
	}

	serializePlayer(){
		return {
			mapId : this.activeMap.id,
			position : { x : this.player.position.x, y : this.player.position.y },
			mapPos : { x : this.player.mapPos.x, y : this.player.mapPos.y },
			health : this.player.health,
			maxHealth : this.player.maxHealth,
			facing : this.player.facing,
			gold : this.player.gold,
			possessions : this.player.possessions.slice(),
			skills : {
				speed : this.player.skills.speed,
				vision : this.player.skills.vision
			}
		};
	}

	serializeMap(map){
		var out = {
			hideMap : packBitfield(map.hideMap, map.width, map.height),
			spawnState : map.getSpawnState()
		};

		if(map.seed != null){
			out.type = 'generated';
			out.seed = map.seed;
			out.category = map.category;
			out.params = {
				width : map.width,
				height : map.height,
				roomscale : map.roomscale,
				stairup : map.stairup,
				stairdown : map.stairdown,
				spawnMode : map.spawnMode
			};
		}else{
			out.type = 'static';
			out.file = map.file;
		}
		return out;
	}

	async deserialize(data){
		if(!data || data.version !== 1){
			throw new Error("Unsupported save version: " + (data && data.version));
		}
		if(!data.player || !data.maps){
			throw new Error("Save data is missing required sections.");
		}

		// Rebuild every map from its descriptor.  We accumulate into a
		// temporary array so a failed rebuild doesn't corrupt the live game.
		var newMaps = [];
		var mapById = {};

		for(var id in data.maps){
			var entry = data.maps[id];
			var map = new mapBuilder();

			if(entry.type === 'static'){
				map.file = entry.file;
				await map.loadImageMap(entry.file);
				map.file = entry.file;
				map.assignId();
				this.populateRawSpawns(map);
			}else if(entry.type === 'generated'){
				var spawnTable = this.dungeonSpawnTable.map(k => this.resolveSpawn(k));
				map.build({
					category : entry.category,
					width : entry.params.width,
					height : entry.params.height,
					roomscale : entry.params.roomscale,
					stairup : entry.params.stairup,
					stairdown : entry.params.stairdown,
					spawnMode : entry.params.spawnMode,
					spawnTable : spawnTable,
					seed : entry.seed
				});
				map.seed = entry.seed;
				map.assignId();
			}else{
				throw new Error("Unknown map type: " + entry.type);
			}

			map.hideMap = unpackBitfield(entry.hideMap, map.width, map.height);
			map.applySpawnState(entry.spawnState);

			newMaps.push(map);
			mapById[id] = map;
		}

		// Re-link entrance targets.
		for(var srcKey in data.entrances){
			var targetId = data.entrances[srcKey];
			var lastColon = srcKey.lastIndexOf(':');
			var srcMapId = srcKey.substring(0, lastColon);
			var coords = srcKey.substring(lastColon + 1).split(',');
			var ix = parseInt(coords[0], 10);
			var iy = parseInt(coords[1], 10);

			var srcMap = mapById[srcMapId];
			var targetMap = mapById[targetId];
			if(!srcMap || !targetMap) continue;

			var linked = false;
			for(var content in srcMap.items){
				var list = srcMap.items[content];
				for(var i = 0; i < list.length; i++){
					if(list[i].x === ix && list[i].y === iy){
						list[i].target = targetMap;
						linked = true;
						break;
					}
				}
				if(linked) break;
			}
		}
		// Derive playerPos for generated maps.  Static maps get theirs from
		// their .map file; generated ones derive it from whichever entrance
		// leads back out, which is where linkTarget would have placed it
		// during original generation.
		for(var srcKey2 in data.entrances){
			var lastColon2 = srcKey2.lastIndexOf(':');
			var srcMapId2 = srcKey2.substring(0, lastColon2);
			var srcMap2 = mapById[srcMapId2];
			if(!srcMap2) continue;
			if(srcMap2.playerPos) continue; // already has one (static, or previously set)

			var coords2 = srcKey2.substring(lastColon2 + 1).split(',');
			srcMap2.playerPos = {
				x : parseInt(coords2[0], 10),
				y : parseInt(coords2[1], 10)
			};
		}
		// Commit.  From here on, any exception would leave the game in a
		// half-loaded state — but everything above is the risky part.
		this.maps = newMaps;
		this.activeMap = mapById[data.player.mapId];
		if(!this.activeMap){
			throw new Error("Save references unknown active map: " + data.player.mapId);
		}

		// Player state.
		var pd = data.player;
		var p = this.player;

		p.position.x = pd.position.x;
		p.position.y = pd.position.y;
		p.mapPos.x = pd.mapPos.x;
		p.mapPos.y = pd.mapPos.y;
		p.health = pd.health;
		p.maxHealth = pd.maxHealth;
		p.facing = pd.facing;
		p.gold = pd.gold;
		p.possessions = (pd.possessions || []).map(function(d){
			return d instanceof Item ? d : new Item(d);
		});
		p.skills.speed = pd.skills.speed;
		p.skills.vision = pd.skills.vision;

		// Clear transient combat / action state.
		p.target = null;
		p.walkPath = [];
		p.moveBudget = 0;
		p.pendingAction = null;
		p.attackTimer = 0;
		p.attackCooldown = 0;
		p.attackHitApplied = false;
		p.damageFlash = 0;
		p.currentSequence = null;
		p.currentEndFrame = null;
		p.isAlive = true;
		p.sprite.stopSequence();
		p.sprite.setFrame(p.idleFrame());

		// Refresh visibility and redraw.
		this.updateVisibility();
		this.renderView(this.activeMap);

		this.closePanel();
	}

	// Canvas doesn't trigger font loading the way DOM text does, so a custom
	// font can silently fall back to the system default on the first frame.
	// This explicitly asks the browser to load the family at the sizes we use,
	// and swallows any failure (a system fallback is fine).
	async waitForFonts(){
		if(!document.fonts || !document.fonts.load) return;
		try {
			await document.fonts.load(uiFont('small'));
			await document.fonts.load(uiFont('normal'));
			await document.fonts.load(uiFont('large'));
		} catch(e) {
			console.warn("Font loading failed; canvas text may use a fallback:", e);
		}
	}

	handleSave(){
		if(this.isTransitioning){
			console.log("Cannot save during a map transition.");
			return;
		}
		if(!this.player || !this.player.isAlive){
			console.log("Cannot save while dead.");
			return;
		}
		var data = this.serialize();
		if(!data){
			console.log("Nothing to save yet.");
			return;
		}
		if(this.saveManager.save(data)){
			console.log("Game saved.");
		}else{
			console.log("Save failed — see console for details.");
		}
	}

	async handleLoad(){
		if(this.isTransitioning){
			console.log("Cannot load during a map transition.");
			return;
		}
		var data = this.saveManager.load();
		if(!data){
			console.log("No save found.");
			return;
		}

		this.isTransitioning = true;
		this.gamePaused = true;
		try {
			await this.deserialize(data);
			console.log("Game loaded.");
		} catch(e){
			console.error("Load failed:", e);
		}
		this.gamePaused = false;
		this.isTransitioning = false;
	}

	// Trigger a download of the current game state as a .json file.  Uses the
	// same serialized shape as the localStorage save, so a file is
	// interchangeable with a slot.
	exportSave(){
		if(this.isTransitioning){
			console.log("Cannot export during a map transition.");
			return;
		}
		if(!this.player || !this.player.isAlive){
			console.log("Cannot export while dead.");
			return;
		}
		var data = this.serialize();
		if(!data){
			console.log("Nothing to export yet.");
			return;
		}

		var json = JSON.stringify(data, null, 2);
		var blob = new Blob([json], { type: 'application/json' });
		var url = URL.createObjectURL(blob);

		var stamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, 'T').slice(0, 19);
		var filename = 'dungeoncrawler-' + stamp + '.json';

		var a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		console.log("Exported: " + filename);
	}

	// Prompt the user to pick a .json save file, then load it.  Creates a
	// transient file input so we don't need a permanent one in the DOM.
	importSave(){
		if(this.isTransitioning){
			console.log("Cannot import during a map transition.");
			return;
		}

		var me = this;
		var input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json,application/json';
		input.style.display = 'none';

		input.addEventListener('change', async function(){
			var file = input.files && input.files[0];
			document.body.removeChild(input);
			if(!file) return;

			var text;
			try {
				text = await file.text();
			} catch(e){
				console.error("Could not read file:", e);
				return;
			}

			var data;
			try {
				data = JSON.parse(text);
			} catch(e){
				console.error("File is not valid JSON:", e);
				return;
			}

			me.isTransitioning = true;
			me.gamePaused = true;
			try {
				await me.deserialize(data);
				console.log("Imported: " + file.name);
			} catch(e){
				console.error("Import failed:", e);
			}
			me.gamePaused = false;
			me.isTransitioning = false;
		});

		document.body.appendChild(input);
		input.click();
	}
	
	// ------------------------------------------------------------------
	// UI panels
	// ------------------------------------------------------------------
	togglePanel(name){
		if(this.activePanel === name) this.closePanel();
		else this.openPanel(name);
	}

	openPanel(name){
		var panel = this.panels[name];
		if(!panel) return;

		// Ensure only one is open at a time.
		this.closePanel();

		this.activePanel = name;
		panel.open();
		document.getElementById('ui-backdrop').classList.add('visible');

		// Cancel any walk/attack the player had going, since the mouse is
		// about to interact with DOM elements instead of the canvas.
		if(this.player){
			this.player.target = null;
			this.player.walkPath = [];
			this.player.clearPendingAction();
		}
	}

	closePanel(){
		if(this.activePanel == null) return;

		var panel = this.panels[this.activePanel];
		if(panel) panel.close();
		document.getElementById('ui-backdrop').classList.remove('visible');
		this.activePanel = null;
	}


	// Minimal HTML escape for user-visible strings that could come from data
	// files.  Item names are currently authored by us, but habits are worth
	// forming early.
	escapeHtml(s){
		return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
	}

	// Render a frame from a sprite set into a button as a canvas, replacing
	// any existing .sidebar-icon child (or inserting one before the caption).
	// Integer-scales so pixel art stays crisp.
	renderFrameIntoButton(buttonId, set, frameName, size){
		var button = document.getElementById(buttonId);
		if(!button) return;
		if(!set || !set.image || !set.frames) return;

		var frame = set.frames[frameName];
		if(!frame) return;

		var scale = Math.floor(Math.min(size / frame.width, size / frame.height));
		if(scale < 1) scale = 1;

		var drawW = frame.width  * scale;
		var drawH = frame.height * scale;
		var drawX = Math.floor((size - drawW) / 2);
		var drawY = Math.floor((size - drawH) / 2);

		var canvas = document.createElement('canvas');
		canvas.width  = size;
		canvas.height = size;
		canvas.className = 'sidebar-icon';

		var ctx = canvas.getContext('2d');
		ctx.imageSmoothingEnabled = false;
		ctx.webkitImageSmoothingEnabled = false;
		ctx.mozImageSmoothingEnabled = false;

		ctx.drawImage(set.image,
				frame.x, frame.y, frame.width, frame.height,
				drawX, drawY, drawW, drawH);

		var existing = button.querySelector('.sidebar-icon');
		if(existing){
			button.replaceChild(canvas, existing);
		}else{
			button.insertBefore(canvas, button.firstChild);
		}
	}

	// Convenience: same as above, but for the ui sprite set by frame name.
	renderUiIcon(buttonId, frameName){
		this.renderFrameIntoButton(buttonId, this.spriteSets.ui, frameName, SIDEBAR_ICON_SIZE);
	}

	// Player portrait: uses the player's own sprite set so the icon tracks
	// whichever skin is loaded.
	renderCharacterIcon(){
		if(!this.player || !this.player.sprite) return;
		var sprite = this.player.sprite;

		// Preserve current frame so we can restore it after rendering.
		var prevFrame = sprite.frameName;
		var set = sprite.template;
		this.renderFrameIntoButton('btn-character', set, 'front_right_idle', SIDEBAR_ICON_SIZE);
		if(prevFrame) sprite.setFrame(prevFrame);
	}

	// ------------------------------------------------------------------
	// misc
	// ------------------------------------------------------------------
	updateSpawnPoints(dt){
		if(!this.activeMap) return;
		if(!this.activeMap.spawnPoints) return;

		var player = this.player;
		if(!player) return;

		var isFirstPopulation = !this.activeMap._initialPopulationDone;

		var activationSq = (SPAWN_ACTIVATION_CELLS   * cellSize) * (SPAWN_ACTIVATION_CELLS   * cellSize);
		var deactivationSq = (SPAWN_DEACTIVATION_CELLS * cellSize) * (SPAWN_DEACTIVATION_CELLS * cellSize);
		var minDistPx = SPAWN_MIN_PLAYER_DISTANCE_CELLS * cellSize;
		var minDistSq = minDistPx * minDistPx;

		for(var n = 0; n < this.activeMap.spawnPoints.length; n++){
			var sp = this.activeMap.spawnPoints[n];

			if(sp.exhausted) continue;

			if(sp.cooldownTimer > 0){
				sp.cooldownTimer -= dt;
			}

			var px = sp.x * cellSize;
			var py = sp.y * cellSize;
			var dx = player.position.x - px;
			var dy = player.position.y - py;
			var distSq = dx * dx + dy * dy;

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

			if(
				sp.activeEntity == null
				&& !sp.spawning
				&& sp.cooldownTimer <= 0
				&& distSq < activationSq
				&& distSq > minDistSq
				&& (isFirstPopulation || !this.isCellVisibleForSpawning(sp.x, sp.y))

			){
				this.materializeSpawnPoint(sp);
			}
		}

		if(isFirstPopulation){
			this.activeMap._initialPopulationDone = true;
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
			return entry; // already resolved
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
				key : entry.key,
				Class : resolved.Class,
				spriteFile : resolved.spriteFile,
				options : resolved.options
			});
		}
	}

	updateCursor(e){
		// While dragging to walk, show the walk cursor.  While a click action
		// is in flight (consumedByInteraction), keep whatever was set on
		// mousedown.
		var action = 'default';

		if(this.mouse.isDown && !this.mouse.consumedByInteraction){
			action = 'default';
		}else{
			var delta = this.player.distanceToMouseEvent(e);
			var worldX = this.player.position.x + delta.x;
			var worldY = this.player.position.y + delta.y;

			var clickTarget = this.findClickTarget(worldX, worldY);
			if(clickTarget){
				action = this.actionForTarget(clickTarget.target) || 'default';
			}
		}

		this.setCursor(action);
	}

	setCursor(action){
		if(this.currentCursor === action) return;
		this.currentCursor = action;
		this.overlay.style.cursor = this.cursors[action] || this.cursors.default;
	}

	setupSidebarIcons(){
		this.renderUiIcon('btn-inventory', 'inventory');
		this.renderUiIcon('btn-save',      'save');
		this.renderUiIcon('btn-load',      'load');
		this.renderCharacterIcon();
	}
}


