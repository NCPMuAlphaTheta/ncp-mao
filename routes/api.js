import express from 'express';
import googleSheetsService from '../services/googleSheetsService.js';
import SessionSignup from '../models/SessionSignup.js';
import User from '../models/User.js';
import CheckIn from '../models/CheckIn.js';
import Settings from '../models/Settings.js';
import HourAdjustment from '../models/HourAdjustment.js';
import emailService from '../services/emailService.js';
import { isAuthenticated } from '../middleware/auth.js';
import Meeting from '../models/Meeting.js';

const router = express.Router();

// Get tutoring schedule
router.get('/tutoring-schedule', isAuthenticated, async (req, res) => {
  try {
    let schedule = [];

    // Check if Google Sheets is configured
    if (googleSheetsService.isConfigured()) {
      try {
        // Get schedule from Google Sheets (now includes tutor signups)
        schedule = await googleSheetsService.getTutoringSchedule();
      } catch (sheetsError) {
        console.warn('Google Sheets not available, using fallback data:', sheetsError.message);
        schedule = getFallbackSchedule();
      }
    } else {
      console.warn('Google Sheets not configured, using fallback data');
      schedule = getFallbackSchedule();
    }

    res.json(schedule);
  } catch (error) {
    console.error('Error fetching tutoring schedule:', error);
    res.status(500).json({ error: 'Failed to fetch tutoring schedule' });
  }
});

// Fallback schedule data for demo purposes
function getFallbackSchedule() {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Generate some sample data for the current month based on your sheet structure
  const schedule = [];

  // Generate sessions for the current month
  for (let day = 1; day <= 30; day++) {
    const date = new Date(currentYear, currentMonth, day);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    // Monday sessions
    if (dayOfWeek === 1) {
      schedule.push(
        {
          date: dateStr,
          day: 'Monday',
          maxTutors: 6,
          time: '3:15 PM - 4:15 PM',
          room: '320',
          cancelled: false
        },
        {
          date: dateStr,
          day: 'Monday',
          maxTutors: 4,
          time: '10:03 AM - 10:33 AM',
          room: 'Library',
          cancelled: false
        },
        {
          date: dateStr,
          day: 'Monday',
          maxTutors: 4,
          time: '10:53 AM - 11:23 AM',
          room: 'Library',
          cancelled: false
        },
        {
          date: dateStr,
          day: 'Monday',
          maxTutors: 4,
          time: '11:51 AM - 12:21 PM',
          room: 'Library',
          cancelled: false
        },
        {
          date: dateStr,
          day: 'Monday',
          maxTutors: 4,
          time: '12:41 PM - 1:11 PM',
          room: 'Library',
          cancelled: false
        }
      );
    }

    // Tuesday sessions
    if (dayOfWeek === 2) {
      schedule.push({
        date: dateStr,
        day: 'Tuesday',
        maxTutors: 4,
        time: '7:20 AM - 7:50 AM',
        room: 'Room 103',
        cancelled: false
      });
    }

    // Thursday sessions
    if (dayOfWeek === 4) {
      schedule.push(
        {
          date: dateStr,
          day: 'Thursday',
          maxTutors: 4,
          time: '7:20 AM - 7:50 AM',
          room: 'Room 103',
          cancelled: false
        },
        {
          date: dateStr,
          day: 'Thursday',
          maxTutors: 6,
          time: '3:15 PM - 4:15 PM',
          room: '320',
          cancelled: false
        }
      );
    }

    // Friday sessions
    if (dayOfWeek === 5) {
      schedule.push(
        {
          date: dateStr,
          day: 'Friday',
          maxTutors: 4,
          time: '10:03 AM - 10:33 AM',
          room: 'Library',
          cancelled: false
        },
        {
          date: dateStr,
          day: 'Friday',
          maxTutors: 4,
          time: '10:53 AM - 11:23 AM',
          room: 'Library',
          cancelled: false
        },
        {
          date: dateStr,
          day: 'Friday',
          maxTutors: 4,
          time: '11:51 AM - 12:21 PM',
          room: 'Library',
          cancelled: false
        },
        {
          date: dateStr,
          day: 'Friday',
          maxTutors: 4,
          time: '12:41 PM - 1:11 PM',
          room: 'Library',
          cancelled: false
        }
      );
    }
  }

  return schedule;
}

// Sign up for a session
router.post('/signup-session', isAuthenticated, async (req, res) => {
  try {
    const { date, time, userId } = req.body;
    const userName = `${req.user.firstName} ${req.user.lastName}`;

    // Validate that the user is signing up for themselves
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Get session details from Google Sheets
    const sessionData = await googleSheetsService.getSessionData(date, time);

    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (sessionData.cancelled) {
      return res.status(400).json({
        success: false,
        message: 'This session has been cancelled'
      });
    }

    // Add tutor to Google Sheets
    await googleSheetsService.addTutorToSession(date, time, userName);

    res.json({
      success: true,
      message: 'Successfully signed up for the session'
    });
  } catch (error) {
    console.error('Error signing up for session:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to sign up for session'
    });
  }
});

// Cancel session signup
router.post('/cancel-signup', isAuthenticated, async (req, res) => {
  try {
    const { date, time, userId } = req.body;
    const userName = `${req.user.firstName} ${req.user.lastName}`;

    // Validate that the user is cancelling their own signup
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // Remove tutor from Google Sheets
    await googleSheetsService.removeTutorFromSession(date, time, userName);

    res.json({
      success: true,
      message: 'Successfully cancelled signup'
    });
  } catch (error) {
    console.error('Error cancelling signup:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel signup'
    });
  }
});

// Get user's signups
router.get('/my-signups', isAuthenticated, async (req, res) => {
  try {
    const userName = `${req.user.firstName} ${req.user.lastName}`;

    // Get all sessions from Google Sheets
    const schedule = await googleSheetsService.getTutoringSchedule();

    // Filter sessions where the user is signed up
    const userSignups = [];

    for (const session of schedule) {
      // Check if user is in this session's tutor list
      const userTutor = session.tutors.find(tutor => tutor.name === userName);
      if (userTutor) {
        userSignups.push({
          date: session.date,
          time: session.time,
          room: session.room,
          day: session.day,
          checkedIn: userTutor.checkedIn,
          cancelled: session.cancelled,
          displayStatus: session.cancelled ? 'session_cancelled' :
            userTutor.checkedIn ? 'attended' : 'signed_up'
        });
      }
    }

    // Sort by date and time
    userSignups.sort((a, b) => {
      const dateA = new Date(a.date + 'T' + convertTimeToISO(a.time));
      const dateB = new Date(b.date + 'T' + convertTimeToISO(b.time));
      return dateA - dateB;
    });

    res.json(userSignups);
  } catch (error) {
    console.error('Error fetching user signups:', error);
    res.status(500).json({ error: 'Failed to fetch signups' });
  }
});

