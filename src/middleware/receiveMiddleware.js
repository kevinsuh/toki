// add receive middleware to controller
export default (controller) => {

	// user is typing middleware
	// this is buggy for now
	if (false) {
		controller.middleware.receive.use((bot, message, next) => {

			bot.send({
				type: "typing",
				channel: message.channel
			});

			setTimeout(() => {
				next();
			}, 500);

		});
	}
	

}