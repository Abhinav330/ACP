'use client';

import styles from './ImageBackground.module.css';

const SolidBackground = () => {
  console.log('SolidBackground component rendering with styles:', styles);
  return <div className={styles.imageBackground} />;
};

export default SolidBackground; 