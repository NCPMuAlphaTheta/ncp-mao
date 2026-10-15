import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import emailService from '../services/emailService.js';
import { redirectIfAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// Validation rules
const registerValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be between 1-50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be between 1-50 characters'),
  
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3-30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address')
    .custom((value, { req }) => {
      // If registering as a teacher, validate against approved email list
      if (req.body.role === 'teacher') {
        const approvedTeacherEmails = process.env.TEACHER_EMAILS?.split(',').map(email => email.trim()) || [];
        if (!approvedTeacherEmails.includes(value)) {
          throw new Error('This email is not authorized to create a teacher account. Please contact administration.');
        }
      }
      return true;
    }),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  
  body('role')
    .isIn(['student', 'teacher'])
    .withMessage('Role must be either student or teacher')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address')
];

const resetPasswordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    })
];

// Register route
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.redirect(`/mat?error=${encodeURIComponent(errorMessages.join('. '))}`);
    }

    const { firstName, lastName, username, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.redirect(`/mat?error=${encodeURIComponent(`This ${field} is already registered`)}`);
    }

    // Create new user
    const user = new User({
      firstName,
      lastName,
      username,
      email,
      password,
      role
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user, verificationToken, req);
      res.redirect(`/mat?success=${encodeURIComponent('Registration successful! Please check your email to verify your account.')}`);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // In development mode or if no email service, auto-verify the user
      if (process.env.NODE_ENV === 'development' || !process.env.EMAIL_USER) {
        user.isEmailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerificationExpires = null;
        await user.save();
        
        res.redirect(`/mat?success=${encodeURIComponent('Registration successful! You can now log in.')}`);
      } else {
        res.redirect(`/mat?warning=${encodeURIComponent('Account created but verification email failed to send. Please contact support.')}`);
      }
    }

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.redirect(`/mat?error=${encodeURIComponent(`This ${field} is already registered`)}`);
    }
    
    if (error.name === 'ValidationError') {
      const errorMessages = Object.values(error.errors).map(err => err.message);
      return res.redirect(`/mat?error=${encodeURIComponent(errorMessages.join('. '))}`);
    }
    
    res.redirect(`/mat?error=${encodeURIComponent('Registration failed. Please try again.')}`);
  }
});

// Login route
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.redirect(`/mat?error=${encodeURIComponent(errorMessages.join('. '))}`);
    }

    const { email, password, redirectTo } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      const backUrl = redirectTo ? `${redirectTo}?error=` : '/mat?error=';
      return res.redirect(`${backUrl}${encodeURIComponent('Invalid email or password')}`);
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      const backUrl = redirectTo ? `${redirectTo}?error=` : '/mat?error=';
      return res.redirect(`${backUrl}${encodeURIComponent('Invalid email or password')}`);
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      const backUrl = redirectTo ? `${redirectTo}?error=` : '/mat?error=';
      return res.redirect(`${backUrl}${encodeURIComponent('Please verify your email address first. Check your inbox for the verification link.')}`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Store token in session
    req.session.token = token;

    // Redirect to specified page or appropriate dashboard
    const redirectUrl = redirectTo || `/dashboard/${user.role}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Login error:', error);
    res.redirect(`/mat?error=${encodeURIComponent('Login failed. Please try again.')}`);
  }
});

// Forgot password route
router.post('/forgot-password', forgotPasswordValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.redirect(`/mat?error=${encodeURIComponent(errorMessages.join('. '))}`);
    }

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.redirect(`/mat?success=${encodeURIComponent('If an account with this email exists, a password reset link has been sent.')}`);
    }

    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(user, resetToken, req);
      res.redirect(`/mat?success=${encodeURIComponent('If an account with this email exists, a password reset link has been sent.')}`);
    } catch (emailError) {
      console.error('Password reset email failed:', emailError);
      res.redirect(`/mat?error=${encodeURIComponent('Failed to send password reset email. Please try again.')}`);
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    res.redirect(`/mat?error=${encodeURIComponent('Password reset failed. Please try again.')}`);
  }
});

// Email verification route
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect(`/mat?error=${encodeURIComponent('Invalid or expired verification token')}`);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.redirect(`/mat?success=${encodeURIComponent('Email verified successfully! You can now log in.')}`);

  } catch (error) {
    console.error('Email verification error:', error);
    res.redirect(`/mat?error=${encodeURIComponent('Email verification failed. Please try again.')}`);
  }
});

// Reset password page
router.get('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect(`/mat?error=${encodeURIComponent('Invalid or expired reset token')}`);
    }

    res.render('reset-password', { 
      title: 'Reset Password',
      token,
      error: req.query.error,
      success: req.query.success
    });

  } catch (error) {
    console.error('Reset password page error:', error);
    res.redirect(`/mat?error=${encodeURIComponent('Reset password page failed to load.')}`);
  }
});

// Reset password form submission
router.post('/reset-password/:token', resetPasswordValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg);
      return res.redirect(`/auth/reset-password/${req.params.token}?error=${encodeURIComponent(errorMessages.join('. '))}`);
    }

    const { token } = req.params;
    const { password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.redirect(`/mat?error=${encodeURIComponent('Invalid or expired reset token')}`);
    }

    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.redirect(`/mat?success=${encodeURIComponent('Password reset successfully! You can now log in with your new password.')}`);

  } catch (error) {
    console.error('Reset password error:', error);
    res.redirect(`/auth/reset-password/${req.params.token}?error=${encodeURIComponent('Password reset failed. Please try again.')}`);
  }
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/mat?success=' + encodeURIComponent('Logged out successfully'));
  });
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.redirect(`/mat?error=${encodeURIComponent('User not found')}`);
    }

    if (user.isEmailVerified) {
      return res.redirect(`/mat?warning=${encodeURIComponent('Email is already verified')}`);
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Send verification email
    await emailService.sendVerificationEmail(user, verificationToken, req);

    res.redirect(`/mat?success=${encodeURIComponent('Verification email sent! Please check your inbox.')}`);

  } catch (error) {
    console.error('Resend verification error:', error);
    res.redirect(`/mat?error=${encodeURIComponent('Failed to resend verification email. Please try again.')}`);
  }
});

export default router;
