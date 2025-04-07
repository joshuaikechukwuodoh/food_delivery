# 🍔 Food Delivery Site

A full-stack food delivery platform built with Node.js, Express, MongoDB, and [other technologies you're using].

## ✨ Features

- **User Roles**:
  - 🧑‍🍳 Restaurant owners - Manage menus and orders
  - 🚴 Delivery agents - Real-time order tracking
  - 👨‍💻 Customers - Browse restaurants, place orders
- **Core Functionality**:
  - 📍 Live order tracking with geolocation
  - 💳 Secure payment integration
  - ⏱️ Estimated delivery time calculation
  - 📊 Order history and analytics
- **Tech Highlights**:
  - Real-time updates with Socket.io
  - JWT authentication
  - MongoDB geospatial queries

## 🛠️ Tech Stack

**Backend**:

- Node.js
- Express
- MongoDB (Mongoose)
- Socket.io
- JWT Authentication

**Frontend**: _(if applicable)_

- React/Vue/Angular
- Google Maps API
- Bootstrap/Tailwind CSS

## 🚀 Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/joshuaikechukwuodoh/food-delivery-site.git
   cd food-delivery-site
   ```

   ```
   Test the site
   Based on the server.js and route files, here are the main API endpoints you can test:
   Authentication:
   POST /api/auth/register - Register a new user
   POST /api/auth/login - Login user
   POST /api/auth/logout - Logout user
   Users:
   GET /api/users/profile - Get user profile
   PUT /api/users/profile - Update user profile
   Restaurants:
   GET /api/restaurants - Get all restaurants
   GET /api/restaurants/:id - Get specific restaurant
   POST /api/restaurants - Create restaurant (admin only)
   Orders:
   POST /api/orders - Create new order
   GET /api/orders - Get user's orders
   GET /api/orders/:id - Get specific order
   PUT /api/orders/:id/status - Update order status
   Payments:
   POST /api/payments/create - Create payment
   POST /api/payments/verify - Verify payment
   Chat:
   WebSocket connection for real-time chat
   Tracking:
   WebSocket connection for real-time order tracking
   To test these endpoints, you can use tools like:
   Postman
   ```
