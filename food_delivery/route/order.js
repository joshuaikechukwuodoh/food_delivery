const express = require('express');
const router = express.Router();
const Order = require('../model/Order');
const Restaurant = require('../model/Restaurants');
const MenuItems = require('../model/MenuItems');
const jwt = require('jsonwebtoken');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Get all orders
router.get('/', verifyToken, async (req, res) => {
    try {
        const orders = await Order.find().populate('user', 'name email').populate('products.product', 'itemName itemPrice');
        res.json(orders);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Get a single order by ID
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'name email').populate('products.product', 'itemName itemPrice');
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }
        res.json(order);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Create new order
router.post('/', verifyToken, async (req, res) => {
    try {
        const { restaurantId, items, deliveryAddress, paymentMethod } = req.body;

        // Verify restaurant exists
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        // Calculate total amount
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            const menuItem = await MenuItems.findOne({
                _id: item.menuItemId,
                restaurantId
            });

            if (!menuItem) {
                return res.status(404).json({ message: `Menu item ${item.menuItemId} not found` });
            }

            totalAmount += menuItem.price * item.quantity;
            orderItems.push({
                menuItemId: menuItem._id,
                name: menuItem.name,
                price: menuItem.price,
                quantity: item.quantity
            });
        }

        // Create order
        const order = new Order({
            userId: req.userId,
            restaurantId,
            items: orderItems,
            totalAmount,
            deliveryAddress,
            paymentMethod,
            status: 'pending'
        });

        await order.save();

        res.status(201).json({
            message: 'Order created successfully',
            order
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating order', error: error.message });
    }
});

// Get order status
router.get('/:orderId/status', verifyToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.orderId,
            userId: req.userId
        }).select('status');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ status: order.status });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching order status', error: error.message });
    }
});

// Cancel order
router.put('/:orderId/cancel', verifyToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.orderId,
            userId: req.userId
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({ message: 'Cannot cancel order in current status' });
        }

        order.status = 'cancelled';
        await order.save();

        res.json({ message: 'Order cancelled successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error cancelling order', error: error.message });
    }
});

// Update an existing order
router.put('/:id', verifyToken, async (req, res) => {
    const { status } = req.body;

    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }

        order.status = status;
        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Delete an order
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }

        await order.remove();
        res.json({ msg: 'Order deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// add order item or delete order item
router.post('/orderitem/:id', verifyToken, async (req, res) => {
    const { itemId, quantity } = req.body;

    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ msg: 'Order not found' });
        }

        const menuItem = await MenuItems.findById(itemId);
        if (!menuItem) {
            return res.status(404).json({ msg: 'Menu item not found' });
        }

        // Check if the item is already in the order
        const existingItem = order.products.find(item => item.product.toString() === itemId);
        if (existingItem) {
            // Update quantity if it exists
            existingItem.quantity += quantity;
        } else {
            // Add new item to the order
            order.products.push({ product: itemId, quantity });
        }

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
