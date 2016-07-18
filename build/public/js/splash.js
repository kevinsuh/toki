"use strict";

/**
 * 	jQuery functionality for splash page!
 */

$(document).ready(function () {

	// click to get appropriate gif
	$(".benefit-box").click(function () {

		var demoDisplay = $("#demo-display");
		demoDisplay.fadeIn(300, function () {
			var mainDisplay = $("#splash-main-display");
			mainDisplay.fadeOut(300);
		});

		var index = $(".benefit-box").index(this);
		updateDemoDivOnIndex(index);
	});

	// button click to change demo
	$("#demo-display .button").click(function () {
		var index = $(this).data("index");
		updateDemoDivOnIndex(index);
	});

	$("#demo-display .circle").click(function () {

		var mainDisplay = $("#splash-main-display");
		mainDisplay.show();

		var demoDisplay = $("#demo-display");
		demoDisplay.fadeOut(300);
	});
});

function updateDemoDivOnIndex(index) {

	var demoDisplay = $("#demo-display");

	var title = "Demo";
	var leftIndex = 0;
	var rightIndex = 1;
	var imageSource = "clearobjectives.gif";
	var imageAlt = "Clear Objectives";

	switch (index) {
		case 0:
			// clear objectives, every day
			title = "Clear objectives, every day";
			leftIndex = 3;
			rightIndex = 1;
			imageSource = "clearobjectives.gif";
			imageAlt = "Clear Objectives";
			break;
		case 1:
			// empower your self-awareness
			title = "Empower your self-awareness";
			leftIndex = 0;
			rightIndex = 2;
			imageSource = "empowerselfaware.gif";
			imageAlt = "Empower your self-awareness";
			break;
		case 2:
			// know what's next
			title = "Know what's next";
			leftIndex = 1;
			rightIndex = 3;
			imageSource = "next.gif";
			imageAlt = "Know what's next";
			break;
		case 3:
			// free up your attention
			title = "Free up your attention";
			leftIndex = 2;
			rightIndex = 0;
			imageSource = "freeattention.gif";
			imageAlt = "Free up your attention";
			break;
		default:
			break;
	}

	var counter = index + 1;

	imageSource = "/assets/gifs/" + imageSource;

	demoDisplay.find(".title").text(title);
	demoDisplay.find(".index-counter").text(counter);
	demoDisplay.find(".button.left").data("index", leftIndex);
	demoDisplay.find(".button.right").data("index", rightIndex);
	demoDisplay.find(".gif").attr("src", imageSource);
	demoDisplay.find(".gif").attr("alt", imageAlt);
}
//# sourceMappingURL=splash.js.map