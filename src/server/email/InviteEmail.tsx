import * as React from 'react';

interface InviteEmailProps {
  hiveName: string;
  role: string;
  inviteUrl: string;
}

export function InviteEmail({ hiveName, role, inviteUrl }: InviteEmailProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Join {hiveName} on Strizzle</title>
      </head>
      <body
        style={{
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          backgroundColor: '#f9fafb',
          color: '#111827',
          margin: 0,
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '580px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '32px',
            border: '1px solid #e5e7eb',
            boxShadow:
              '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
          }}
        >
          {/* Logo / Header */}
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <span
              style={{
                fontSize: '24px',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: '#3b82f6',
              }}
            >
              Strizzle
            </span>
          </div>

          {/* Heading */}
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 700,
              lineHeight: 1.3,
              margin: '0 0 16px 0',
              textAlign: 'center',
            }}
          >
            You have been invited to join{' '}
            <span style={{ color: '#3b82f6' }}>{hiveName}</span>
          </h1>

          {/* Body Text */}
          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: '#4b5563',
              margin: '0 0 24px 0',
              textAlign: 'center',
            }}
          >
            You have been invited to join the course workspace{' '}
            <strong>{hiveName}</strong> as a <strong>{role}</strong>. Click the
            button below to accept the invitation and start collaborating.
          </p>

          {/* Button */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '15px',
                padding: '12px 32px',
                borderRadius: '8px',
                textDecoration: 'none',
              }}
            >
              Accept Invitation
            </a>
          </div>

          <hr
            style={{
              border: 'none',
              borderTop: '1px solid #f3f4f6',
              margin: '24px 0',
            }}
          />

          {/* Footer info */}
          <p
            style={{
              fontSize: '12px',
              lineHeight: 1.5,
              color: '#9ca3af',
              margin: 0,
              textAlign: 'center',
            }}
          >
            If the button doesn't work, copy and paste this link into your
            browser:
            <br />
            <a
              href={inviteUrl}
              style={{
                color: '#3b82f6',
                textDecoration: 'underline',
                wordBreak: 'break-all',
              }}
            >
              {inviteUrl}
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
