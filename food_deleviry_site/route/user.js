const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../model/User');
const authenticate = require('../auth');

// get user profile 
router.get('/profile', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// update user profile
router.put('/profile', authenticate, async (req, res) => {
    const { name, email } = req.body;
    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { name, email },
            { new: true, fields: '-password' }
        );
        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

// delete user account
router.delete('/profile', authenticate, async (req, res) => {
    try {
        await User.findByIdAndRemove(req.user.id);
        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
});

module.exports = router;