// --- Settings & Configuration Routes ---

// Get current settings
router.get('/settings', isAuthenticated, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings (teachers only)
router.post('/settings', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    if (req.body.penaltyMonth) settings.penaltyMonth = req.body.penaltyMonth;
    if (req.body.memberRequirements) settings.memberRequirements = req.body.memberRequirements;
    if (req.body.sessionDefaults) settings.sessionDefaults = req.body.sessionDefaults;
    await settings.save();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Batch update member types (teachers only)
router.post('/members/update-type', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const { updates } = req.body; // Array of { userId, memberType }
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid updates format' });
    }

    const allowedTypes = ['New', 'Old', 'FreshMentors', 'Officer'];
    for (const update of updates) {
      if (!allowedTypes.includes(update.memberType)) {
        return res.status(400).json({ error: `Invalid member type: ${update.memberType}. Allowed: ${allowedTypes.join(', ')}` });
      }
    }

    const operations = updates.map(update => ({
      updateOne: {
        filter: { _id: update.userId },
        update: { $set: { memberType: update.memberType } }
      }
    }));

    if (operations.length > 0) {
      await User.bulkWrite(operations);
    }

    res.json({ success: true, message: 'Member types updated' });
  } catch (error) {
    console.error('Error updating member types:', error);
    res.status(500).json({ error: 'Failed to update member types' });
  }
});

// Create hour adjustment (teachers only)
router.post('/hours/adjust', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const { userId, amount, reason, monthApplied } = req.body;

    // Validate inputs
    if (amount === undefined || !reason || !monthApplied) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const adjustment = new HourAdjustment({
      userId: userId || null, // null means "All"
      amount,
      reason,
      monthApplied
    });

    await adjustment.save();

    // Log to Google Sheets
    try {
      let userForSheet = { firstName: 'All', lastName: 'Students', memberType: 'N/A' };
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          userForSheet = user;
        }
      }
      await googleSheetsService.logAdjustment(adjustment, userForSheet);
    } catch (sheetError) {
      console.error('Failed to log to sheet:', sheetError);
    }

    res.json({ success: true, adjustment });
  } catch (error) {
    console.error('Error creating hour adjustment:', error);
    res.status(500).json({ error: 'Failed to create adjustment' });
  }
});

// Get hour adjustments (teachers only)
router.get('/hours/adjustments', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const adjustments = await HourAdjustment.find().populate('userId', 'firstName lastName').sort({ createdAt: -1 });
    res.json(adjustments);
  } catch (error) {
    console.error('Error fetching adjustments:', error);
    res.status(500).json({ error: 'Failed to fetch adjustments' });
  }
});

// Delete hour adjustment
router.delete('/hours/adjustments/:id', isAuthenticated, isTeacher, async (req, res) => {
  try {
    await HourAdjustment.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting adjustment:', error);
    res.status(500).json({ error: 'Failed to delete adjustment' });
  }
});

// Get all students with their member type (teachers only) - simplified list
router.get('/students-list', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const students = await User.find({ role: 'student' }).select('firstName lastName memberType email');
    res.json(students);
  } catch (error) {
    console.error('Error fetching students list:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});


// Teacher-only endpoints
function isTeacher(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ success: false, message: 'Teacher access required' });
  }
  next();
}

// Update session details (teachers only)
// Update session details (teachers only)
router.post('/update-session', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const { date, time, updates, applyToFuture } = req.body; // Added applyToFuture

    console.log('Update session request:', { date, time, updates, applyToFuture });

    // Validate required fields
    if (!date || !time || !updates) {
      console.log('Validation failed: missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Date, time, and updates are required'
      });
    }

    // Check if Google Sheets is configured
    if (!googleSheetsService.isConfigured()) {
      console.log('Google Sheets not configured');
      return res.status(500).json({
        success: false,
        message: 'Google Sheets not configured'
      });
    }

    // Get current session details before updating
    console.log('Getting current schedule...');
    const currentSchedule = await googleSheetsService.getTutoringSchedule();
    const currentSession = currentSchedule.find(session =>
      session.date === date && session.time === time
    );

    if (!currentSession) {
      console.log('Session not found:', { date, time });
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    console.log('Found current session:', currentSession);

    // Find all students signed up for this session
    console.log('Finding affected signups...');
    const affectedSignups = await SessionSignup.find({
      date: date,
      time: time,
      status: 'signed_up'
    }).populate('userId', 'firstName lastName email');

    console.log('Found affected signups:', affectedSignups.length);

    // Update the session in Google Sheets first
    console.log('Updating session in Google Sheets...');
    await googleSheetsService.updateSession(date, time, updates);

    // Provide a way to update future sessions if requested
    if (applyToFuture) {
      try {
        const allSessions = await googleSheetsService.getTutoringSchedule();
        const currentSessionDate = new Date(date);
        // find subsequent sessions with same day/time
        // We need to match day of week and time.
        // The simple check is: same time, date > currentSessionDate

        // However, "Apply to future sessions" usually implies "sessions of this series".
        // Since we don't have series IDs, we'll assume same Day of Week + Same Time + Same Room (maybe?)
        // Let's stick to Same Time + Same Day of Week (implicit in date) + Date > current

        const targetDay = currentSession.day;

        const futureSessions = allSessions.filter(s => {
          const sDate = new Date(s.date);
          return sDate > currentSessionDate && s.time === time && s.day === targetDay;
        });

        console.log(`Found ${futureSessions.length} future sessions to update.`);

        for (const fs of futureSessions) {
          await googleSheetsService.updateSession(fs.date, fs.time, updates);
        }
      } catch (futureError) {
        console.error('Error updating future sessions:', futureError);
        // Don't fail the request, just log it
      }
    }

    console.log('Session updated in Google Sheets successfully');

    // Determine what changed
    const changes = {};
    const changeReasons = [];

    if (updates.time && updates.time !== currentSession.time) {
      changes.time = updates.time;
      changeReasons.push(`Time changed from ${currentSession.time} to ${updates.time}`);
    }
    if (updates.room && updates.room !== currentSession.room) {
      changes.room = updates.room;
      changeReasons.push(`Room changed from ${currentSession.room || 'TBD'} to ${updates.room}`);
    }
    if (updates.maxTutors && updates.maxTutors !== currentSession.maxTutors) {
      changes.maxTutors = updates.maxTutors;
      changeReasons.push(`Max tutors changed from ${currentSession.maxTutors} to ${updates.maxTutors}`);
    }

    console.log('Changes detected:', changes);

    // Handle session cancellation
    if (updates.cancelled === true && !currentSession.cancelled) {
      console.log('Session cancelled, updating signups...');

      if (affectedSignups.length > 0) {
        // Update signups to reflect cancellation (only if there are signups)
        try {
          await SessionSignup.updateMany(
            { date: date, time: time, status: 'signed_up' },
            {
              status: 'session_cancelled',
              sessionStatus: 'cancelled',
              lastNotified: new Date(),
              changeReason: 'Session cancelled by teacher'
            }
          );
          console.log('Updated signups for cancellation');
        } catch (updateError) {
          console.log('Error updating signups for cancellation:', updateError.message);
        }
      }

      // Send cancellation emails to affected students
      for (const signup of affectedSignups) {
        if (signup.userId && signup.userId.email) {
          try {
            await emailService.sendSessionCancelledEmail(signup.userId, {
              date: date,
              time: currentSession.time,
              room: currentSession.room
            }, req);
          } catch (emailError) {
            console.log('Error sending cancellation email:', emailError.message);
          }
        }
      }

      changeReasons.push('Session cancelled');
    } else if (Object.keys(changes).length > 0) {
      console.log('Session updated, updating signups...');

      if (affectedSignups.length > 0) {
        // Session was updated but not cancelled
        try {
          await SessionSignup.updateMany(
            { date: date, time: time, status: 'signed_up' },
            {
              status: 'session_updated',
              sessionStatus: 'updated',
              lastNotified: new Date(),
              changeReason: changeReasons.join(', ')
            }
          );
          console.log('Updated signups for session changes');
        } catch (updateError) {
          console.log('Error updating signups for changes:', updateError.message);
        }
      }

      // Send update emails to affected students
      const newSessionDetails = { ...currentSession, ...updates };
      for (const signup of affectedSignups) {
        if (signup.userId && signup.userId.email) {
          try {
            await emailService.sendSessionUpdatedEmail(
              signup.userId,
              currentSession,
              newSessionDetails,
              changes,
              req
            );
          } catch (emailError) {
            console.log('Error sending update email:', emailError.message);
          }
        }
      }
    }

    console.log('Session update completed successfully');
    res.json({
      success: true,
      message: 'Session updated successfully',
      affectedStudents: affectedSignups.length,
      changes: changeReasons
    });
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({
      success: false,
      message: `Failed to update session: ${error.message}`
    });
  }
});

