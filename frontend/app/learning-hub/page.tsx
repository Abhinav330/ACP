'use client';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning ☀️';
  if (hour >= 12 && hour < 17) return 'Good Afternoon 🌤️';
  if (hour >= 17 && hour < 22) return 'Good Evening 🌙';
  return 'Hey Night Owl 🦉';
}

// List of available videos
const catVideos = [
  '/cats/cat1.mp4',
  '/cats/cat2.mp4',
  '/cats/cat3.mp4',
  '/cats/cat4.mp4',
  '/cats/cat5.mp4',
  '/cats/cat6.mp4',
  '/cats/cat7.mp4',
  '/cats/cat8.mp4',
];

const dogVideos = [
  '/dogs/dog1.mp4',
  '/dogs/dog2.mp4',
  '/dogs/dog3.mp4',
  '/dogs/dog4.mp4',
  '/dogs/dog5.mp4',
  '/dogs/dog6.mp4',
  '/dogs/dog7.mp4',
  '/dogs/dog8.mp4',
];

export default function LearningHub() {
  const { data: session } = useSession();
  const [videoSrc, setVideoSrc] = useState('');
  
  useEffect(() => {
    // Randomly choose between cats and dogs
    const isCat = Math.random() > 0.5;
    const videos = isCat ? catVideos : dogVideos;
    const randomIndex = Math.floor(Math.random() * videos.length);
    setVideoSrc(videos[randomIndex]);
  }, []);

  console.log('Session:', session);
  const firstName = (session?.user as any)?.firstName || '';
  const lastName = (session?.user as any)?.lastName || '';
  const email = session?.user?.email || '';
  const emailName = email ? email.split('@')[0] : '';
  const username = (firstName + ' ' + lastName).trim() || (session?.user?.name || '').trim() || emailName || 'Learner';
  const greeting = getGreeting();
  const quote = "Practice is the key to mastery. The more you practice, the better you get!";

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', background: '#f7fafd', padding: '2rem 0' }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 1100, marginBottom: '2.5rem', gap: '2.5rem' }}>
        {/* Video on the left */}
        <div style={{ flex: '0 0 480px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          {videoSrc && (
            <div style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
              <video
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                style={{ maxWidth: '480px', width: '100%', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)' }}
              />
              <div style={{ position: 'absolute', bottom: 4, right: 8, fontSize: '0.3rem', color: '#aaa', letterSpacing: '0.01em', textAlign: 'right', background: 'rgba(255,255,255,0.2)', padding: '1px 4px', borderRadius: '4px' }}>
                Video source: pexels.com
              </div>
            </div>
          )}
        </div>
        {/* Message on the right */}
        <div style={{ flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{greeting}</div>
          <div style={{ fontSize: '1.2rem', margin: '0.3rem 0', color: '#22577a', fontWeight: 500 }}>{username},</div>
          <div style={{ fontSize: '1.05rem', color: '#444', fontStyle: 'italic', marginBottom: '0.7rem' }}>Let's start practising. {quote}</div>
          <div style={{ fontSize: '1.05rem', color: '#22577a', fontWeight: 500 }}>
            Here is a video to motivate you for learning.
          </div>
        </div>
      </div>
      <h1 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: '2rem', color: '#1a365d' }}>Learning Hub</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center', width: '100%', maxWidth: 900 }}>
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '2rem 1.5rem', fontSize: '1.2rem', fontWeight: 600, color: '#22577a', textAlign: 'center', minHeight: '110px', flex: '1 1 320px', minWidth: 280, maxWidth: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#22577a' }}>Guided Learning</h2>
        </div>
        <Link href="/problems" style={{ textDecoration: 'none', flex: '1 1 320px', minWidth: 280, maxWidth: 350 }}>
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
            padding: '2rem 1.5rem',
            fontSize: '1.2rem',
            fontWeight: 600,
            color: '#22577a',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s',
            textAlign: 'center',
            minHeight: '110px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            Practice Modules
          </div>
        </Link>
        <div style={{
          background: '#f1f5f9',
          borderRadius: 16,
          padding: '2rem 1.5rem',
          fontSize: '1.2rem',
          fontWeight: 600,
          color: '#a0aec0',
          textAlign: 'center',
          border: '1px dashed #cbd5e1',
          minHeight: '110px',
          flex: '1 1 320px', minWidth: 280, maxWidth: 350,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          End-to-end project-style learning <span style={{ fontSize: '0.95rem', color: '#e53e3e', marginLeft: 8 }}>[coming soon]</span>
        </div>
        <div style={{
          background: '#f1f5f9',
          borderRadius: 16,
          padding: '2rem 1.5rem',
          fontSize: '1.2rem',
          fontWeight: 600,
          color: '#a0aec0',
          textAlign: 'center',
          border: '1px dashed #cbd5e1',
          minHeight: '110px',
          flex: '1 1 320px', minWidth: 280, maxWidth: 350,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          Courses and certifications <span style={{ fontSize: '0.95rem', color: '#e53e3e', marginLeft: 8 }}>[coming soon]</span>
        </div>
        <div style={{
          background: '#f1f5f9',
          borderRadius: 16,
          padding: '2rem 1.5rem',
          fontSize: '1.2rem',
          fontWeight: 600,
          color: '#a0aec0',
          textAlign: 'center',
          border: '1px dashed #cbd5e1',
          minHeight: '110px',
          flex: '1 1 320px', minWidth: 280, maxWidth: 350,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          Personalised AI reports <span style={{ fontSize: '0.95rem', color: '#e53e3e', marginLeft: 8 }}>[coming soon]</span>
        </div>
      </div>
    </div>
  );
}
