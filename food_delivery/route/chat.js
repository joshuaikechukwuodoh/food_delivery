const express = require('express');
const mongoose = require('mongoose');
const Message = require('../model/Message');
const Order = require('../model/Order');
const User = require('../model/User');
const router = express.Router();
const authenticate = require('../auth');
const DeliveryAgent = require('../model/DeliveryAgent');

// Get chat history for an order
router.get('/order/:orderId', authenticate, async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        // Verify user has access to this order
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Check if user is authorized to view this conversation
        const isAuthorized = order.customer.toString() === userId ||
            order.deliveryAgent?.toString() === userId ||
            req.user.role === 'admin';

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Unauthorized access to conversation' });
        }

        const messages = await Message.find({ order: orderId })
            .sort('createdAt')
            .populate('sender', 'name role')
            .populate('receiver', 'name role');

        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send message
router.post('/send', authenticate, async (req, res) => {
    try {
        const { orderId, content, messageType, attachments } = req.body;
        const userId = req.user.id;

        // Verify order exists and user has access
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Determine receiver based on user role
        let receiverId;
        let senderRole;
        let receiverRole;

        if (req.user.role === 'customer') {
            receiverId = order.deliveryAgent;
            senderRole = 'customer';
            receiverRole = 'delivery_agent';
        } else if (req.user.role === 'delivery_agent') {
            receiverId = order.customer;
            senderRole = 'delivery_agent';
            receiverRole = 'customer';
        } else if (req.user.role === 'admin') {
            // Admin can message both customer and delivery agent
            receiverId = req.body.receiverId; // Must be provided for admin
            senderRole = 'admin';
            receiverRole = req.body.receiverRole; // Must be provided for admin
        } else {
            return res.status(403).json({ error: 'Invalid role for messaging' });
        }

        // Create room ID based on order and participants
        const roomId = `order_${orderId}_${Math.min(userId, receiverId)}_${Math.max(userId, receiverId)}`;

        const newMessage = new Message({
            sender: userId,
            receiver: receiverId,
            order: orderId,
            content,
            messageType: messageType || 'text',
            attachments: attachments || [],
            roomId,
            metadata: {
                senderRole,
                receiverRole
            }
        });

        await newMessage.save();

        // Emit socket event for real-time update
        if (req.io) {
            req.io.to(roomId).emit('newMessage', newMessage);
        }

        res.status(201).json(newMessage);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Report a message
router.post('/report', authenticate, async (req, res) => {
    try {
        const { messageId, reason } = req.body;
        const userId = req.user.id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Only customer or delivery agent can report messages
        if (req.user.role !== 'customer' && req.user.role !== 'delivery_agent') {
            return res.status(403).json({ error: 'Only customers and delivery agents can report messages' });
        }

        // User can only report messages they are part of
        if (message.sender.toString() !== userId && message.receiver.toString() !== userId) {
            return res.status(403).json({ error: 'You can only report messages you are part of' });
        }

        await message.reportMessage(userId, reason);

        res.json({ success: true, message: 'Message reported successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get reported messages (admin only)
router.get('/reported', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can view reported messages' });
        }

        const reportedMessages = await Message.getReportedMessages();
        res.json(reportedMessages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all conversations for a user
router.get('/conversations', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        // Get distinct conversations with last message and unread count
        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: mongoose.Types.ObjectId(userId) },
                        { receiver: mongoose.Types.ObjectId(userId) }
                    ]
                }
            },
            {
                $group: {
                    _id: '$roomId',
                    orderId: { $first: '$order' },
                    lastMessage: { $last: '$$ROOT' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$receiver', mongoose.Types.ObjectId(userId)] },
                                        { $eq: ['$isRead', false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'orders',
                    localField: 'orderId',
                    foreignField: '_id',
                    as: 'order'
                }
            },
            { $unwind: '$order' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'order.customer',
                    foreignField: '_id',
                    as: 'customer'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'order.deliveryAgent',
                    foreignField: '_id',
                    as: 'deliveryAgent'
                }
            },
            {
                $project: {
                    order: {
                        _id: 1,
                        status: 1,
                        totalAmount: 1
                    },
                    customer: { $arrayElemAt: ['$customer', 0] },
                    deliveryAgent: { $arrayElemAt: ['$deliveryAgent', 0] },
                    lastMessage: 1,
                    unreadCount: 1
                }
            },
            { $sort: { 'lastMessage.createdAt': -1 } }
        ]);

        res.json(conversations);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark messages as read
router.patch('/mark-read', authenticate, async (req, res) => {
    try {
        const { messageIds, roomId } = req.body;

        await Message.markAsRead(messageIds, req.user.id);

        // Notify other participant that messages were read
        if (req.io && roomId) {
            req.io.to(roomId).emit('messagesRead', {
                readerId: req.user.id,
                messageIds
            });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get unread message count
router.get('/unread-count', authenticate, async (req, res) => {
    try {
        const count = await Message.getUnreadCount(req.user.id);
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;