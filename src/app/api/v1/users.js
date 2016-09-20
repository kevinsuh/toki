import request from 'request';
import express from 'express';
import pg from 'pg';

var router = express.Router();

import { controller } from '../../../bot/controllers';
import models from '../../models';

/**
 *    USERS CONTROLLER
 *    `/api/v1/users`
 */

// index
router.get('/', (req, res) => {
});

// create
router.post('/', (req, res) => {
  const { email, SlackUserId } = req.body;
  res.json({hello: "world"});
});

// read
router.get('/:id', (req, res) => {
  const { id } = req.params;
});

// update
router.put('/:id', (req, res) => {
});

// delete
router.delete('/:id', (req, res) => {
});

export default router;