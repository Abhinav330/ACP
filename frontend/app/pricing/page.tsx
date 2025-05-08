'use client';

import styles from './pricing.module.css';

const Pricing = () => {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.title}>Pricing</h1>
          <p className={styles.subtitle}>
            Coming Soon
          </p>
          <p className={styles.description}>
            We are working on creating the perfect pricing plans for our users. 
            Check back soon for updates!
          </p>
        </div>
      </section>
    </main>
  );
};

export default Pricing; 