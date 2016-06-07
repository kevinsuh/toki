import { wit } from '../index';

// add receive middleware to controller
export default (controller) => {

	controller.middleware.receive.use(wit.receive);

}