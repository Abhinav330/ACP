import os
import emails
from emails.template import JinjaTemplate
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmailConfig:
    def __init__(self, prefix: str):
        self.smtp_host = os.getenv(f"{prefix}_SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv(f"{prefix}_SMTP_PORT", "465"))  # Default to SSL port
        self.smtp_user = os.getenv(f"{prefix}_SMTP_USER", "")
        # Remove spaces and any other whitespace from app password
        self.smtp_password = os.getenv(f"{prefix}_SMTP_PASSWORD", "").strip().replace(" ", "")
        self.from_email = os.getenv(f"{prefix}_FROM_EMAIL", "")
        self.from_name = os.getenv(f"{prefix}_FROM_NAME", "")
        
        # Log configuration (without password)
        logger.info(f"Email config '{prefix}' initialized: host={self.smtp_host}, port={self.smtp_port}, user={self.smtp_user}, from_email={self.from_email}")
        
        # Check if credentials are set
        if not self.smtp_user or not self.smtp_password:
            logger.warning(f"Email config '{prefix}' is missing credentials. Emails will not be sent.")
        else:
            # Log password format info for debugging
            logger.info(f"Password format check: length={len(self.smtp_password)}, contains_spaces={' ' in self.smtp_password}, contains_newlines={chr(10) in self.smtp_password}")

class EmailService:
    def __init__(self):
        # Initialize different email configurations
        self._init_configs()
        
        # Templates directory
        self.templates_dir = Path(__file__).parent / "email_templates"
        self.templates_dir.mkdir(exist_ok=True)
        
        # Create default templates if they don't exist
        self._create_default_templates()
        
        logger.info("Email service initialized")

    def _init_configs(self):
        """Initialize or reinitialize email configurations"""
        # Reload environment variables
        load_dotenv()
        
        # Initialize different email configurations
        self.welcome_config = EmailConfig("WELCOME")
        self.reset_config = EmailConfig("RESET")
        self.challenge_config = EmailConfig("CHALLENGE")

    async def _send_email(self, config: EmailConfig, to_email: str, subject: str, html_content: str) -> bool:
        """Send an email using the specified configuration"""
        try:
            # Check if credentials are set
            if not config.smtp_user or not config.smtp_password:
                logger.error(f"Cannot send email to {to_email}: Missing SMTP credentials")
                return False
                
            logger.info(f"Attempting to send email to {to_email} using {config.smtp_user}")
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{config.from_name} <{config.from_email}>"
            msg['To'] = to_email
            
            # Attach HTML content
            html_part = MIMEText(html_content, 'html')
            msg.attach(html_part)
            
            # Create a secure SSL context
            context = ssl.create_default_context()
            
            # Run the email sending in a thread pool to avoid blocking
            def send_email():
                try:
                    if config.smtp_port == 465:
                        # Use SSL
                        logger.info("Using SSL connection (port 465)")
                        with smtplib.SMTP_SSL(config.smtp_host, config.smtp_port, context=context) as server:
                            server.login(config.smtp_user, config.smtp_password)
                            server.send_message(msg)
                    else:
                        # Use TLS
                        logger.info("Using TLS connection (port 587)")
                        with smtplib.SMTP(config.smtp_host, config.smtp_port) as server:
                            server.ehlo()
                            server.starttls(context=context)
                            server.ehlo()
                            server.login(config.smtp_user, config.smtp_password)
                            server.send_message(msg)
                    
                    logger.info(f"Email sent successfully to {to_email}")
                    return True
                    
                except smtplib.SMTPAuthenticationError as e:
                    error_msg = str(e)
                    logger.error(f"SMTP Authentication failed for {to_email}: {error_msg}")
                    
                    # Provide specific guidance for Gmail app password issues
                    if "Application-specific password required" in error_msg:
                        logger.error("Gmail requires an app password. Please follow these steps:")
                        logger.error("1. Go to your Google Account settings")
                        logger.error("2. Navigate to Security > 2-Step Verification")
                        logger.error("3. At the bottom, select 'App passwords'")
                        logger.error("4. Generate a new app password for 'Mail' and your app")
                        logger.error("5. Use the 16-character password generated (no spaces)")
                    
                    return False
                except Exception as e:
                    logger.error(f"Error sending email to {to_email}: {str(e)}")
                    return False

            # Run the email sending in a thread pool
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, send_email)

        except Exception as e:
            logger.error(f"Error in email sending process: {str(e)}")
            return False

    async def send_welcome_email(self, to_email: str, name: str) -> bool:
        """Send welcome email using welcome configuration"""
        # Reload configurations before sending
        self._init_configs()
        
        template_path = self.templates_dir / "welcome.html"
        with open(template_path, "r") as f:
            template = JinjaTemplate(f.read())
        
        html_content = template.render(
            name=name,
            to_email=to_email,
            frontend_url=os.getenv("FRONTEND_URL", "http://localhost:3000")
        )
        
        return await self._send_email(
            config=self.welcome_config,
            to_email=to_email,
            subject="Welcome to AlterHire!",
            html_content=html_content
        )

    async def send_verification_email(self, to_email: str, name: str, verification_link: str) -> bool:
        subject = "Verify Your AlterHire Account"
        body = f"""
        <html>
            <body>
                <h2>Welcome to AlterHire, {name}!</h2>
                <p>Please verify your email address by clicking the link below:</p>
                <p><a href="{verification_link}">Verify Email Address</a></p>
                <p>This link will expire in 3 hours.</p>
                <p>If you do not verify your email within 3 hours, your account will be deleted and you will need to sign up again.</p>
                <p>This link can only be used once.</p>
                <p>If you did not create an account, please ignore this email.</p>
                <br>
                <p>Best regards,</p>
                <p>The AlterHire Team</p>
            </body>
        </html>
        """
        return await self._send_email(
            config=self.welcome_config,
            to_email=to_email,
            subject=subject,
            html_content=body
        )

    async def send_password_reset_email(self, to_email: str, name: str, reset_link: str) -> bool:
        """Send password reset email using security configuration"""
        # Reload configurations before sending
        self._init_configs()
        
        template_path = self.templates_dir / "password_reset.html"
        with open(template_path, "r") as f:
            template = JinjaTemplate(f.read())
        
        html_content = template.render(
            name=name,
            to_email=to_email,
            reset_link=reset_link
        )
        
        return await self._send_email(
            config=self.reset_config,
            to_email=to_email,
            subject="Reset Your AlterHire Password",
            html_content=html_content
        )

    async def send_challenge_completed_email(self, to_email: str, name: str, challenge_title: str, points: int, total_score: int) -> bool:
        """Send challenge completion email using challenge configuration"""
        # Reload configurations before sending
        self._init_configs()
        
        template_path = self.templates_dir / "challenge_completed.html"
        with open(template_path, "r") as f:
            template = JinjaTemplate(f.read())
        
        html_content = template.render(
            name=name,
            to_email=to_email,
            challenge_title=challenge_title,
            points=points,
            total_score=total_score,
            frontend_url=os.getenv("FRONTEND_URL", "http://localhost:3000")
        )
        
        return await self._send_email(
            config=self.challenge_config,
            to_email=to_email,
            subject="Challenge Completed! 🎉",
            html_content=html_content
        )

    async def send_otp_email(self, to_email: str, name: str, otp: str) -> bool:
        """Send OTP email using welcome configuration"""
        # Reload configurations before sending
        self._init_configs()
        
        template_path = self.templates_dir / "otp.html"
        with open(template_path, "r") as f:
            template = JinjaTemplate(f.read())
        
        html_content = template.render(
            name=name,
            otp=otp
        )
        
        return await self._send_email(
            config=self.welcome_config,
            to_email=to_email,
            subject="Your AlterHire Verification Code",
            html_content=html_content
        )

    def _create_default_templates(self):
        """Create default email templates if they don't exist"""
        templates = {
            "welcome.html": """
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .button { display: inline-block; background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to AlterHire!</h1>
                    </div>
                    <div class="content">
                        <p>Hello {{ name }},</p>
                        <p>Welcome to AlterHire! We're excited to have you on board.</p>
                        <p>Get ready to showcase your skills and take on exciting coding challenges!</p>
                        <p style="text-align: center;">
                            <a href="{{ frontend_url }}/problems" class="button">Start Coding</a>
                        </p>
                    </div>
                    <div class="footer">
                        <p>This email was sent from AlterHire Welcome Team</p>
                    </div>
                </div>
            </body>
            </html>
            """,
            "otp.html": """
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; text-align: center; }
                    .otp-box { 
                        background-color: #f8f9fa;
                        border: 2px dashed #4F46E5;
                        border-radius: 10px;
                        padding: 20px;
                        margin: 20px 0;
                    }
                    .otp-code {
                        font-size: 36px;
                        letter-spacing: 8px;
                        color: #4F46E5;
                        font-weight: bold;
                        font-family: monospace;
                    }
                    .timer {
                        color: #dc2626;
                        font-weight: bold;
                        margin: 10px 0;
                    }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                    .warning { color: #dc2626; font-size: 14px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Verify Your Email</h1>
                    </div>
                    <div class="content">
                        <p>Hello {{ name }},</p>
                        <p>Welcome to AlterHire! Please use the following verification code to complete your registration:</p>
                        <div class="otp-box">
                            <div class="otp-code">{{ otp }}</div>
                            <div class="timer">Valid for 10 minutes only</div>
                        </div>
                        <p>If you didn't request this code, please ignore this email.</p>
                        <p class="warning">For security reasons, DO NOT share this code with anyone.</p>
                    </div>
                    <div class="footer">
                        <p>This email was sent from AlterHire Security Team</p>
                        <p>This is an automated message, please do not reply.</p>
                    </div>
                </div>
            </body>
            </html>
            """,
            "password_reset.html": """
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .button { display: inline-block; background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Reset Your Password</h1>
                    </div>
                    <div class="content">
                        <p>Hello {{ name }},</p>
                        <p>We received a request to reset your password. Click the button below to create a new password:</p>
                        <p style="text-align: center;">
                            <a href="{{ reset_link }}" class="button">Reset Password</a>
                        </p>
                        <p>If you didn't request this, you can safely ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>This email was sent from Algo Crafters Security Team</p>
                    </div>
                </div>
            </body>
            </html>
            """,
            "challenge_completed.html": """
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; }
                    .button { display: inline-block; background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Challenge Completed!</h1>
                    </div>
                    <div class="content">
                        <p>Hello {{ name }},</p>
                        <p>Congratulations! You've successfully completed the challenge "{{ challenge_title }}".</p>
                        <p>Points earned: {{ points }}</p>
                        <p>Your total score: {{ total_score }}</p>
                        <p style="text-align: center;">
                            <a href="{{ frontend_url }}/problems" class="button">Try More Challenges</a>
                        </p>
                    </div>
                    <div class="footer">
                        <p>This email was sent from Algo Crafters Challenges Team</p>
                    </div>
                </div>
            </body>
            </html>
            """
        }

        for filename, content in templates.items():
            template_path = self.templates_dir / filename
            if not template_path.exists():
                with open(template_path, "w") as f:
                    f.write(content)

# Create a singleton instance
email_service = EmailService()