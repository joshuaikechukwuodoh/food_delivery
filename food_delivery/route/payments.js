const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const MenuItems = require('../model/MenuItems');
const Order = require('../model/Order');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create order and payment
router.post('/create-order', async (req, res) => {
    try {
        const order = await new Order({
            customerName: req.body.customerName,
            customerEmail: req.body.customerEmail,
            customerPhone: req.body.customerPhone,
            items: req.body.items,
            totalAmount: req.body.totalAmount,
        }).save();

        const amount = req.body.totalAmount * 100; // Convert to paise
        const currency = 'INR';
        const options = {
            amount,
            currency,
            receipt: order._id.toString(),
            payment_capture: 1,
        };

        const razorpayOrder = await razorpay.orders.create(options);

        res.json({
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            receipt: razorpayOrder.receipt
        });
    } catch (error) {
        console.error('Payment Error:', error);
        res.status(500).json({ message: 'Error creating payment order', error: error.message });
    }
});

// Verify payment
router.post('/verify-payment', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            // Update order status
            const order = await Order.findOneAndUpdate(
                { _id: req.body.receipt },
                {
                    paymentStatus: 'completed',
                    razorpayOrderId: razorpay_order_id,
                    razorpayPaymentId: razorpay_payment_id
                },
                { new: true }
            );

            res.json({
                message: 'Payment verified successfully',
                order
            });
        } else {
            res.status(400).json({ message: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Verification Error:', error);
        res.status(500).json({ message: 'Error verifying payment', error: error.message });
    }
});

module.exports = router;