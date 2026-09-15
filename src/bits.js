'use strict';

// Pack a 2D boolean array (indexed [x][y]) into a hex string.
// Row-major: cell (x, y) maps to bit index y * width + x.
// Bit 1 = true, bit 0 = false.
function packBitfield(arr2d, width, height){
	var totalBits = width * height;
	var totalBytes = Math.ceil(totalBits / 8);
	var bytes = new Uint8Array(totalBytes);

	for(var y = 0; y < height; y++){
		for(var x = 0; x < width; x++){
			if(!arr2d[x][y]) continue;
			var bitIndex = y * width + x;
			bytes[bitIndex >> 3] |= 1 << (bitIndex & 7);
		}
	}

	var hex = '';
	for(var i = 0; i < bytes.length; i++){
		hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
	}
	return hex;
}

// Inverse of packBitfield.  Returns a 2D array indexed [x][y].
function unpackBitfield(hex, width, height){
	var bytes = new Uint8Array(hex.length >> 1);
	for(var i = 0; i < bytes.length; i++){
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
	}

	var arr2d = [];
	for(var x = 0; x < width; x++) arr2d[x] = [];

	for(var y = 0; y < height; y++){
		for(var x2 = 0; x2 < width; x2++){
			var bitIndex = y * width + x2;
			arr2d[x2][y] = (bytes[bitIndex >> 3] & (1 << (bitIndex & 7))) !== 0;
		}
	}
	return arr2d;
}
