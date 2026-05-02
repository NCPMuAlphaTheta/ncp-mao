import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';
import { attachUser, isAuthenticated, hasRole } from './middleware/auth.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Static files
app.use(express.static('public'));

// View engine
app.set('view engine', 'ejs');
app.set('views', './views');

// Attach user to all routes
app.use(attachUser);

// Routes
app.use('/auth', authRoutes);

// API routes
app.use('/api', apiRoutes);

// Public routes
app.get('/', (req, res) => {
  res.render("home");
});

app.get('/resources', (req, res) => {
  res.render("resources");
});

app.get('/ai', (req, res) => {
  res.render("ai");
});

// MAT Portal (Login/Register page)
app.get('/mat', (req, res) => {
  res.render("mat", {
    error: req.query.error,
    success: req.query.success,
    warning: req.query.warning
  });
});

// Check-in
app.get("/check-in", attachUser, (req, res) => {
  res.render("checkin", {
    title: 'Check-in',
    user: res.locals.user,
    error: req.query.error,
    success: req.query.success,
    warning: req.query.warning,
    mathTablesRequired: req.query.mathTablesRequired === 'true'
  });
});

// Protected dashboard routes
app.get('/dashboard/student', isAuthenticated, hasRole(['student']), (req, res) => {
  res.render('student-dashboard', {
    user: req.user,
    title: 'Student Dashboard'
  });
});

app.get('/dashboard/teacher', isAuthenticated, hasRole(['teacher']), (req, res) => {
  res.render('teacher-dashboard', {
    user: req.user,
    title: 'Teacher Dashboard'
  });
});



// Logout route (redirect)
app.get('/logout', (req, res) => {
  res.redirect('/auth/logout');
});

// Email verification route
app.get('/verify-email/:token', (req, res) => {
  res.redirect(`/auth/verify-email/${req.params.token}`);
});

// Password reset routes
app.get('/reset-password/:token', (req, res) => {
  res.redirect(`/auth/reset-password/${req.params.token}`);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    message: 'The page you are looking for does not exist.',
    user: res.locals.user
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).render('error', {
    title: 'Server Error',
    message: 'Something went wrong on our end.',
    user: res.locals.user
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to see the application`);
  console.log(`Visit http://localhost:${PORT}/mat to access the authentication portal`);
});