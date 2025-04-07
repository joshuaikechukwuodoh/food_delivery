const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    messageType: {
        type: String,
        enum: ['text', 'image', 'location', 'status_update', 'issue_report'],
        default: 'text'
    },
    attachments: [{
        type: String, // URLs to stored files
        contentType: String // MIME type of the attachment
    }],
    isRead: {
        type: Boolean,
        default: false
    },
    roomId: {
        type: String,
        required: true,
        index: true
    },
    metadata: {
        senderRole: {
            type: String,
            enum: ['customer', 'delivery_agent', 'admin'],
            required: true
        },
        receiverRole: {
            type: String,
            enum: ['customer', 'delivery_agent', 'admin'],
            required: true
        },
        isReported: {
            type: Boolean,
            default: false
        },
        reportDetails: {
            reportedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            reason: String,
            timestamp: Date
        }
    }
}, {
    timestamps: true
});

// Index for faster queries
MessageSchema.index({ roomId: 1, createdAt: -1 });
MessageSchema.index({ sender: 1, receiver: 1 });
MessageSchema.index({ order: 1 });
MessageSchema.index({ 'metadata.isReported': 1 });

// Method to mark messages as read
MessageSchema.statics.markAsRead = async function (messageIds, userId) {
    return this.updateMany(
        {
            _id: { $in: messageIds },
            receiver: userId,
            isRead: false
        },
        { $set: { isRead: true } }
    );
};

// Method to get unread count
MessageSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({
        receiver: userId,
        isRead: false
    });
};

// Method to report a message
MessageSchema.methods.reportMessage = async function (userId, reason) {
    this.metadata.isReported = true;
    this.metadata.reportDetails = {
        reportedBy: userId,
        reason: reason,
        timestamp: new Date()
    };
    return this.save();
};

// Method to get reported messages
MessageSchema.statics.getReportedMessages = async function () {
    return this.find({ 'metadata.isReported': true })
        .populate('sender', 'name role')
        .populate('receiver', 'name role')
        .populate('order')
        .populate('metadata.reportDetails.reportedBy', 'name role');
};

// Method to get conversation participants
MessageSchema.statics.getConversationParticipants = async function (roomId) {
    const message = await this.findOne({ roomId })
        .select('sender receiver metadata')
        .populate('sender', 'name role')
        .populate('receiver', 'name role');

    if (!message) return null;

    return {
        sender: message.sender,
        receiver: message.receiver,
        roles: {
            sender: message.metadata.senderRole,
            receiver: message.metadata.receiverRole
        }
    };
};

const Message = mongoose.model('Message', MessageSchema);

module.exports = Message; 