'use strict';

// Seeded pseudo-random number generator.  Xorshift32 — fast, small, and
// deterministic for a given seed.  Not cryptographically secure, but that's
// not what it's for.
class SeededRandom {
	constructor(seed){
		this.seed = (seed >>> 0) || 1;    // xorshift can't start at 0
	}

	// Returns a float in [0, 1).  Advances the internal state.
	next(){
		let x = this.seed;
		x ^= x << 13;
		x ^= x >>> 17;
		x ^= x << 5;
		this.seed = x >>> 0;
		return this.seed / 4294967296;
	}
}