// Add new session (teachers only)
router.post('/add-session', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const { date, day, maxTutors, time, room } = req.body;

    // Validate required fields
    if (!date || !day || !maxTutors || !time || !room) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if Google Sheets is configured
    if (!googleSheetsService.isConfigured()) {
      return res.status(500).json({
        success: false,
        message: 'Google Sheets not configured'
      });
    }

    // Add the session to Google Sheets
    await googleSheetsService.addSession(date, day, maxTutors, time, room);

    res.json({
      success: true,
      message: 'Session added successfully'
    });
  } catch (error) {
    console.error('Error adding session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add session'
    });
  }
});

// Delete session (teachers only)
router.post('/delete-session', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const { date, time } = req.body;

    // Validate required fields
    if (!date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Date and time are required'
      });
    }

    // Check if Google Sheets is configured
    if (!googleSheetsService.isConfigured()) {
      return res.status(500).json({
        success: false,
        message: 'Google Sheets not configured'
      });
    }

    // Get session details before deletion
    const currentSchedule = await googleSheetsService.getTutoringSchedule();
    const sessionToDelete = currentSchedule.find(session =>
      session.date === date && session.time === time
    );

    // Find all students signed up for this session
    const affectedSignups = await SessionSignup.find({
      date: date,
      time: time,
      status: 'signed_up'
    }).populate('userId', 'firstName lastName email');

    // Update signups to reflect deletion
    await SessionSignup.updateMany(
      { date: date, time: time },
      {
        status: 'session_cancelled',
        sessionStatus: 'cancelled',
        lastNotified: new Date(),
        changeReason: 'Session deleted by teacher'
      }
    );

    // Send cancellation emails to affected students
    if (sessionToDelete) {
      for (const signup of affectedSignups) {
        if (signup.userId && signup.userId.email) {
          await emailService.sendSessionCancelledEmail(signup.userId, {
            date: date,
            time: time,
            room: sessionToDelete.room
          }, req);
        }
      }
    }

    // Delete the session from Google Sheets
    await googleSheetsService.deleteSession(date, time);

    res.json({
      success: true,
      message: 'Session deleted successfully',
      affectedStudents: affectedSignups.length
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete session'
    });
  }
});

// Get user's signups with status (for student dashboard)
// Helper function to convert time string to ISO format
function convertTimeToISO(timeString) {
  const [time, period] = timeString.split(' ');
  const [hours, minutes] = time.split(':');
  let hour24 = parseInt(hours);

  if (period === 'PM' && hour24 !== 12) {
    hour24 += 12;
  } else if (period === 'AM' && hour24 === 12) {
    hour24 = 0;
  }

  return `${hour24.toString().padStart(2, '0')}:${minutes}:00`;
}

// Helper function to get session hour for Math Tables requirement
function getSessionHour(timeString) {
  const [time, period] = timeString.split(' ');
  const [hours] = time.split(':');
  let hour24 = parseInt(hours);

  if (period === 'PM' && hour24 !== 12) {
    hour24 += 12;
  } else if (period === 'AM' && hour24 === 12) {
    hour24 = 0;
  }

  return hour24;
}

