const nodemailer = require('nodemailer');

/**
 * Email Service using Nodemailer (Google Workspace/Gmail)
 * Handles email sending functionality using native Google services
 */
class EmailService {
    constructor() {
        this.initialized = false;
        this.transporter = null;
        this.fromEmail = null;
        this.fromName = null;
    }

    /**
     * Initialize the email service with Google configuration
     */
    initialize() {
        if (this.initialized) return;

        // Configuration for Google Workspace / Gmail
        const gmailUser = process.env.GMAIL_USER;
        const gmailAppPassword = process.env.GMAIL_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD;
        
        this.fromEmail = gmailUser || 'noreply@ecodigital.com';
        this.fromName = process.env.EMAIL_FROM_NAME || 'EcoDigital Clinic';

        if (!gmailUser || !gmailAppPassword) {
            console.warn('Google Workspace credentials not configured. Email sending will be simulated.');
            this.initialized = true;
            return;
        }

        try {
            // Create Nodemailer transporter for Google
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: gmailUser,
                    pass: gmailAppPassword
                }
            });

            this.initialized = true;
            console.log('Email service initialized with Google Workspace/Gmail');
        } catch (error) {
            console.error('Failed to initialize email service:', error);
            throw error;
        }
    }

    /**
     * Send email
     * @param {Object} emailData - Email data
     * @returns {Object} Send result
     */
    async sendEmail(emailData) {
        try {
            this.initialize();

            const { to, subject, content, html } = emailData;

            if (!to || !subject || !content) {
                throw new Error('Missing required email fields: to, subject, content');
            }

            if (!this.isValidEmail(to)) {
                throw new Error(`Invalid email address: ${to}`);
            }

            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: to,
                subject: subject,
                text: content,
                html: html || this.convertTextToHtml(content)
            };

            // If transporter is not configured, simulate sending
            if (!this.transporter) {
                console.log('=== SIMULATED GOOGLE EMAIL ===');
                console.log(`To: ${to}`);
                console.log(`From: ${this.fromName} <${this.fromEmail}>`);
                console.log(`Subject: ${subject}`);
                console.log('============================');

                return {
                    success: true,
                    messageId: `simulated_${Date.now()}`,
                    provider: 'simulated_google',
                    timestamp: new Date().toISOString()
                };
            }

            // Send actual email via Google/Nodemailer
            const info = await this.transporter.sendMail(mailOptions);

            return {
                success: true,
                messageId: info.messageId,
                provider: 'google_workspace',
                timestamp: new Date().toISOString(),
                response: info.response
            };

        } catch (error) {
            console.error('Error sending email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send bulk emails
     * @param {Array} emailList - Array of email data objects
     * @returns {Object} Bulk send result
     */
    async sendBulkEmails(emailList) {
        try {
            this.initialize();

            if (!Array.isArray(emailList) || emailList.length === 0) {
                throw new Error('Email list must be a non-empty array');
            }

            const results = [];
            const errors = [];

            // Simple batch processing
            for (const emailData of emailList) {
                try {
                    const result = await this.sendEmail(emailData);
                    results.push({ email: emailData.to, result });
                    // Small delay to be nice to Gmail API limits
                    await this.delay(500);
                } catch (error) {
                    errors.push({ email: emailData.to, error: error.message });
                }
            }

            return {
                success: true,
                total: emailList.length,
                sent: results.length,
                failed: errors.length,
                results,
                errors
            };

        } catch (error) {
            console.error('Error sending bulk emails:', error);
            return { success: false, error: error.message };
        }
    }

    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    convertTextToHtml(text) {
        if (!text) return '';
        return text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>').replace(/^/, '<p>').replace(/$/, '</p>');
    }

    createHtmlTemplate(templateData) {
        const { title, content, clinicName } = templateData;
        return `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px;">
                <h1 style="color: #2c5aa0;">${clinicName || 'EcoDigital Clinic'}</h1>
                <h2 style="font-size: 16px;">${title || 'Notificación'}</h2>
                <div style="background-color: white; padding: 20px; border-radius: 5px; margin-top: 15px;">
                    ${this.convertTextToHtml(content)}
                </div>
                <p style="font-size: 12px; color: #666; margin-top: 20px;">
                    Gestionado por Google Cloud Platform
                </p>
            </div>
        </body>
        </html>
        `;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            initialized: this.initialized,
            provider: this.transporter ? 'google_workspace' : 'simulated',
            user: this.fromEmail
        };
    }

    async testConfiguration(testEmail) {
        return this.sendEmail({
            to: testEmail,
            subject: 'Test Google Workspace',
            content: 'Verificando configuración de Google Workspace SMTP.'
        });
    }
}

module.exports = EmailService;