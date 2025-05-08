'use client';

import styles from './contact.module.css';

const Contact = () => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
  };

  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.title}>Contact Us</h1>
          <p className={styles.subtitle}>
            Get in touch with our team for any questions or support
          </p>
        </div>
      </section>

      <section className={styles.contactSection}>
        <div className={styles.contactGrid}>
          <div className={styles.contactInfo}>
            <h3>Get in Touch</h3>
            <p>We'd love to hear from you. Please fill out this form or email us at:</p>
            <a href="mailto:contact@algocrafters.com" className={styles.email}>
              contact@algocrafters.com
            </a>
            <div className={styles.address}>
              <h4>Headquarters</h4>
              <p>123 Tech Street<br />Silicon Valley<br />CA 94025</p>
            </div>
          </div>

          <form className={styles.contactForm} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="name">Name</label>
              <input type="text" id="name" required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input type="email" id="email" required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="subject">Subject</label>
              <input type="text" id="subject" required />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="message">Message</label>
              <textarea id="message" rows={5} required></textarea>
            </div>
            <button type="submit" className={styles.submitButton}>
              Send Message
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default Contact; 