// Check-in route
router.post('/checkin', isAuthenticated, async (req, res) => {
  try {
    const { sessionDate, sessionTime, deviceFingerprint } = req.body;
    const userId = req.user.id;
    const userName = `${req.user.firstName} ${req.user.lastName}`;

    // Validate required fields
    if (!sessionDate || !sessionTime) {
      return res.redirect('/check-in?error=' + encodeURIComponent('Session date and time are required'));
    }


    // Validate session time format and check if it's within allowed window
    let now;
    try {
      // Always convert to the target timezone (Chicago) to match naive session times
      // fluctuating between local/UTC interpretation.
      const timeZone = process.env.TIMEZONE || "America/Chicago";
      const utcNow = new Date();
      now = new Date(utcNow.toLocaleString("en-US", { timeZone }));
    } catch (e) {
      console.error('Error getting current time:', e);
      now = new Date();
    }
    console.log('Current time:', now);

    let sessionStartTime, sessionEndTime;
    // Handle both simple times (e.g., "3:00 PM") and time ranges (e.g., "3:15 PM - 4:15 PM")
    if (sessionTime.includes(' - ')) {
      // Time range format
      const [startTime, endTime] = sessionTime.split(' - ');
      sessionStartTime = new Date(`${sessionDate}T${convertTimeToISO(startTime)}`);
      sessionEndTime = new Date(`${sessionDate}T${convertTimeToISO(endTime)}`);
    } else {
      // Simple time format - assume 1 hour session
      sessionStartTime = new Date(`${sessionDate}T${convertTimeToISO(sessionTime)}`);
      sessionEndTime = new Date(sessionStartTime.getTime() + 60 * 60 * 1000); // Add 1 hour
    }

    // Allow check-in from 15 min before start to 15 min after end
    const checkinWindowStart = new Date(sessionStartTime.getTime() - 15 * 60 * 1000);
    const checkinWindowEnd = new Date(sessionEndTime.getTime() + 15 * 60 * 1000);

    console.log('--- Check-in Debug ---');
    console.log('Server Time (UTC?):', new Date().toISOString());
    console.log('Calculated "Now" (Chicago Wall Time in UTC docker):', now.toISOString());
    console.log('Session Start:', sessionStartTime.toISOString());
    console.log('Window Start:', checkinWindowStart.toISOString());
    console.log('Window End:', checkinWindowEnd.toISOString());
    console.log('Is valid?', now >= checkinWindowStart && now <= checkinWindowEnd);
    console.log('----------------------');

    if (now < checkinWindowStart || now > checkinWindowEnd) {
      const timeInfo = sessionTime.includes(' - ')
        ? `between ${sessionTime}`
        : `at ${sessionTime}`;
      return res.redirect('/check-in?error=' + encodeURIComponent(`You can only check in from 15 minutes before until 15 minutes after your session time ${timeInfo}.`));
    }

    // Check if user has a signup for this session
    const schedule = await googleSheetsService.getTutoringSchedule();
    const session = schedule.find(s => s.date === sessionDate && s.time === sessionTime);

    if (!session) {
      return res.redirect('/check-in?error=' + encodeURIComponent('Session not found'));
    }

    // Check if user is signed up for this session
    const userTutor = session.tutors.find(tutor => tutor.name === userName);
    if (!userTutor) {
      return res.redirect('/check-in?error=' + encodeURIComponent('You are not signed up for this session'));
    }

    // Check if user is already checked in
    if (userTutor.checkedIn) {
      return res.redirect('/check-in?warning=' + encodeURIComponent('You have already checked in for this session'));
    }

    // Update check-in status in Google Sheets
    await googleSheetsService.updateTutorCheckIn(sessionDate, sessionTime, userName, true);

    // Check if Math Tables photo is required (sessions between 9 AM and 2 PM)
    const sessionHour = getSessionHour(sessionTime);
    const mathTablesRequired = sessionHour >= 9 && sessionHour <= 14;

    // Create check-in record in database

    const isWithinTimeWindow = now >= checkinWindowStart && now <= checkinWindowEnd;
    // Prevent duplicate check-ins for the same user/session
    const existingCheckIn = await CheckIn.findOne({
      userId: userId,
      sessionDate: sessionDate,
      sessionTime: sessionTime
    });

    if (!existingCheckIn) {
      const checkIn = new CheckIn({
        userId: userId,
        userName: userName,
        sessionDate: sessionDate,
        sessionTime: sessionTime,
        deviceFingerprint: deviceFingerprint,
        checkInTime: now,
        isWithinTimeWindow: isWithinTimeWindow,
        mathTablesRequired: mathTablesRequired
      });
      await checkIn.save();
    }
    // Always redirect with success message (even if already checked in in DB)
    const successMessage = 'Successfully checked in for your session!';
    let redirectUrl = '/check-in?success=' + encodeURIComponent(successMessage);
    if (mathTablesRequired) {
      redirectUrl += '&mathTablesRequired=true';
    }
    return res.redirect(redirectUrl);

  } catch (error) {
    console.error('Error during check-in:', error);
    res.redirect('/check-in?error=' + encodeURIComponent('An error occurred during check-in. Please try again.'));
  }
});

