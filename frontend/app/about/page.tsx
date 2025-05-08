'use client';

import React from 'react';
import styles from './about.module.css';

const About = () => {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.aboutContent}>
          <h1 className={styles.title}>About Algo Crafters</h1>
          
          <section className={styles.section}>
            <h2>Our Mission</h2>
            <p>
              The mission of Algo Crafters is to bridge the gap between theoretical knowledge and 
              real-world data science expertise. Our platform helps individuals transform their 
              knowledge into practical skills by providing hands-on algorithm challenges and 
              real-world data science problems.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Our Vision</h2>
            <p>
              Our vision is to become the leading platform for the development of data science 
              skills, empowering individuals worldwide to craft solutions through practice, 
              collaboration, and continuous improvement.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Our Core Values</h2>
            <ul className={styles.list}>
              <li>
                <strong>Practical Learning:</strong> We provide a hands-on approach to mastering 
                data science and machine learning, focusing on real-world application rather than 
                just theory.
              </li>
              <li>
                <strong>Skill Mastery:</strong> Through consistent practice and challenging 
                exercises, we help users refine and master algorithms and coding skills essential 
                for data science.
              </li>
              <li>
                <strong>Community Growth:</strong> We foster a supportive environment where 
                learners and professionals challenge each other to improve and grow together.
              </li>
            </ul>
          </section>
          
          <section className={styles.section}>
            <h2>What Sets Us Apart</h2>
            <p>
              Unlike traditional learning platforms, Algo Crafters emphasizes practical, 
              real-world problem-solving with a focus on algorithms used in data science. 
              We don't just teach theory; we focus on creating real-world solutions with 
              real data science challenges, making our users industry-ready. For modules 
              like Pandas and Scikit-learn, no coding practice platform is currently available. 
              Most platforms use an MCQ-based approach, but Algo Crafters offers a unique solution. 
              Users will receive a coding question and must write code based on Pandas or 
              Scikit-learn, demonstrating that they know the libraries, which function to apply, 
              and when.
            </p>
          </section>
          
          <section className={styles.section}>
            <h2>Who We Serve</h2>
            <ul className={styles.list}>
              <li>Students looking to build strong data science and machine learning skills for their future careers</li>
              <li>Professionals wanting to enhance their coding and algorithmic problem-solving abilities</li>
              <li>Career Switchers who want to break into data science or related fields</li>
            </ul>
          </section>
          
          <section className={styles.section}>
            <h2>Learning Paths</h2>
            <p>
              Master the essential tools and skills of modern data science:
            </p>
            <ul className={styles.list}>
              <li>
                <strong>Algorithm Challenges:</strong> Focused practice with Pandas, 
                Scikit-learn, and AI-based algorithms
              </li>
              <li>
                <strong>Real-World Problems:</strong> Challenges based on actual use cases 
                including data cleaning, feature engineering, and model deployment
              </li>
              <li>
                <strong>Interactive Environment:</strong> Write, test, and submit solutions 
                in our secure coding environment
              </li>
              <li>
                <strong>Progress Tracking:</strong> Monitor your learning journey and skill 
                improvement over time
              </li>
              <li>
                <strong>Challenge Validation:</strong> Test your solutions against both public 
                and private test cases
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Learning Structure</h2>
            <p>
              Our platform offers a comprehensive learning path from beginner to advanced levels:
            </p>
            <ul className={styles.list}>
              <li>
                <strong>Pandas Mastery:</strong> Data manipulation, cleaning, aggregation, 
                and merging techniques
              </li>
              <li>
                <strong>Scikit-learn Expertise:</strong> Regression, classification, 
                clustering, and model evaluation
              </li>
              <li>
                <strong>Advanced AI & ML (Work in Progress):</strong> Neural networks, image recognition, 
                and more (Coming soon)
              </li>
            </ul>
          </section>

      

          <section className={styles.section}>
            <h2>Get Started Today</h2>
            <p>
              Join Algo Crafters and start your journey toward practical data science mastery. 
              Create your free account today to access our growing collection of real-world 
              challenges, interactive coding environment, and supportive community. Transform 
              your theoretical knowledge into practical expertise through hands-on practice 
              and real-world problem-solving.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
};

export default About; 