import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class EmailService {
  constructor() {
    this.lastKnownBaseUrl = null;
    // Only create transporter if email credentials are provided
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    } else {
      console.log('📧 Email service not configured - EMAIL_USER and EMAIL_PASS required');
      this.transporter = null;
    }
  }

  setLastKnownBaseUrl(url) {
    if (url && typeof url === 'string') {
      this.lastKnownBaseUrl = url.trim().replace(/\/+$/, '');
    }
  }

  getBaseUrl(reqOrBaseUrl = null) {
    // 1. Explicit string passed in
    if (typeof reqOrBaseUrl === 'string' && reqOrBaseUrl.trim()) {
      let url = reqOrBaseUrl.trim().replace(/\/+$/, '');
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      return url;
    }

    // 2. Express request object (or options object containing req)
    const req = reqOrBaseUrl && (reqOrBaseUrl.headers ? reqOrBaseUrl : reqOrBaseUrl.req);
    if (req && req.headers) {
      const rawHost = req.headers['x-forwarded-host'] || (typeof req.get === 'function' ? req.get('host') : req.headers.host);
      if (rawHost) {
        const host = rawHost.split(',')[0].trim();
        let proto = req.headers['x-forwarded-proto'] || req.protocol;
        if (proto) {
          proto = proto.split(',')[0].trim();
        } else {
          proto = (host.includes('localhost') || host.includes('127.0.0.1')) ? 'http' : 'https';
        }
        return `${proto}://${host}`.replace(/\/+$/, '');
      }
    }

    // 3. If explicit non-localhost BASE_URL is set in environment, use it
    if (process.env.BASE_URL) {
      const base = process.env.BASE_URL.trim().replace(/\/+$/, '');
      const isLocal = base.includes('localhost') || base.includes('127.0.0.1');
      if (!isLocal) {
        return (base.startsWith('http://') || base.startsWith('https://')) ? base : `https://${base}`;
      }
    }

    // 4. Last known base URL captured from live HTTP requests (if non-localhost or if not on Vercel)
    if (this.lastKnownBaseUrl) {
      const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION || process.env.VERCEL_URL);
      const isLocal = this.lastKnownBaseUrl.includes('localhost') || this.lastKnownBaseUrl.includes('127.0.0.1');
      if (!isVercel || !isLocal) {
        return this.lastKnownBaseUrl;
      }
    }

    // 5. Vercel deployment environment variables (provided automatically by Vercel)
    const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ||
                       process.env.VERCEL_URL ||
                       process.env.VERCEL_BRANCH_URL;
    if (vercelHost && typeof vercelHost === 'string') {
      let host = vercelHost.trim().replace(/\/+$/, '');
      if (!host.startsWith('http://') && !host.startsWith('https://')) {
        host = `https://${host}`;
      }
      return host;
    }

    // 6. Render deployment environment variable
    if (process.env.RENDER_EXTERNAL_URL) {
      return process.env.RENDER_EXTERNAL_URL.trim().replace(/\/+$/, '');
    }

    // 7. If BASE_URL was set (even if localhost in local dev)
    if (process.env.BASE_URL) {
      const base = process.env.BASE_URL.trim().replace(/\/+$/, '');
      return (base.startsWith('http://') || base.startsWith('https://')) ? base : `http://${base}`;
    }

    // 8. Local development fallback
    const port = process.env.PORT || 3000;
    return `http://localhost:${port}`;
  }

  async sendVerificationEmail(user, token, reqOrBaseUrl = null) {
    if (!this.transporter) {
      console.log('📧 Email service not configured - skipping verification email');
      throw new Error('Email service not configured. Please set up EMAIL_USER and EMAIL_PASS in your .env file.');
    }

    const baseUrl = this.getBaseUrl(reqOrBaseUrl);
    const verificationUrl = `${baseUrl}/verify-email/${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Verify Your Email - Mu Alpha Theta',
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Mu Alpha Theta</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">Welcome to our mathematical community!</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1e293b; margin-top: 0;">Welcome, ${user.firstName}!</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 16px;">
              Thank you for joining Mu Alpha Theta! Please verify your email address to complete your registration as a <strong>${user.role}</strong>.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #1e40af, #3b82f6); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: 600;
                        display: inline-block;
                        font-size: 16px;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${verificationUrl}" style="color: #3b82f6; word-break: break-all;">${verificationUrl}</a>
            </p>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
              This verification link will expire in 24 hours. If you didn't create an account, please ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #64748b; font-size: 12px;">
            <p>© 2025 Mu Alpha Theta - NCP. All rights reserved.</p>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      // Email sent successfully
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(user, token, reqOrBaseUrl = null) {
    if (!this.transporter) {
      console.log('📧 Email service not configured - skipping password reset email');
      throw new Error('Email service not configured. Please set up EMAIL_USER and EMAIL_PASS in your .env file.');
    }
    const baseUrl = this.getBaseUrl(reqOrBaseUrl);
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Reset Your Password - Mu Alpha Theta',
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset</h1>
            <p style="color: #fee2e2; margin: 10px 0 0 0; font-size: 16px;">Secure your account</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1e293b; margin-top: 0;">Hello, ${user.firstName}!</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 16px;">
              We received a request to reset your password for your Mu Alpha Theta account. Click the button below to create a new password.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #dc2626, #ef4444); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: 600;
                        display: inline-block;
                        font-size: 16px;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #64748b; font-size: 14px; line-height: 1.5;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #ef4444; word-break: break-all;">${resetUrl}</a>
            </p>
            
            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
              This reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #64748b; font-size: 12px;">
            <p>© 2025 Mu Alpha Theta - NCP. All rights reserved.</p>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      // Password reset email sent successfully
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  async sendSessionCancelledEmail(user, sessionDetails, reqOrBaseUrl = null) {
    if (!this.transporter) {
      console.log('📧 Email service not configured - skipping session cancelled email');
      return;
    }

    const baseUrl = this.getBaseUrl(reqOrBaseUrl);
    const sessionDate = new Date(sessionDetails.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Session Cancelled - Mu Alpha Theta Tutoring',
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Session Cancelled</h1>
            <p style="color: #fee2e2; margin: 10px 0 0 0; font-size: 16px;">Important Update About Your Tutoring Session</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1e293b; margin-top: 0;">Hi ${user.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 16px;">
              We're sorry to inform you that the tutoring session you signed up for has been cancelled.
            </p>
            
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h3 style="color: #dc2626; margin-top: 0;">Cancelled Session Details:</h3>
              <p style="margin: 8px 0; color: #374151;"><strong>Date:</strong> ${sessionDate}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Time:</strong> ${sessionDetails.time}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Room:</strong> ${sessionDetails.room || 'TBD'}</p>
            </div>
            
            <p style="color: #475569; line-height: 1.6; font-size: 16px;">
              Please check the tutoring calendar for alternative sessions. You can sign up for other available sessions anytime.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/student-dashboard" 
                 style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 14px 28px; 
                        text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                View Tutoring Calendar
              </a>
            </div>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Session cancelled email sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending session cancelled email:', error);
    }
  }

  async sendSessionUpdatedEmail(user, oldSessionDetails, newSessionDetails, changes, reqOrBaseUrl = null) {
    if (!this.transporter) {
      console.log('📧 Email service not configured - skipping session updated email');
      return;
    }

    const baseUrl = this.getBaseUrl(reqOrBaseUrl);
    const sessionDate = new Date(oldSessionDetails.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    const changesList = Object.keys(changes).map(key => {
      const fieldNames = {
        time: 'Time',
        room: 'Room',
        maxTutors: 'Max Tutors'
      };
      return `<li><strong>${fieldNames[key] || key}:</strong> ${oldSessionDetails[key]} → ${changes[key]}</li>`;
    }).join('');

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Session Updated - Mu Alpha Theta Tutoring',
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f59e0b, #f97316); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Session Updated</h1>
            <p style="color: #fed7aa; margin: 10px 0 0 0; font-size: 16px;">Important Changes to Your Tutoring Session</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1e293b; margin-top: 0;">Hi ${user.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; font-size: 16px;">
              Your tutoring session has been updated. Please review the changes below:
            </p>
            
            <div style="background: #fffbeb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h3 style="color: #f59e0b; margin-top: 0;">Session Details:</h3>
              <p style="margin: 8px 0; color: #374151;"><strong>Date:</strong> ${sessionDate}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Current Time:</strong> ${newSessionDetails.time}</p>
              <p style="margin: 8px 0; color: #374151;"><strong>Current Room:</strong> ${newSessionDetails.room || 'TBD'}</p>
            </div>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin-top: 0;">Changes Made:</h3>
              <ul style="color: #374151; margin: 0; padding-left: 20px;">
                ${changesList}
              </ul>
            </div>
            
            <p style="color: #475569; line-height: 1.6; font-size: 16px;">
              Your signup is still confirmed for this session. If you can no longer attend due to these changes, 
              please cancel your signup and find an alternative session.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/student-dashboard" 
                 style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 14px 28px; 
                        text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                View My Sessions
              </a>
            </div>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`📧 Session updated email sent to ${user.email}`);
    } catch (error) {
      console.error('Error sending session updated email:', error);
    }
  }
}

export default new EmailService();
