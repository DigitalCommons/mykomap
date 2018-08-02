define(["app/eventbus", "model/config", "presenter"], function(eventbus, config, presenter) {
	"use strict";

	function Stack() {
		this.index = 0;
		this.storage = [];
	}
	Stack.prototype = {
		append: function(obj) {
			this.storage[this.storage.length] = obj;
			this.index = this.storage.length - 1;
		},
		current: function() {
			// returns undefined if the stack is empty
			return this.storage[this.index];
		},
		previous: function() {
			if (this.index > 0) {
				this.index--;
			}
			return this.current();
		},
		next: function() {
			if (this.index < this.storage.length - 1) {
				this.index++;
			}
			return this.current();
		},
		isAtStart: function() {
			return this.storage.length === 0 || this.index === 0;
		},
		isAtEnd: function() {
			return this.storage.length === 0 || this.index === this.storage.length - 1;
		}
	};

	// Set up the object from which all sidebar presenters are derived:
	function base(){}

	// All sidebar presenters are derived from the base presenter:
	var proto = Object.create(presenter.base.prototype);

	// Sidebars can manage a stack of content.
	// For example, a sidebar for Search Results may maintain a stack of search results,
	// allowing the possilility of going back/forward through previous/next search results.
	proto.contentStack = new Stack();

	proto.backButtonClicked = function() {
		// Closure to retain reference to this
		var pres = this;
		return function() {
			//console.log("backButtonClicked");
			//console.log(pres);
			pres.contentStack.previous();
			pres.view.refresh();
		}
	};
	proto.forwardButtonClicked = function() {
		// Closure to retain reference to this
		var pres = this;
		return function() {
			//console.log("forwardButtonClicked");
			//console.log(pres);
			pres.contentStack.next();
			pres.view.refresh();
		}
	};

	proto.historyNavigation = function() {
		//console.log("presenter/sidebar/base/historyNavigation");
		//console.log(this);
		return {
			back: {
				disabled: this.contentStack.isAtStart(),
				onClick: this.backButtonClicked()
			},
			forward: {
				disabled: this.contentStack.isAtEnd(),
				onClick: this.forwardButtonClicked()
			}
		};
	};

	base.prototype = proto;

	var pub = {
		base: base
	};
	return pub;
});