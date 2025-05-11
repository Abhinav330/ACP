'use client';

import React from 'react';
import Link from 'next/link';
import styles from './Footer.module.css';

interface FooterProps {
  sticky?: boolean;
}

const Footer: React.FC<FooterProps> = ({ sticky = false }) => {
  return (
    <footer className={`${styles.footer} ${sticky ? styles.stickyFooter : ''}`}>
      <div className={styles.footerContent}>
        <div className={styles.footerSection}>
          <h3 className={styles.footerTitle}>Algo Crafters</h3>
          <p className={styles.footerDescription}>
            Empowering individuals to master data science through hands-on practice and real-world challenges.
          </p>
        </div>

        <div className={styles.footerSection}>
          <h4 className={styles.footerSubtitle}>Company</h4>
          <nav className={styles.footerNav}>
            <Link href="/about" className={styles.footerLink}>About Us</Link>
            <Link href="/solutions" className={styles.footerLink}>Solutions</Link>
            <Link href="/pricing" className={styles.footerLink}>Pricing</Link>
            <Link href="/contact" className={styles.footerLink}>Contact</Link>
          </nav>
        </div>

        <div className={styles.footerSection}>
          <h4 className={styles.footerSubtitle}>Resources</h4>
          <nav className={styles.footerNav}>
            <Link href="/blog" className={styles.footerLink}>Blog</Link>
            <Link href="/documentation" className={styles.footerLink}>Documentation</Link>
            <Link href="/faq" className={styles.footerLink}>FAQ</Link>
            <Link href="/support" className={styles.footerLink}>Support</Link>
          </nav>
        </div>

        <div className={styles.footerSection}>
          <h4 className={styles.footerSubtitle}>Legal</h4>
          <nav className={styles.footerNav}>
            <Link href="/privacy" className={styles.footerLink}>Privacy Policy</Link>
            <Link href="/terms" className={styles.footerLink}>Terms of Service</Link>
            <Link href="/security" className={styles.footerLink}>Security</Link>
          </nav>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <div className={styles.footerBottomContent}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} Algo Crafters. All rights reserved.
          </p>
          <div className={styles.socialLinks}>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
              LinkedIn
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
              Twitter
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 