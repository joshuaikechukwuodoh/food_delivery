const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Routes
const authRoutes = require('./route/auth');
const userRoutes = require('./route/user');
const restaurantRoutes = require('./route/restaurants');
const orderRoutes = require('./route/order');
const paymentRoutes = require('./route/payments');
const chatRoutes = require('./route/chat');
const trackingRoutes = require('./route/trackeing');

dotenv.config();

// Initialize Express
const app = express();
const httpServer = createServer(app);

// Socket.io for real-time features
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
    },
});

// Track delivery agents and orders (in-memory for simplicity)
const activeDeliveryAgents = new Map();
const activeChatRooms = new Map();

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join chat room
    socket.on('join_chat', (roomId) => {
        socket.join(roomId);
        activeChatRooms.set(socket.id, roomId);
        console.log(`User joined chat room: ${roomId}`);
    });

    // Leave chat room
    socket.on('leave_chat', (roomId) => {
        socket.leave(roomId);
        activeChatRooms.delete(socket.id);
        console.log(`User left chat room: ${roomId}`);
    });

    // Listen for delivery agent location updates
    socket.on('update_location', (data) => {
        activeDeliveryAgents.set(socket.id, data);
        io.emit('delivery_agents', Array.from(activeDeliveryAgents.values()));
    });

    // Listen for order status updates
    socket.on('order_status', (orderId, status) => {
        io.emit(`order_${orderId}`, { status });
    });

    // Listen for new messages
    socket.on('new_message', (message) => {
        const roomId = activeChatRooms.get(socket.id);
        if (roomId) {
            io.to(roomId).emit('message', message);
        }
    });

    // Listen for message read status
    socket.on('message_read', (data) => {
        const roomId = activeChatRooms.get(socket.id);
        if (roomId) {
            io.to(roomId).emit('messages_read', data);
        }
    });

    socket.on('disconnect', () => {
        activeDeliveryAgents.delete(socket.id);
        activeChatRooms.delete(socket.id);
        console.log('Client disconnected:', socket.id);
    });
});

// Make io accessible to routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// MongoDB Connection with enhanced logging and options
console.log('Attempting to connect to MongoDB...');
console.log('Connection string:', process.env.MONGODB_URI);

const mongooseOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    retryWrites: true,
    w: 'majority'
};

// Function to connect to MongoDB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
        console.log('Successfully connected to MongoDB!');
        console.log('Database name:', conn.connection.name);
        console.log('Host:', conn.connection.host);
        console.log('Port:', conn.connection.port);
        return conn;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            codeName: error.codeName,
            stack: error.stack
        });
        process.exit(1);
    }
};

// Connect to MongoDB
connectDB();

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
    console.log('Connection state:', mongoose.connection.readyState);
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
    console.error('Connection state:', mongoose.connection.readyState);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB');
    console.log('Connection state:', mongoose.connection.readyState);
});

// Security Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate Limiting (100 requests per 15 minutes)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
});
app.use(limiter);

// Body Parser
app.use(express.json({ limit: '10kb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tracking', trackingRoutes);

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error' });
});

// Start Server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

// Export for testing
module.exports = app;