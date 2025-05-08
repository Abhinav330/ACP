'use client';

import React, { useEffect, useRef } from 'react';
import { IconType } from 'react-icons';
import { FaCode, FaTrophy, FaChartLine } from 'react-icons/fa';
import styles from './UserStats.module.css';

interface UserStatsProps {
  totalQuestionsSolved: number;
  totalScore: number;
  topPercentage: number;
}

interface StatItem {
  icon: IconType;
  label: string;
  value: number;
  suffix?: string;
}

export default function UserStats({
  totalQuestionsSolved,
  totalScore,
  topPercentage,
}: UserStatsProps) {
  const stats: StatItem[] = [
    {
      icon: FaCode,
      label: 'Questions Solved',
      value: totalQuestionsSolved,
    },
    {
      icon: FaTrophy,
      label: 'Total Score',
      value: totalScore,
    },
    {
      icon: FaChartLine,
      label: 'Top Percentage',
      value: topPercentage,
      suffix: '%',
    },
  ];

  const countersRef = useRef<{ [key: string]: HTMLSpanElement }>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const counter = entry.target as HTMLSpanElement;
            const target = parseInt(counter.getAttribute('data-target') || '0', 10);
            const duration = 2000; // 2 seconds
            const step = target / (duration / 16); // 60fps
            let current = 0;

            const updateCounter = () => {
              current += step;
              if (current < target) {
                counter.textContent = Math.floor(current).toString();
                requestAnimationFrame(updateCounter);
              } else {
                counter.textContent = target.toString();
              }
            };

            updateCounter();
            observer.unobserve(counter);
          }
        });
      },
      { threshold: 0.5 }
    );

    Object.values(countersRef.current).forEach((counter) => {
      observer.observe(counter);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.container}>
      {stats.map((stat) => (
        <div key={stat.label} className={styles.statCard}>
          <div className={styles.iconContainer}>
            <stat.icon className={styles.icon} />
          </div>
          <div className={styles.content}>
            <span
              ref={(el) => {
                if (el) countersRef.current[stat.label] = el;
              }}
              className={styles.value}
              data-target={stat.value}
            >
              0
            </span>
            {stat.suffix && <span className={styles.suffix}>{stat.suffix}</span>}
            <span className={styles.label}>{stat.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
} 