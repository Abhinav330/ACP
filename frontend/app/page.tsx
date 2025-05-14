'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const HomePage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.is_admin) {
      router.replace("/admin/questions");
    }
  }, [status, session, router]);

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <video
          autoPlay
          loop
          muted
          playsInline
          className={styles.heroVideo}
          src="/back.mp4"
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <h1>Transform Your Data Science Knowledge</h1>
          <p className={styles.subtitle}>
            Bridge the gap between theory and practice with real-world data science challenges
          </p>
          <div className={styles.ctaButtons}>
            <Link href="/signup" className={styles.primaryButton}>
              Start Learning Free
            </Link>
            <Link href="/learning-hub" className={styles.secondaryButton}>
              Explore
            </Link>
          </div>
        </div>
      </section>

      {/* Learning Paths Section */}
      <section className={styles.learningPaths}>
        <h2>Learning Paths</h2>
        <div className={styles.pathsGrid}>
          <div className={styles.pathCard}>
            <h3>Data Manipulation</h3>
            <ul>
              <li>Pandas Mastery</li>
              <li>Data Cleaning</li>
              <li>Data Analysis</li>
            </ul>
          </div>
          <div className={styles.pathCard}>
            <h3>Machine Learning</h3>
            <ul>
              <li>Scikit-learn Practice</li>
              <li>Model Building</li>
              <li>Model Evaluation</li>
            </ul>
          </div>
          <div className={styles.pathCard}>
            <h3>Advanced AI</h3>
            <ul>
              <li>Neural Networks</li>
              <li>Image Recognition</li>
              <li>Coming Soon</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <h2>Why Learn With Us?</h2>
        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <h3>Practical Learning</h3>
            <p>Write real code with Pandas and Scikit-learn</p>
          </div>
          <div className={styles.featureCard}>
            <h3>Real-World Focus</h3>
            <p>Solve actual data science challenges</p>
          </div>
          <div className={styles.featureCard}>
            <h3>Skill Development</h3>
            <p>Progress from basics to advanced concepts</p>
          </div>
          <div className={styles.featureCard}>
            <h3>Instant Validation</h3>
            <p>Test your solutions against real cases</p>
          </div>
        </div>
      </section>

      {/* Getting Started Section */}
      <section className={styles.gettingStarted}>
        <h2>Getting Started is Easy</h2>
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <h3>Sign Up</h3>
            <p>Create your free account</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <h3>Choose Path</h3>
            <p>Select your learning track</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <h3>Practice</h3>
            <p>Solve hands-on problems</p>
          </div>
        </div>
        <Link href="/signup" className={styles.primaryButton}>
          Start Your Journey
        </Link>
      </section>

      {/* Community Stats Section */}
      <section className={styles.stats}>
        <div className={styles.stat}>
          <h3>Active Learners</h3>
          <p>Growing Community</p>
        </div>
        <div className={styles.stat}>
          <h3>Practice Problems</h3>
          <p>Real-world Scenarios</p>
        </div>
        <div className={styles.stat}>
          <h3>Success Rate</h3>
          <p>Proven Results</p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;