// Get student hours tracker data
router.get('/student-hours', isAuthenticated, async (req, res) => {
  try {
    // Get all students
    const students = await User.find({ role: 'student' }).select('firstName lastName memberType');

    // Get tutoring schedule from Google Sheets (which includes tutor check-ins)
    let schedule = [];

    // Check if Google Sheets is configured
    if (googleSheetsService.isConfigured()) {
      try {
        schedule = await googleSheetsService.getTutoringSchedule();
      } catch (sheetsError) {
        console.warn('Google Sheets not available for student hours:', sheetsError.message);
        // Fallback to database check-ins if Google Sheets unavailable
        return await getStudentHoursFromDatabase(students, res);
      }
    } else {
      console.warn('Google Sheets not configured for student hours');
      return await getStudentHoursFromDatabase(students, res);
    }

    // Fetch settings and adjustments
    const settings = await Settings.getSettings();
    const requirements = settings.memberRequirements;
    const adjustments = await HourAdjustment.find({});

    // Process the data to calculate monthly hours from Google Sheets with new requirements
    const studentHoursData = students.map(student => {
      const studentName = `${student.firstName} ${student.lastName}`;
      const memberType = student.memberType || 'New';

      // Filter adjustments for this student
      const studentAdjustments = adjustments.filter(adj =>
        (adj.userId && adj.userId.toString() === student._id.toString()) ||
        adj.userId === null // Apply "All" adjustments
      );

      // Calculate hours per month from Google Sheets tutoring sessions
      const monthlyHours = {};
      const monthlyRequirements = {};

      const academicMonths = ['09', '10', '11', '12', '01', '02', '03', '04', '05', '06'];

      // Initialize monthlyHours for all academic months
      academicMonths.forEach(m => monthlyHours[m] = 0);

      schedule.forEach(session => {
        // Check if this student was a tutor and checked in for this session
        const tutorEntry = session.tutors.find(tutor =>
          tutor.name && tutor.name.trim() === studentName && tutor.checkedIn
        );

        if (tutorEntry) {
          const date = new Date(session.date);
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();

          // Only count current academic year (September to June)
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth() + 1;

          // Determine academic year
          let academicYear;
          if (currentMonth >= 9) { // September or later
            academicYear = currentYear;
          } else { // January to August
            academicYear = currentYear - 1;
          }

          // Check if this session is in the current academic year
          const isCurrentAcademicYear =
            (year === academicYear && parseInt(month) >= 9) ||
            (year === academicYear + 1 && parseInt(month) <= 6);

          if (isCurrentAcademicYear) {
            // Each tutoring session represents hours based on numHours field or default to 1
            const hours = parseFloat(session.numHours) || 1;
            monthlyHours[month] += hours;
          }
        }
      });

      // Apply adjustments to monthly hours
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      let academicYear;
      if (currentMonth >= 9) {
        academicYear = currentYear;
      } else {
        academicYear = currentYear - 1;
      }

      studentAdjustments.forEach(adj => {
        if (monthlyHours[adj.monthApplied] !== undefined && (!adj.academicYear || adj.academicYear === academicYear)) {
          monthlyHours[adj.monthApplied] += adj.amount;
        }
      });

      // Calculate requirements for each month with penalty system
      let penaltyEligibleMissedHours = 0;

      for (const month of academicMonths) {

        // Fetch month's specific requirements or fall back to a generic default
        const monthReqs = settings.memberRequirements[month] || {
          New: { baseHours: 2.5, penaltyRate: 0.5 },
          Old: { baseHours: 1.0, penaltyRate: 0.5 },
          Officer: { baseHours: 0, penaltyRate: 0 }
        };
        const studentReqs = monthReqs[memberType] || monthReqs['New'];

        let requiredForMonth = studentReqs.baseHours;

        // Check strictly for penalty month
        const monthOrder = ['09', '10', '11', '12', '01', '02', '03', '04', '05', '06'];
        const penaltyStartIndex = monthOrder.indexOf(settings.penaltyMonth);
        const currentMonthIndex = monthOrder.indexOf(month);

        // Add penalty if applicable
        if (penaltyEligibleMissedHours > 0 && penaltyStartIndex !== -1 && currentMonthIndex >= penaltyStartIndex) {
          let penalty = penaltyEligibleMissedHours * studentReqs.penaltyRate;
          // Round down to nearest 0.5
          penalty = Math.floor(penalty * 2) / 2;
          requiredForMonth += penalty;
        }

        monthlyRequirements[month] = requiredForMonth;

        // Calculate missed hours for this month to carry forward
        const actualHours = monthlyHours[month] || 0;
        const missedThisMonth = Math.max(0, requiredForMonth - actualHours);

        penaltyEligibleMissedHours = missedThisMonth;
      }

      return {
        firstName: student.firstName,
        lastName: student.lastName,
        monthlyHours: monthlyHours,
        monthlyRequirements: monthlyRequirements
      };
    });

    res.json({ students: studentHoursData });

  } catch (error) {
    console.error('Error fetching student hours:', error);
    res.status(500).json({ error: 'Failed to fetch student hours data' });
  }
});

// Fallback function to use database check-ins if Google Sheets unavailable
async function getStudentHoursFromDatabase(students, res) {
  try {
    // Get all check-ins from database
    // Get all check-ins from database
    const checkIns = await CheckIn.find({}).populate('userId', 'firstName lastName');

    // Fetch settings and adjustments
    const settings = await Settings.getSettings();
    const adjustments = await HourAdjustment.find({});

    // Process the data to calculate monthly hours with new requirements
    const studentHoursData = students.map(student => {
      const memberType = student.memberType || 'New';

      const studentCheckIns = checkIns.filter(checkIn =>
        checkIn.userId && checkIn.userId._id.toString() === student._id.toString()
      );

      // Filter adjustments for this student
      const studentAdjustments = adjustments.filter(adj =>
        (adj.userId && adj.userId.toString() === student._id.toString()) ||
        adj.userId === null // Apply "All" adjustments
      );

      // Calculate hours per month
      const monthlyHours = {};
      const monthlyRequirements = {};

      // Initialize monthly hours for academic year
      const academicMonths = ['09', '10', '11', '12', '01', '02', '03', '04', '05', '06'];
      academicMonths.forEach(m => monthlyHours[m] = 0);

      studentCheckIns.forEach(checkIn => {
        const date = new Date(checkIn.sessionDate);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        // Only count current academic year (September to June)
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;

        // Determine academic year
        let academicYear;
        if (currentMonth >= 9) { // September or later
          academicYear = currentYear;
        } else { // January to August
          academicYear = currentYear - 1;
        }

        // Check if this check-in is in the current academic year
        const isCurrentAcademicYear =
          (year === academicYear && parseInt(month) >= 9) ||
          (year === academicYear + 1 && parseInt(month) <= 6);

        if (isCurrentAcademicYear) {
          if (monthlyHours[month] === undefined) {
            monthlyHours[month] = 0;
          }
          // Each check-in represents 1 hour
          monthlyHours[month] += 1;
        }
      });

      // Apply adjustments
      const currentYearDb = new Date().getFullYear();
      const currentMonthDb = new Date().getMonth() + 1;
      let academicYearDb;
      if (currentMonthDb >= 9) {
        academicYearDb = currentYearDb;
      } else {
        academicYearDb = currentYearDb - 1;
      }

      studentAdjustments.forEach(adj => {
        if (monthlyHours[adj.monthApplied] !== undefined && (!adj.academicYear || adj.academicYear === academicYearDb)) {
          monthlyHours[adj.monthApplied] += adj.amount;
        }
      });

      // Calculate requirements for each month with penalty system
      let penaltyEligibleMissedHours = 0;

      for (const month of academicMonths) {

        const monthReqs = settings.memberRequirements[month] || {
          New: { baseHours: 2.5, penaltyRate: 0.5 },
          Old: { baseHours: 1.0, penaltyRate: 0.5 },
          Officer: { baseHours: 0, penaltyRate: 0 }
        };
        const studentReqs = monthReqs[memberType] || monthReqs['New'];

        let requiredForMonth = studentReqs.baseHours;

        const monthOrder = ['09', '10', '11', '12', '01', '02', '03', '04', '05', '06'];
        const penaltyStartIndex = monthOrder.indexOf(settings.penaltyMonth);
        const currentMonthIndex = monthOrder.indexOf(month);

        // Add penalty if applicable
        if (penaltyEligibleMissedHours > 0 && penaltyStartIndex !== -1 && currentMonthIndex >= penaltyStartIndex) {
          let penalty = penaltyEligibleMissedHours * studentReqs.penaltyRate;
          // Round down to nearest 0.5
          penalty = Math.floor(penalty * 2) / 2;
          requiredForMonth += penalty;
        }

        monthlyRequirements[month] = requiredForMonth;

        // Calculate missed hours for this month to carry forward
        const actualHours = monthlyHours[month] || 0;
        const missedThisMonth = Math.max(0, requiredForMonth - actualHours);

        cumulativeMissedHours += missedThisMonth;

        // Non-accumulating penalty: Only track the MOST RECENT month's missed hours
        // for penalty application in the NEXT month.
        penaltyEligibleMissedHours = missedThisMonth;
      }

      return {
        firstName: student.firstName,
        lastName: student.lastName,
        monthlyHours: monthlyHours,
        monthlyRequirements: monthlyRequirements
      };
    });

    res.json({ students: studentHoursData });
  } catch (error) {
    console.error('Error fetching student hours from database:', error);
    res.status(500).json({ error: 'Failed to fetch student hours data from database' });
  }
}

