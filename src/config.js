'use strict';
// ============================================================================
// Rendering
// ============================================================================

var gameScale = 5;
var cellSize = 12;


// ============================================================================
// UI typography
// ============================================================================

// The font family used for all canvas-drawn text (HUD, panel overlays if we
// ever move them onto the canvas, floating damage numbers, etc.).
//
// Must match the @font-face family in game.css for on-screen consistency.
// If you change it here, change the CSS too — or, alternatively, set the
// --ui-font CSS variable from JS (see Game.setupCanvas) so there's only one
// source of truth.
var UI_FONT_FAMILY = "VT323, sans-serif";

// Pixel sizes used across the UI.  Individual draw sites pick a key.
var UI_FONT_SIZE = {
	small  : 12,
	normal : 14,
	large  : 18
};

// Convenience — builds a value suitable for `ctx.font`.
function uiFont(sizeKey){
	var px = UI_FONT_SIZE[sizeKey] || UI_FONT_SIZE.normal;
	return px + 'px ' + UI_FONT_FAMILY;
}

function uiFontPx(px){
	return px + 'px ' + UI_FONT_FAMILY;
}

// ============================================================================
// Items
// ============================================================================

// Equipment slot definitions, in display order.  Each slot's `id` is what
// item.slot is set to when equipped.  Adding or reordering slots here changes
// the equipment row automatically.
var EQUIPMENT_SLOTS = [
	{ id : 'head', label : 'Head'  },
	{ id : 'body', label : 'Body'  },
	{ id : 'hand', label : 'Hand'  },
	{ id : 'legs', label : 'Legs'  },
	{ id : 'feet', label : 'Feet'  },
	{ id : 'ring', label : 'Ring'  }
];

// Item categories.  The `id` matches the sprite set name (so a weapon's
// frame lives in spriteSets['weapon']), and is what item.category is set to.
// The first entry is the "show everything" pseudo-category.
var ITEM_CATEGORIES = [
	{ id : 'all',      label : 'All'     },
	{ id : 'weapon',   label : 'Weapons' },
	{ id : 'armour',   label : 'Armour'  },
	{ id : 'potion',   label : 'Potions' },
	{ id : 'valuable', label : 'Valuables'  },
	{ id : 'misc',     label : 'Misc'    }
];

// ============================================================================
// Loot
// ============================================================================

// Per-enemy loot tables.  Each entry is rolled independently: the chance of
// an entry dropping is its weight divided by the total weight of the table.
// So the weights don't need to sum to 100 — they just need to be in the
// right proportions.
//
// A `gold` entry adds to the corpse's gold count; an `item` entry pushes a
// new item into its possessions.  Both can appear on the same corpse.

/*
@@@@@@@@@
	If valuables aren't rendering properly, check to make sure you're using the key "valuable", not valuables.
@@@@@@@@@
*/
var LOOT_TABLES = {
	knight : [
		{ weight : 60, item : { name : 'sword', category : 'weapon', slot : 'hand', weaponSprite : 'weapon_sword' } },
		{ weight : 20, gold : { min : 1, max : 8 } },
		{ weight :  6, item : { name : 'ruby ring',    category : 'valuable' } },
		{ weight :  6, item : { name : 'emerald ring', category : 'valuable' } },
		{ weight :  4, item : { name : 'ruby',         category : 'valuable' } },
		{ weight :  3, item : { name : 'emerald',      category : 'valuable' } },
		{ weight :  1, item : { name : 'dark crystal', category : 'valuable' } }
	],
	humanFemale : [
		{ weight : 50, gold : { min : 2, max : 12 } },
		{ weight : 15, item : { name : 'sapphire',     category : 'valuable' } },
		{ weight : 15, item : { name : 'emerald',      category : 'valuable' } },
		{ weight : 10, item : { name : 'ruby',         category : 'valuable' } },
		{ weight :  5, item : { name : 'ruby ring',    category : 'valuable' } },
		{ weight :  5, item : { name : 'dark crystal', category : 'valuable' } }
	]
};

// Inventory grid dimensions.  Rows grow as needed.
var INVENTORY_COLS = 6;
var INVENTORY_ICON_SIZE = 48;
var SIDEBAR_ICON_SIZE = 48;
// ============================================================================
// HUD layout (canvas, top-left corner of the play area)
// ============================================================================

var HUD = {
    padding    : 10,

    // Icon size.  Also acts as the reference size for font and layout.
    iconSize   : cellSize * gameScale,         // 60px at default scale

    // HP bar.  Measured in game-pixels; converted to screen pixels below.
    barSegments : 30,                          // number of pixel-blocks wide
    barRows     : 4,                           // number of pixel-blocks tall
    borderRows  : 1,                           // border thickness, in game-pixels

    // Gaps, also in game-pixels.
    iconGap     : 1,                           // icon → bar
    groupGap    : 3,                           // bar → gold icon

    // Font size as a fraction of iconSize.  0.28 → ~17px at iconSize=60,
    // which fits comfortably inside a 4-game-pixel-tall bar.
    fontScale   : .4,

    // Derived (convenience, so draw code reads cleanly).
    get pixelSize () { return gameScale; },
    get barWidth  () { return this.barSegments * gameScale; },
    get barHeight () { return this.barRows * gameScale; },
    get border    () { return this.borderRows * gameScale; },
    get gap       () { return this.iconGap * gameScale; },
    get bigGap    () { return this.groupGap * gameScale; },
    get fontPx    () { return Math.round(this.iconSize * this.fontScale); }
};

