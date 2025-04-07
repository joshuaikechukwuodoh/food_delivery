const express = require('express');
const router = express.Router();
const Order = require('../model/Order');
const User = require('../model/User');
const Restaurant = require('../model/Restaurants');
const DeliveryAgent = require('../model/DeliveryAgent');
const Payment = require('../model/Payments');
const authenticate = require('../auth');

// Track order endpoint
router.post('/track', authenticate, async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user.id;

        // Validate input
        if (!orderId) {
            return res.status(400).json({ message: 'Order ID is required' });
        }

        // Find the order with all necessary relations
        const order = await Order.findById(orderId)
            .populate('restaurant', 'name address location')
            .populate('deliveryAgent', 'name phone vehicleType currentLocation status')
            .populate('customer', 'name phone');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user is authorized to view this order
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Authorization check
        if (user._id.toString() !== order.customer._id.toString() &&
            user.role !== 'admin' &&
            user._id.toString() !== order.deliveryAgent?._id.toString() &&
            user._id.toString() !== order.restaurant.owner.toString()) {
            return res.status(403).json({ message: 'Unauthorized to view this order' });
        }

        // If no delivery agent assigned, try to assign one
        if (!order.deliveryAgent && order.status === 'pending') {
            const assignedAgent = await order.assignOptimalAgent();
            if (assignedAgent) {
                await order.optimizeRoute();
            }
        }

        // Calculate estimated delivery time if not set
        if (!order.estimatedDeliveryTime && order.deliveryAgent) {
            const agentLocation = order.deliveryAgent.currentLocation.coordinates;
            const deliveryLocation = order.deliveryAddress.coordinates;

            // Simple distance calculation (in km)
            const distance = calculateDistance(
                agentLocation[1], agentLocation[0],
                deliveryLocation[1], deliveryLocation[0]
            );

            // Estimate time based on distance and vehicle type
            const speed = order.deliveryAgent.vehicleType === 'bicycle' ? 15 :
                order.deliveryAgent.vehicleType === 'motorcycle' ? 30 : 40;

            const estimatedMinutes = (distance / speed) * 60;
            order.estimatedDeliveryTime = new Date(Date.now() + estimatedMinutes * 60000);
            await order.save();
        }

        // Prepare response based on user role
        let response = {
            orderId: order._id,
            status: order.status,
            items: order.items,
            createdAt: order.createdAt,
            estimatedDeliveryTime: order.estimatedDeliveryTime,
            trackingHistory: order.trackingHistory,
            restaurant: {
                name: order.restaurant.name,
                address: order.restaurant.address
            },
            routeOptimization: order.routeOptimization,
            notifications: order.notifications.filter(n => !n.read),
            deliveryTimeWindow: order.deliveryTimeWindow
        };

        // Add role-specific information
        if (user.role === 'customer') {
            response.deliveryAgent = order.deliveryAgent ? {
                name: order.deliveryAgent.name,
                phone: order.deliveryAgent.phone,
                vehicle: order.deliveryAgent.vehicleType,
                status: order.deliveryAgent.status
            } : null;
            response.currentLocation = order.trackingHistory.slice(-1)[0]?.location;
        }

        if (user.role === 'delivery' || user.role === 'admin') {
            response.customer = {
                name: order.customer.name,
                phone: order.customer.phone,
                deliveryAddress: order.deliveryAddress
            };
            response.paymentStatus = order.paymentStatus;
        }

        if (user.role === 'restaurant' || user.role === 'admin') {
            response.orderValue = order.totalAmount;
            response.paymentDetails = await Payment.findOne({ orderId: order._id });
        }

        res.json(response);

    } catch (error) {
        console.error('Tracking error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// Update order location (for delivery agents)
router.post('/update-location', authenticate, async (req, res) => {
    try {
        const { orderId, latitude, longitude } = req.body;
        const userId = req.user.id;

        if (!orderId || !latitude || !longitude) {
            return res.status(400).json({ message: 'Order ID and location coordinates are required' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Verify the user is the assigned delivery agent
        if (order.deliveryAgent.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized to update this order location' });
        }

        await order.updateLocation(latitude, longitude);

        // Also update delivery agent's location
        const deliveryAgent = await DeliveryAgent.findById(userId);
        if (deliveryAgent) {
            await deliveryAgent.updateLocation(latitude, longitude);
        }

        // Send notification to customer
        await order.sendNotification('location_update',
            `Your order is on the way! Current location: ${latitude}, ${longitude}`);

        // Re-optimize route if needed
        await order.optimizeRoute();

        res.json({
            message: 'Location updated successfully',
            routeOptimization: order.routeOptimization
        });

    } catch (error) {
        console.error('Location update error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// Get notifications for an order
router.get('/notifications/:orderId', authenticate, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check authorization
        if (order.customer.toString() !== userId &&
            order.deliveryAgent?.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        res.json({
            notifications: order.notifications,
            unreadCount: order.notifications.filter(n => !n.read).length
        });

    } catch (error) {
        console.error('Notifications error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// Mark notifications as read
router.post('/notifications/read', authenticate, async (req, res) => {
    try {
        const { orderId, notificationIds } = req.body;
        const userId = req.user.id;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check authorization
        if (order.customer.toString() !== userId &&
            order.deliveryAgent?.toString() !== userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Mark specified notifications as read
        order.notifications.forEach(notification => {
            if (notificationIds.includes(notification._id.toString())) {
                notification.read = true;
            }
        });

        await order.save();

        res.json({ message: 'Notifications marked as read' });

    } catch (error) {
        console.error('Mark notifications error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(value) {
    return value * Math.PI / 180;
}

module.exports = router;