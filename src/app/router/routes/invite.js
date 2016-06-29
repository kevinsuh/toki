import request from 'request';
import express from 'express';

var router = express.Router();

// bring in helpers
import { getAuthAddress, startBot, saveUserOnLogin } from '../helpers';

// handle the API call after user inputs email
router.post('/invite', (req, res) => {

  console.log("STARTING INVITE...");

  console.log(req.body);

  res.redirect('/');

});

export default router;