function calculateStudentStats(student, adjustments, schedule, settings, currentMonth, currentYear) {
  const userName = `${student.firstName} ${student.lastName || ''}`.trim();
  const memberType = student.memberType || 'New';

  // Filter adjustments for this student
  const studentAdjustments = adjustments.filter(adj =>
    (adj.userId && adj.userId.toString() === student._id.toString()) ||
    adj.userId === null // Apply "All" adjustments
  );

  let hoursTutoredThisMonth = 0;
  let hoursSignedUpThisMonth = 0;
  let hoursTutoredThisYear = 0;

  // Calculate adjustments totals
  const currentMonthStr = String(currentMonth).padStart(2, '0');
  const academicYearCalc = currentMonth >= 9 ? currentYear : currentYear - 1;
  const currentMonthAdjustments = studentAdjustments
    .filter(adj => adj.monthApplied === currentMonthStr && (!adj.academicYear || adj.academicYear === academicYearCalc))
    .reduce((sum, adj) => sum + adj.amount, 0);

  const yearAdjustments = studentAdjustments
    .filter(adj => !adj.academicYear || adj.academicYear === academicYearCalc)
    .reduce((sum, adj) => sum + adj.amount, 0);

  // Apply adjustments to stats
  hoursTutoredThisMonth += currentMonthAdjustments;
  hoursTutoredThisYear += yearAdjustments;

  schedule.forEach(session => {
    const sessionDate = new Date(session.date);
    const sessionMonth = sessionDate.getMonth() + 1;
    const sessionYear = sessionDate.getFullYear();

    // Find if user is in this session
    const userTutor = (session.tutors || []).find(tutor => tutor.name === userName);

    if (userTutor) {
      const sessionHours = parseFloat(session.numHours) || 1; // Default to 1 hour if not specified

      // Hours signed up for this month
      if (sessionMonth === currentMonth && sessionYear === currentYear) {
        hoursSignedUpThisMonth += sessionHours;

        // Hours tutored this month (only if checked in)
        if (userTutor.checkedIn) {
          hoursTutoredThisMonth += sessionHours;
        }
      }

      // Hours tutored this school year (September-June, only if checked in)
      // Determine current academic year
      let academicYear;
      if (currentMonth >= 9) { // September or later
        academicYear = currentYear;
      } else { // January to August
        academicYear = currentYear - 1;
      }

      // Check if this session is in the current academic year (Sep-Jun)
      const isCurrentAcademicYear =
        (sessionYear === academicYear && sessionMonth >= 9) ||
        (sessionYear === academicYear + 1 && sessionMonth <= 6);

      if (isCurrentAcademicYear && userTutor.checkedIn) {
        hoursTutoredThisYear += sessionHours;
      }
    }
  });

  // Calculate hours to make up with new requirements and penalty system
  let hoursToMakeUp = 0;

  // Only calculate if we're in or past September 2025 (or just generally active)
  // The logic here should match student-stats
  // Initialize whole year projection
  let hoursToMakeUpWholeYear = 0;
  let monthlyBreakdown = []; // Track month-by-month stats for dashboard

  if (currentYear > 2025 || (currentYear === 2025 && currentMonth >= 9)) {
    // Determine current academic year first
    let academicYear;
    if (currentMonth >= 9) { // September or later - fall semester
      academicYear = currentYear;
    } else { // January to August - spring semester
      academicYear = currentYear - 1;
    }

    // Get all monthly hours for academic year (Sep to June)
    const academicMonths = ['09', '10', '11', '12', '01', '02', '03', '04', '05', '06'];

    let debts = []; // Array of { srcMonth, type: 'base' | 'penalty', amount, rate }
    let bankedHours = 0; // Store surplus hours
    let totalHoursTutoredSoFar = 0; // Track cumulative hours through current month only
    const now = new Date(); // To check if a month has passed yet

    // Process each month to calculate required hours and penalties
    for (let i = 0; i < academicMonths.length; i++) {
      const month = academicMonths[i];
      let actualHours = 0;

      // Determine which year this month belongs to
      let monthYear;
      if (month === '09' || month === '10' || month === '11' || month === '12') {
        monthYear = academicYear; // Fall semester
      } else {
        monthYear = academicYear + 1; // Spring semester (next calendar year)
      }

      const monthDate = new Date(monthYear, parseInt(month) - 1, 1);
      const isPastMonth = monthDate <= now;

      // 1. Determine penalty for this month based on LAST MONTH'S unpaid base debt
      let currentMonthPenalty = 0;
      if (i > 0) {
        const lastMonth = academicMonths[i - 1];
        const unpaidLastMonthBase = debts.find(d => d.srcMonth === lastMonth && d.type === 'base');

        const monthOrder = ['09', '10', '11', '12', '01', '02', '03', '04', '05', '06'];
        const penaltyStartIndex = monthOrder.indexOf(settings.penaltyMonth);
        const currentMonthIndex = monthOrder.indexOf(month);

        if (unpaidLastMonthBase && unpaidLastMonthBase.amount > 0 && penaltyStartIndex !== -1 && currentMonthIndex >= penaltyStartIndex) {
          currentMonthPenalty = unpaidLastMonthBase.amount * unpaidLastMonthBase.rate;
          currentMonthPenalty = Math.floor(currentMonthPenalty * 2) / 2;

          if (currentMonthPenalty > 0) {
            debts.push({
              srcMonth: month,
              type: 'penalty',
              amount: currentMonthPenalty,
              rate: 0
            });
          }
        }
      }

      // 2. Get this month's base requirement
      const monthReqs = settings.memberRequirements[month] || {
        New: { baseHours: 2.5, penaltyRate: 0.5 },
        Old: { baseHours: 1.0, penaltyRate: 0.5 },
        Officer: { baseHours: 0, penaltyRate: 0 }
      };
      const studentReqs = monthReqs[memberType] || monthReqs['New'];

      debts.push({
        srcMonth: month,
        type: 'base',
        amount: studentReqs.baseHours,
        rate: studentReqs.penaltyRate
      });

      // 3. Apply this month's tutored hours (if it has actually passed)
      if (isPastMonth) {
        // Get actual hours tutored for this month
        schedule.forEach(session => {
          const sessionDate = new Date(session.date);
          const sessionMonth = String(sessionDate.getMonth() + 1).padStart(2, '0');
          const sessionYear = sessionDate.getFullYear();

          if (sessionMonth === month && sessionYear === monthYear) {
            const userTutor = (session.tutors || []).find(tutor => tutor.name === userName);
            if (userTutor && userTutor.checkedIn) {
              actualHours += parseFloat(session.numHours) || 1;
            }
          }
        });

        // Apply adjustments
        const monthAdjustments = studentAdjustments
          .filter(adj => adj.monthApplied === month && (!adj.academicYear || adj.academicYear === academicYear))
          .reduce((sum, adj) => sum + adj.amount, 0);
        actualHours += monthAdjustments;

        // Accumulate hours tutored so far (through current month only)
        totalHoursTutoredSoFar += actualHours;

        // Pay off debts chronologically
        let availableHoursToPay = actualHours + bankedHours;
        let displayTutoredHours = availableHoursToPay; // Show banked + actual for this month

        for (let j = 0; j < debts.length; j++) {
          if (availableHoursToPay <= 0) break;

          if (debts[j].amount > 0) {
            if (availableHoursToPay >= debts[j].amount) {
              availableHoursToPay -= debts[j].amount;
              debts[j].amount = 0; // Fully paid
            } else {
              debts[j].amount -= availableHoursToPay;
              availableHoursToPay = 0; // Exhausted
            }
          }
        }

        // Save remaining hours back to bank for future months
        bankedHours = availableHoursToPay;

        // At the end of every PAST month, record the current total debt as `hoursToMakeUpSoFar`
        hoursToMakeUp = debts.reduce((sum, d) => sum + d.amount, 0);

        monthlyBreakdown.push({
          monthCode: month,
          baseHours: studentReqs.baseHours,
          penaltyRate: studentReqs.penaltyRate,
          tutoredHours: displayTutoredHours
        });
      } else {
        // Future month - actualHours is 0, but you might have bankedHours
        monthlyBreakdown.push({
          monthCode: month,
          baseHours: studentReqs.baseHours,
          penaltyRate: studentReqs.penaltyRate,
          tutoredHours: bankedHours
        });
      }
    }

    // After projecting out through the end of the year (June), grab the final debt as `hoursToMakeUpWholeYear`
    // (Notice that future months add requirements to `debts` but don't add any actualHours, simulating 0 tutored)
    hoursToMakeUpWholeYear = debts.reduce((sum, d) => sum + d.amount, 0);
  }

  return {
    firstName: student.firstName,
    lastName: student.lastName,
    memberType: memberType,
    hoursTutoredThisMonth: Math.round(hoursTutoredThisMonth * 10) / 10,
    hoursSignedUpThisMonth: Math.round(hoursSignedUpThisMonth * 10) / 10,
    hoursTutoredThisYear: Math.round(hoursTutoredThisYear * 10) / 10,
    hoursToMakeUp: Math.round(hoursToMakeUp * 10) / 10,
    hoursToMakeUpSoFar: Math.round(hoursToMakeUp * 10) / 10,
    monthlyBreakdown: monthlyBreakdown // For dashboard UI
  };
}

