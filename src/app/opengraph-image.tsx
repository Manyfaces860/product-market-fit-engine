import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#020617',
          color: '#f1f5f9',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', fontSize: 32, color: '#f59e0b', letterSpacing: 4 }}>
          NEEDBOARD
        </div>
        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, marginTop: 24, maxWidth: 900 }}>
          Where real problems meet real builders.
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#94a3b8', marginTop: 24, maxWidth: 850 }}>
          Report a frustration. See it cluster with others who feel it. Build the fix.
        </div>
      </div>
    ),
    { ...size }
  );
}
