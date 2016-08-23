import { wit, bots } from '../controllers/index';
import models from '../../app/models';

// add receive middleware to controller
export default (controller) => {

	controller.middleware.receive.use(wit.receive);

}