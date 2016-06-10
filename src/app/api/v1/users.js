import request from 'request';
import express from 'express';
import pg from 'pg';

var router = express.Router();

import { bot } from '../../../server';
import { controller } from '../../../bot/controllers';
import models from '../../models';

/**
 *    USERS CONTROLLER
 *    `/api/v1/users`
 */

// index
router.get('/', (req, res) => {

  models.User.findAll({}).then((users) => {
    res.json(users);
  });

});

// create
router.post('/', (req, res) => {
  
  models.User.create({
    email: req.body.email
  }).then((user) => {
    res.json(user);
  });

});

// read
router.get('/:id', (req, res) => {
});

// update
router.put('/:id', (req, res) => {
});

// delete
router.delete('/:id', (req, res) => {
});;

export default router;