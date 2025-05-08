import os
import logging
from email_service import EmailService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_email_service():
    """Test the email service by sending a test email"""
    try:
        # Initialize email service
        email_service = EmailService()
        
        # Test email details
        test_email = os.getenv("TEST_EMAIL", "your-test-email@example.com")
        test_subject = "Test Email from AlterHire"
        test_content = """
        <html>
            <body>
                <h1>Test Email</h1>
                <p>This is a test email from the AlterHire email service.</p>
                <p>If you receive this email, the email service is working correctly.</p>
            </body>
        </html>
        """
        
        # Try sending welcome email
        logger.info(f"Attempting to send test email to {test_email}")
        success = email_service.send_welcome_email(test_email, "Test User")
        
        if success:
            logger.info("Test email sent successfully!")
        else:
            logger.error("Failed to send test email")
            
    except Exception as e:
        logger.error(f"Error testing email service: {str(e)}")

if __name__ == "__main__":
    test_email_service() 