// Get monthly requirements and actual tutored hours for the student's member type
router.get('/monthly-requirements', isAuthenticated, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const memberType = req.user.memberType || 'New';
    const userId = req.user._id;

    // Fetch schedule and adjustments to calculate actual tutored hours using the helper
    let schedule = [];
    if (googleSheetsService.isConfigured()) {
      try {
        schedule = await googleSheetsService.getTutoringSchedule();
      } catch (sheetsError) {
        console.warn('Google Sheets not available, using fallback data:', sheetsError.message);
        schedule = getFallbackSchedule();
      }
    } else {
      schedule = getFallbackSchedule();
    }

    const adjustments = await HourAdjustment.find({ $or: [{ userId: userId }, { userId: null }] }).lean();

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const stats = calculateStudentStats(req.user, adjustments, schedule, settings, currentMonth, currentYear);

    const monthNames = {
      '09': 'September', '10': 'October', '11': 'November', '12': 'December',
      '01': 'January', '02': 'February', '03': 'March', '04': 'April',
      '05': 'May', '06': 'June'
    };

    let requirements = [];

    // Check if the helper populated monthlyBreakdown (which only happens if standard years conditions met)
    if (stats.monthlyBreakdown && stats.monthlyBreakdown.length > 0) {
      requirements = stats.monthlyBreakdown.map(breakdown => ({
        monthCode: breakdown.monthCode,
        monthName: monthNames[breakdown.monthCode],
        baseHours: breakdown.baseHours,
        penaltyRate: breakdown.penaltyRate,
        tutoredHours: breakdown.tutoredHours
      }));
    } else {
      // Fallback completely if somehow we're outside a tracked academic year
      const academicMonths = ['09', '10', '11', '12', '01', '02', '03', '04', '05', '06'];
      requirements = academicMonths.map(month => {
        const monthReqs = settings.memberRequirements[month] || {
          New: { baseHours: 2.5, penaltyRate: 0.5 },
          Old: { baseHours: 1.0, penaltyRate: 0.5 },
          Officer: { baseHours: 0, penaltyRate: 0 }
        };
        const studentReqs = monthReqs[memberType] || monthReqs['New'];
        return {
          monthCode: month,
          monthName: monthNames[month],
          baseHours: studentReqs.baseHours,
          penaltyRate: studentReqs.penaltyRate,
          tutoredHours: 0
        };
      });
    }

    res.json({
      success: true,
      memberType: memberType,
      penaltyMonth: settings.penaltyMonth,
      requirements: requirements
    });

  } catch (error) {
    console.error('Error fetching monthly requirements:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch monthly requirements' });
  }
});

