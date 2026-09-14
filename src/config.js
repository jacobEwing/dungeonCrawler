'use strict';

// ============================================================================
// Rendering
// ============================================================================

var gameScale = 5;
var cellSize = 12;

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