// ============================================================================
// Assorted constants
// ============================================================================


// The world map
var MAP_FILE = "maps/Map2.map";

// Spawn modes — controls how a map's spawn points behave over time.
var SPAWN_MODE = {
	RESPAWN        : 'respawn',
	PERSISTENT     : 'persistent',
	RESET_ON_ENTER : 'resetOnEnter'
};

// Terrain sprite names that block line of sight.  Keyed by the sprite name
// in a map's spritemap, not by the map character, so different maps can
// reuse the same wall sprite or reuse `#` for a non-wall.
var OPAQUE_SPRITES = {
	'stone wall' : true
};

// How dark to make terrain the player has seen but cannot currently see.
// 0.0 = no dimming, 1.0 = fully black.
var VISIBILITY_DIM_ALPHA = 0.25;
var DIM_NEAR_FACTOR = 0.5;

// ============================================================================
// Gameplay tuning
// ============================================================================

// Pixels per second.  Tuned empirically.
var walkSpeed = 44;

// Water animation steps per second of wall-clock time.
var waterCycleRate = 14;

// --- spawn point tuning ---

// The player must be within this many cells of a spawn point for it to
// materialize an entity.  A bit larger than the vision radius so the enemy
// is off-screen when it appears.
var SPAWN_ACTIVATION_CELLS   = 8;

// An active entity is recycled when the player is farther than this many
// cells away.  Hysteresis between activation and deactivation prevents
// repeated materialize/recycle churn at the boundary.
var SPAWN_DEACTIVATION_CELLS = 12;

// How long a spawn point waits after its entity is killed before it can
// produce another.
var SPAWN_RESPAWN_COOLDOWN   = 15;   // seconds

// Minimum distance from the player, in cells, at which a spawn point is
// allowed to fire.  Prevents enemies from materializing on top of the
// player when they round a corner or land on a stair.
var SPAWN_MIN_PLAYER_DISTANCE_CELLS = 2;

// Extra cells of margin beyond the player's vision radius where spawns are
// still suppressed.  Prevents enemies from materializing right at the edge
// of the view, where a one-frame lag or a small position shift can make
// them appear to pop into view.
var SPAWN_VIEW_MARGIN_CELLS = 1;

// ============================================================================
// Combat timing
// ============================================================================

var ATTACK_DURATION = 0.4;    // seconds; 4-frame attacks at 100ms/frame
var ATTACK_HIT_TIME = 0.15;   // seconds into the attack when damage is applied
var ATTACK_COOLDOWN = 0.3;    // seconds after an attack before another can start
var ATTACK_HIT_ARC  = Math.PI / 4;   // ±45° cone in front of the attacker

// ============================================================================
// Direction tables
// ============================================================================

// Octant-indexed attack sequence names.  These match the sequence names
// defined in the .sprite files.
var ATTACK_SEQUENCES = [
	'attackup',        // 0 up
	'attackupright',   // 1 upright
	'attackright',     // 2 right
	'attackdownright', // 3 downright
	'attackdown',      // 4 down
	'attackdownleft',  // 5 downleft
	'attackleft',      // 6 left
	'attackupleft'     // 7 upleft
];

// Octant-indexed walk and idle sequence names.  [0] is the walk sequence,
// [1] is the idle frame.
var WALK_SEQUENCES = [
	['walkup',        'back_idle'],
	['walkupright',   'back_right_idle'],
	['walkright',     'right_idle'],
	['walkdownright', 'front_right_idle'],
	['walkdown',      'front_idle'],
	['walkdownleft',  'front_left_idle'],
	['walkleft',      'left_idle'],
	['walkupleft',    'back_left_idle']
];

// ============================================================================
// Direction math
// ============================================================================

// Half-width of a cardinal octant, in degrees.  22.5° would make all eight
// octants exactly 45° wide.  Smaller values widen the diagonals at the
// expense of the cardinals.  20° gives 40° cardinals and 50° diagonals.
var WALK_CARDINAL_HALF_WIDTH_DEG = 20;

// Determine which of the eight walk-direction octants the vector (dx, dy)
// points into.  Returns an integer 0..7 matching WALK_SEQUENCES.
function computeWalkOctant(dx, dy){
	if(dx == 0 && dy == 0) return null;

	// rel_ang returns: 0 = up, π/2 = right, π = down, 3π/2 = left.
	var alpha = rel_ang(0, 0, dx, dy);

	var f = (4 * alpha / Math.PI) % 8;
	if(f < 0) f += 8;

	var halfWidth = WALK_CARDINAL_HALF_WIDTH_DEG / 45;
	var nearest = Math.round(f);
	var dist = Math.abs(f - nearest);
	var isCardinal = (nearest % 2 == 0);
	var limit = isCardinal ? halfWidth : (1 - halfWidth);

	if(dist < limit){
		return ((nearest % 8) + 8) % 8;
	}

	var direction = (f > nearest) ? 1 : -1;
	return (((nearest + direction) % 8) + 8) % 8;
}