// Get student stats for dashboard
router.get('/student-stats', isAuthenticated, async (req, res) => {
  try {
    if (!googleSheetsService.isConfigured()) {
      return res.json({
        hoursTutoredThisMonth: 0,
        hoursSignedUpThisMonth: 0,
        hoursTutoredThisYear: 0,
        hoursToMakeUp: 0
      });
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();

    // Get settings & adjustments
    const settings = await Settings.getSettings();
    const adjustments = await HourAdjustment.find({
      $or: [{ userId: req.user._id }, { userId: null }]
    });

    // Get all tutoring sessions from Google Sheets
    const schedule = await googleSheetsService.getTutoringSchedule();

    const stats = calculateStudentStats(req.user, adjustments, schedule, settings, currentMonth, currentYear);

    res.json({
      hoursTutoredThisMonth: stats.hoursTutoredThisMonth,
      hoursSignedUpThisMonth: stats.hoursSignedUpThisMonth,
      hoursTutoredThisYear: stats.hoursTutoredThisYear,
      hoursToMakeUp: stats.hoursToMakeUp,
      hoursToMakeUpSoFar: stats.hoursToMakeUpSoFar
    });

  } catch (error) {
    console.error('Error fetching student stats:', error);
    res.status(500).json({
      error: 'Failed to fetch student stats',
      hoursTutoredThisMonth: 0,
      hoursSignedUpThisMonth: 0,
      hoursTutoredThisYear: 0,
      hoursToMakeUp: 0
    });
  }
});

// Get all students' stats (teachers only)
router.get('/all-students-stats', isAuthenticated, isTeacher, async (req, res) => {
  try {
    if (!googleSheetsService.isConfigured()) {
      return res.json({ students: [] });
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();

    // Get settings
    const settings = await Settings.getSettings();
    const adjustments = await HourAdjustment.find({}); // Get all adjustments

    // Get all students
    const students = await User.find({ role: 'student' }).select('firstName lastName memberType');

    // Get all tutoring sessions from Google Sheets
    const schedule = await googleSheetsService.getTutoringSchedule();



    // Calculate statistics for each student
    const studentsStats = students.map(student => calculateStudentStats(student, adjustments, schedule, settings, currentMonth, currentYear));

    res.json({ students: studentsStats });



  } catch (error) {
    console.error('Error fetching all students stats:', error);
    res.status(500).json({
      error: 'Failed to fetch student statistics',
      students: []
    });
  }
});

// Get leaderboard stats (Top 5 / Bottom 5 by hoursToMakeUp)
router.get('/leaderboard', isAuthenticated, async (req, res) => {
  try {
    if (!googleSheetsService.isConfigured()) {
      return res.json({ top5: [], bottom5: [] });
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();

    // Get settings, adjustments, schedule, and all students
    const settings = await Settings.getSettings();
    const adjustments = await HourAdjustment.find({});
    const schedule = await googleSheetsService.getTutoringSchedule();
    const students = await User.find({ role: 'student' }).select('firstName lastName memberType');

    // Calculate statistics for each student using our helper
    // We only care about hoursToMakeUp for the leaderboard
    let studentsStats = students.map(student => {
      const stats = calculateStudentStats(student, adjustments, schedule, settings, currentMonth, currentYear);
      return {
        name: `${stats.firstName} ${stats.lastName}`.trim(),
        hoursToMakeUp: stats.hoursToMakeUp,
        hoursTutoredThisYear: stats.hoursTutoredThisYear
      };
    });

    // Exclude specific students from the leaderboard.
    // List is configurable via LEADERBOARD_EXCLUDED_STUDENTS (comma-separated names), with a default for backward compatibility.
    const excludedStudentsEnv = process.env.LEADERBOARD_EXCLUDED_STUDENTS;
    const excludedStudents = excludedStudentsEnv
      ? excludedStudentsEnv
        .split(',')
        .map(name => name.trim().toLowerCase())
        .filter(name => name.length > 0)
      : ["t g", "tanmay garg", "victor wodzien"];
    studentsStats = studentsStats.filter(stat => !excludedStudents.includes(stat.name.toLowerCase()));

    // Bottom 5 (Most hours to make up)
    const makeUpSorted = [...studentsStats].sort((a, b) => b.hoursToMakeUp - a.hoursToMakeUp);
    const bottom5 = makeUpSorted.slice(0, 5);

    // Top 5 (Most hours tutored overall)
    const tutoredSorted = [...studentsStats].sort((a, b) => b.hoursTutoredThisYear - a.hoursTutoredThisYear);
    const top5 = tutoredSorted.slice(0, 5);

    res.json({ top5, bottom5 });

  } catch (error) {
    console.error('Error fetching leaderboard stats:', error);
    res.status(500).json({
      error: 'Failed to fetch leaderboard statistics',
      top5: [], bottom5: []
    });
  }
});

// Moved to top of file

// --- MEETING ATTENDANCE ROUTES ---

// Create a new meeting (Teacher only)
router.post('/meetings', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const { title, code, value } = req.body;

    if (!title || !code) {
      return res.status(400).json({ error: 'Title and code are required.' });
    }

    // Check if code already exists and is active
    const existingMeeting = await Meeting.findOne({ code, isActive: true });
    if (existingMeeting) {
      return res.status(400).json({ error: 'A meeting with this code is already active.' });
    }

    const meeting = new Meeting({
      title,
      code,
      value: typeof value === 'number' ? value : parseFloat(value) || 1.0
    });

    await meeting.save();
    res.json({ success: true, meeting });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// Get recent meetings (Teacher only)
router.get('/meetings', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const meetings = await Meeting.find()
      .sort({ date: -1 })
      .limit(20)
      .populate('attendees', 'firstName lastName email');
    res.json(meetings);
  } catch (error) {
    console.error('Error fetching meetings:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// Toggle meeting status
router.patch('/meetings/:id/toggle', isAuthenticated, isTeacher, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    meeting.isActive = !meeting.isActive;
    await meeting.save();
    res.json({ success: true, meeting });
  } catch (error) {
    console.error('Error toggling meeting:', error);
    res.status(500).json({ error: 'Failed to update meeting' });
  }
});


// Student submits attendance code
router.post('/meetings/attend', isAuthenticated, async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    // Find active meeting with code
    const meeting = await Meeting.findOne({ code, isActive: true });

    if (!meeting) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive meeting code.' });
    }

    // Check if already attended
    const alreadyAttended = meeting.attendees.some(attendeeId =>
      attendeeId.toString() === userId.toString()
    );

    if (alreadyAttended) {
      return res.status(400).json({ success: false, message: 'You have already checked in for this meeting.' });
    }

    // Record attendance
    meeting.attendees.push(userId);
    await meeting.save();

    // Grant hours via HourAdjustment
    const adjustment = new HourAdjustment({
      userId: userId,
      amount: meeting.value,
      reason: `Attended Meeting: ${meeting.title}`,
      monthApplied: String(new Date().getMonth() + 1).padStart(2, '0'), // Current month
      academicYear: new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1 // Current academic year logic
    });

    await adjustment.save();

    res.json({ success: true, message: `Check-in successful! +${meeting.value} hour(s) recorded.` });

  } catch (error) {
    console.error('Error submitting attendance:', error);
    res.status(500).json({ success: false, message: 'Failed to process check-in.' });
  }
});

export default router;


