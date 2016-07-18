"use strict";

/**
 * 	jQuery functionality for splash page!
 */

$(document).ready(function () {

	// click to get appropriate gif
	$(".benefit-box").click(function () {
		var index = $(".benefit-box").index(this);

		var demoDisplay = $("#demo-display");
		demoDisplay.fadeIn(300);

		switch (index) {
			case 0:
				// clear objectives, every day
				break;
			case 1:
				// empower your self-awareness
				break;
			case 2:
				// know what's next
				break;
			case 3:
				// free up your attention
				break;
				alert($(".benefit-box").index(this));
		}
	});

	$("#demo-display .circle").click(function () {
		var demoDisplay = $("#demo-display");
		demoDisplay.fadeOut(300);
	});
});
//# sourceMappingURL=splash.js.map