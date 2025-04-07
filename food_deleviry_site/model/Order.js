const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true
    },
    deliveryAgent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryAgent'
    },
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'MenuItem',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        }
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
        default: 'pending'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    deliveryAddress: {
        type: {
            street: String,
            city: String,
            state: String,
            zipCode: String,
            coordinates: {
                type: [Number],
                index: '2dsphere'
            }
        },
        required: true
    },
    trackingHistory: [{
        status: String,
        location: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: [Number]
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        description: String
    }],
    estimatedDeliveryTime: {
        type: Date
    },
    actualDeliveryTime: {
        type: Date
    },
    specialInstructions: String,
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    feedback: String,
    deliveryTimeWindow: {
        preferredTime: {
            start: Date,
            end: Date
        },
        isFlexible: {
            type: Boolean,
            default: false
        }
    },
    priority: {
        type: String,
        enum: ['normal', 'high', 'urgent'],
        default: 'normal'
    },
    routeOptimization: {
        distance: Number,
        estimatedTime: Number,
        waypoints: [{
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: [Number],
            name: String,
            order: Number
        }]
    },
    notifications: [{
        type: {
            type: String,
            enum: ['status_update', 'location_update', 'delay', 'arrival'],
            required: true
        },
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        read: {
            type: Boolean,
            default: false
        }
    }]
}, {
    timestamps: true
});

// Index for geospatial queries
OrderSchema.index({ 'deliveryAddress.coordinates': '2dsphere' });

// Method to update order status
OrderSchema.methods.updateStatus = async function (newStatus, location, description) {
    this.status = newStatus;
    this.trackingHistory.push({
        status: newStatus,
        location: location,
        description: description || `Order status changed to ${newStatus}`
    });

    if (newStatus === 'delivered') {
        this.actualDeliveryTime = Date.now();
    }

    return this.save();
};

// Method to assign delivery agent
OrderSchema.methods.assignDeliveryAgent = async function (agentId) {
    this.deliveryAgent = agentId;
    this.status = 'confirmed';
    this.trackingHistory.push({
        status: 'confirmed',
        description: 'Delivery agent assigned'
    });
    return this.save();
};

// Method to update location
OrderSchema.methods.updateLocation = async function (latitude, longitude) {
    this.trackingHistory.push({
        status: this.status,
        location: {
            type: 'Point',
            coordinates: [longitude, latitude]
        },
        description: 'Location updated'
    });
    return this.save();
};

// Method to assign optimal delivery agent
OrderSchema.methods.assignOptimalAgent = async function () {
    const deliveryLocation = this.deliveryAddress.coordinates;

    // Find available agents within 5km radius
    const availableAgents = await DeliveryAgent.find({
        status: 'available',
        currentLocation: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: deliveryLocation
                },
                $maxDistance: 5000 // 5km in meters
            }
        }
    }).sort({ rating: -1, totalDeliveries: 1 });

    if (availableAgents.length > 0) {
        const bestAgent = availableAgents[0];
        await this.assignDeliveryAgent(bestAgent._id);

        // Add notification
        this.notifications.push({
            type: 'status_update',
            message: `Delivery agent ${bestAgent.name} assigned to your order`
        });

        return bestAgent;
    }

    return null;
};

// Method to optimize delivery route
OrderSchema.methods.optimizeRoute = async function () {
    if (!this.deliveryAgent) return;

    const agent = await DeliveryAgent.findById(this.deliveryAgent);
    if (!agent) return;

    const waypoints = [
        {
            coordinates: agent.currentLocation.coordinates,
            name: 'Current Location',
            order: 0
        },
        {
            coordinates: this.deliveryAddress.coordinates,
            name: 'Delivery Address',
            order: 1
        }
    ];

    // Calculate distance and estimated time
    const distance = calculateDistance(
        waypoints[0].coordinates[1],
        waypoints[0].coordinates[0],
        waypoints[1].coordinates[1],
        waypoints[1].coordinates[0]
    );

    // Estimate time based on vehicle type and traffic
    const speed = agent.vehicleType === 'bicycle' ? 15 :
        agent.vehicleType === 'motorcycle' ? 30 : 40; // km/h

    const estimatedTime = (distance / speed) * 60; // in minutes

    this.routeOptimization = {
        distance,
        estimatedTime,
        waypoints
    };

    return this.save();
};

// Method to send notification
OrderSchema.methods.sendNotification = async function (type, message) {
    this.notifications.push({
        type,
        message,
        timestamp: Date.now()
    });
    return this.save();
};

module.exports = mongoose.model('Order', OrderSchema);