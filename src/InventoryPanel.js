'use strict';

class InventoryPanel extends Panel {
	constructor(game){
		super(game, 'inventory');
		this.filter = 'all';
	}

	buildContent(){
		var p = this.game.player;
		if(!p) return '';

		var html = '';

		// --- Equipment row ---
		html += '<div class="panel-section">';
		html += '<div class="panel-section-heading"><span>Equipment</span></div>';
		html += '<div class="equipment-row">';
		for(var s = 0; s < EQUIPMENT_SLOTS.length; s++){
			html += this.buildSlot(this.findEquipped(EQUIPMENT_SLOTS[s].id), EQUIPMENT_SLOTS[s].label);
		}
		html += '</div></div>';

		// --- Items section with filter ---
		html += '<div class="panel-section">';
		html += '<div class="panel-section-heading">';
		html += '<span>Items</span>';
		html += '<select class="inventory-filter" id="inventory-filter">';
		for(var c = 0; c < ITEM_CATEGORIES.length; c++){
			var cat = ITEM_CATEGORIES[c];
			var sel = cat.id === this.filter ? ' selected' : '';
			html += '<option value="' + cat.id + '"' + sel + '>'
			      + this.game.escapeHtml(cat.label) + '</option>';
		}
		html += '</select>';
		html += '</div>';

		html += '<div class="inventory-grid">';
		var items = this.filteredItems();
		for(var i = 0; i < items.length; i++){
			html += this.buildSlot(items[i], null);
		}
		// Pad the grid so it always shows at least one full row.
		var totalSlots = Math.max(INVENTORY_COLS, Math.ceil(items.length / INVENTORY_COLS) * INVENTORY_COLS);
		for(var pad = items.length; pad < totalSlots; pad++){
			html += '<div class="slot"></div>';
		}
		html += '</div>';
		html += '</div>';

		if(items.length === 0){
			html += '<div class="inventory-empty">(no items)</div>';
		}

		return html;
	}

	// --- item helpers ---------------------------------------------------

	findEquipped(slotId){
		var p = this.game.player;
		for(var n = 0; n < p.possessions.length; n++){
			var it = p.possessions[n];
			if(it.equipped && it.slot === slotId) return it;
		}
		return null;
	}

	filteredItems(){
		var p = this.game.player;
		var out = [];
		for(var n = 0; n < p.possessions.length; n++){
			var it = p.possessions[n];
			if(it.equipped) continue;
			if(this.filter !== 'all' && it.category !== this.filter) continue;
			out.push(it);
		}
		return out;
	}

	// --- slot rendering -------------------------------------------------

	buildSlot(item, emptyLabel){
		var title = item ? this.itemLabel(item) : (emptyLabel || '');
		var attr = title ? ' title="' + this.game.escapeHtml(title) + '"' : '';

		if(!item){
			return '<div class="slot"' + attr + '></div>';
		}

		// Only items that can actually be clicked get the interactive class —
		// equippables in the grid, and equipped items in the equipment row.
		var interactive = item.equipped || item.isEquippable();
		var classes = 'slot filled' + (interactive ? ' interactive' : '');

		// The index into player.possessions is what handleSlotClick needs to
		// resolve the click back to the item instance.
		var idx = this.game.player.possessions.indexOf(item);
		var posAttr = idx >= 0 ? ' data-pos-index="' + idx + '"' : '';

		var qty = item.quantity != undefined ? item.quantity : 1;
		var qtyHtml = qty > 1 ? '<span class="slot-quantity">' + qty + '</span>' : '';

		return '<div class="' + classes + '"' + attr + posAttr + '>'
			+ this.renderIcon(item)
			+ qtyHtml
			+ '</div>';
	}

	itemLabel(item){
		var count = item.quantity != undefined ? item.quantity : 1;
		var suffix = count > 1 ? ' ×' + count : '';
		return (item.name || 'unknown') + suffix;
	}

	// Tries to build a canvas from the item's category sprite set.  Falls
	// back to a letter placeholder if the sprite or frame isn't available.
	renderIcon(item){
		var set = this.game.spriteSets[item.category];
		var frame = set ? set.frames[item.name] : null;

		if(!set || !frame || !set.image){
			return this.renderLetterIcon(item);
		}

		// Integer-upscale to INVENTORY_ICON_SIZE, centered.
		var size = INVENTORY_ICON_SIZE;
		var scale = Math.floor(Math.min(size / frame.width, size / frame.height));
		if(scale < 1) scale = 1;
		var drawW = frame.width  * scale;
		var drawH = frame.height * scale;
		var drawX = Math.floor((size - drawW) / 2);
		var drawY = Math.floor((size - drawH) / 2);

		// We can't emit a canvas element as an HTML string, so emit a data
		// attribute the caller can hydrate.  Simpler: use an inline
		// background-image div with the frame coordinates.
		var url = set.image.src;
		var bg = 'background-image:url(' + url + ');'
		       + 'background-position:-' + frame.x + 'px -' + frame.y + 'px;'
		       + 'background-repeat:no-repeat;'
		       + 'width:' + frame.width + 'px;height:' + frame.height + 'px;';

		// Wrap in a scaling div so the icon grows without re-rendering.
		return '<div style="'
		     + 'transform:scale(' + scale + ');'
		     + 'transform-origin:center center;'
		     + 'image-rendering:pixelated;'
		     + bg
		     + '" class="slot-icon-src"></div>';
	}

	renderLetterIcon(item){
		var letter = (item.name || '?').charAt(0).toUpperCase();
		return '<span class="slot-letter">' + this.game.escapeHtml(letter) + '</span>';
	}

	// --- filter persistence ---------------------------------------------
	refresh(){
		super.refresh();
		var me = this;

		var sel = document.getElementById('inventory-filter');
		if(sel){
			sel.value = this.filter;
			sel.addEventListener('change', function(e){
					me.filter = e.target.value;
					me.refresh();
					});
		}

		// Delegated click handler.  Re-bound on every refresh because
		// super.refresh() replaces the body's innerHTML; the listener is
		// attached to the body element itself, which survives the rebuild.
		if(this.bodyEl && !this._clickBound){
			this.bodyEl.addEventListener('click', function(e){ me.handleSlotClick(e); });
			this._clickBound = true;
		}
	}

	handleSlotClick(e){
		var slotEl = e.target.closest('.slot');
		if(!slotEl) return;

		var posIdx = slotEl.dataset.posIndex;
		if(posIdx == undefined) return;   // empty slot

		var item = this.game.player.possessions[parseInt(posIdx, 10)];
		if(!item) return;

		if(item.equipped){
			this.game.player.unequipItem(item);
			this.refresh();
		}else if(item.isEquippable()){
			this.game.player.equipItem(item);
			this.refresh();
		}
		// Non-equippable, non-equipped items: no action for now.
	}
}
