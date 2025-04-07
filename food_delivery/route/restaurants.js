const express = require('express');
const router = express.Router();
const Restaurant = require('../model/Restaurants');
const MenuItems = require('../model/MenuItems');

// Search restaurants (this route must come before /:id to prevent conflicts)
router.get('/search/:query', async (req, res) => {
    try {
        const query = req.params.query;
        const restaurants = await Restaurant.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { cuisineType: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
            ]
        }).select('name description address cuisineType rating imageUrl');

        res.json(restaurants);
    } catch (error) {
        res.status(500).json({ message: 'Error searching restaurants', error: error.message });
    }
});

// Get all restaurants
router.get('/', async (req, res) => {
    try {
        const restaurants = await Restaurant.find()
            .select('name description address cuisineType rating imageUrl')
            .sort({ rating: -1 });

        res.json(restaurants);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching restaurants', error: error.message });
    }
});

// Get restaurant by ID
router.get('/:id', async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id)
            .select('-__v');

        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        res.json(restaurant);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching restaurant', error: error.message });
    }
});

// Get restaurant menu
router.get('/:id/menu', async (req, res) => {
    try {
        const menuItems = await MenuItems.find({ restaurantId: req.params.id })
            .select('name description price category imageUrl')
            .sort({ category: 1, name: 1 });

        res.json(menuItems);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching menu', error: error.message });
    }
});

module.exports = router;
