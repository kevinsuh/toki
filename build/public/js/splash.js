"use strict";

/**
 * 	jQuery functionality for splash page!
 */

$(document).ready(function () {

	// click to get appropriate gif
	$(".benefit-box").click(function () {

		var demoDisplay = $("#demo-display");
		demoDisplay.fadeIn(300);

		var index = $(".benefit-box").index(this);
		updateDemoDivOnIndex(index);
	});

	// button click to change demo
	$("#demo-display .button").click(function () {
		var index = $(this).data("index");
		updateDemoDivOnIndex(index);
	});

	$("#demo-display .circle").click(function () {
		var demoDisplay = $("#demo-display");
		demoDisplay.fadeOut(300);
	});
});

function updateDemoDivOnIndex(index) {

	var demoDisplay = $("#demo-display");

	var title = "Demo";
	var leftIndex = 0;
	var rightIndex = 1;

	switch (index) {
		case 0:
			// clear objectives, every day
			title = "Clear objectives, every day";
			leftIndex = 3;
			rightIndex = 1;
			break;
		case 1:
			// empower your self-awareness
			title = "Empower your self-awareness";
			leftIndex = 0;
			rightIndex = 2;
			break;
		case 2:
			// know what's next
			title = "Know what's next";
			leftIndex = 1;
			rightIndex = 3;
			break;
		case 3:
			// free up your attention
			title = "Free up your attention";
			leftIndex = 2;
			rightIndex = 0;
			break;
		default:
			break;
	}

	var counter = index + 1;

	demoDisplay.find(".title").text(title);
	demoDisplay.find(".index-counter").text(counter);
	demoDisplay.find(".button.left").data("index", leftIndex);
	demoDisplay.find(".button.right").data("index", rightIndex);
}
//# sourceMappingURL=splash.js.map