const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Doctor = require('../models/Doctors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Check if JWT_SECRET is set
if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set');
    process.exit(1);
}

// Authorization middleware
const auth = async (req, res, next) => {
    try {
        const { mdcnNumber } = req.body;
        if (!mdcnNumber) {
            return res.status(401).json({ message: 'MDCN number is required' });
        }

        const doctor = await Doctor.findOne({ mdcnNumber });
        if (!doctor) {
            return res.status(401).json({ message: 'Unauthorized - Doctor not found' });
        }


        req.doctor = doctor;
        next();
    } catch (error) {
        console.error('Authorization error:', error);
        res.status(500).json({ message: 'Error in authorization' });
    }
};

// Register a new doctor
router.post('/doctor/register', async (req, res) => {
    try {
        const { fullname, email, password, phone, address, gender, age, image, mdcnNumber } = req.body;

        // Validate required fields
        if (!fullname || !email || !password || !mdcnNumber) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        // Check if doctor already exists
        const existingDoctor = await Doctor.findOne({ $or: [{ email }, { mdcnNumber }] });
        if (existingDoctor) {
            return res.status(400).json({
                message: 'Doctor already exists',
                details: existingDoctor.email === email ? 'Email already registered' : 'MDCN number already registered'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new doctor
        const newDoctor = new Doctor({
            fullname,
            email,
            password: hashedPassword,
            phone,
            address,
            gender,
            age,
            image,
            mdcnNumber
        });

        await newDoctor.save();

        res.status(201).json({
            message: 'Doctor registered successfully',
            doctor: {
                id: newDoctor._id,
                fullname: newDoctor.fullname,
                email: newDoctor.email,
                mdcnNumber: newDoctor.mdcnNumber
            }
        });
    } catch (error) {
        console.error('Doctor registration error:', error);
        res.status(500).json({
            message: 'Error registering doctor',
            error: error.message
        });
    }
});

// Login a doctor
router.post('/doctor/login', async (req, res) => {
    try {
        const { email, password, mdcnNumber } = req.body;

        // Validate required fields
        if (!email || !password || !mdcnNumber) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const doctor = await Doctor.findOne({ email, mdcnNumber });
        if (!doctor) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, doctor.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: doctor._id, mdcnNumber: doctor.mdcnNumber },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            doctor: {
                id: doctor._id,
                fullname: doctor.fullname,
                email: doctor.email,
                mdcnNumber: doctor.mdcnNumber
            }
        });
    } catch (error) {
        console.error('Doctor login error:', error);
        res.status(500).json({
            message: 'Error logging in',
            error: error.message
        });
    }
});

// Register a new user
router.post('/user/register', async (req, res) => {
    try {
        const { fullname, email, password, phone, address, gender, age, image } = req.body;

        // Validate required fields
        if (!fullname || !email || !password) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({
            fullname,
            email,
            password: hashedPassword,
            phone,
            address,
            gender,
            age,
            image
        });

        await newUser.save();

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser._id,
                fullname: newUser.fullname,
                email: newUser.email
            }
        });
    } catch (error) {
        console.error('User registration error:', error);
        res.status(500).json({
            message: 'Error registering user',
            error: error.message
        });
    }
});

// Login a user
router.post('/user/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                fullname: user.fullname,
                email: user.email
            }
        });
    } catch (error) {
        console.error('User login error:', error);
        res.status(500).json({
            message: 'Error logging in',
            error: error.message
        });
    }
});

module.exports = router;








