import React, { useState } from 'react';
import { useAppAuth } from '@gas-framework/core/client';

export function LoginPage() {
  const { login, verifyOTP } = useAppAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const result = await login(email);
      if (result.success && result.requiresOTP) {
        setStep('otp');
        setMessage(result.message);
      } else {
        setMessage(result.message);
      }
    } catch (err) {
      setMessage('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  async function handleOTPSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const result = await verifyOTP(email, otp);
      if (!result.success) {
        setMessage(result.message);
      }
      // On success, useAuth updates state and App re-renders to the main view
    } catch (err) {
      setMessage('Verification failed. Please try again.');
    }
    setLoading(false);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: 40, width: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: 8 }}>🚀</h2>
        <h3 style={{ textAlign: 'center', marginBottom: 24 }}>
          {step === 'email' ? 'Sign In' : 'Enter Verification Code'}
        </h3>

        {step === 'email' ? (
          <form onSubmit={handleEmailSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              style={{
                width: '100%', padding: 12, borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: 14, marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: 12, borderRadius: 8,
                background: '#3b82f6', color: 'white', border: 'none',
                fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Sending...' : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleOTPSubmit}>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              required
              style={{
                width: '100%', padding: 12, borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: 20, textAlign: 'center',
                letterSpacing: 8, marginBottom: 16, boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: 12, borderRadius: 8,
                background: '#3b82f6', color: 'white', border: 'none',
                fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        )}

        {message && (
          <p style={{
            textAlign: 'center', marginTop: 16, fontSize: 13,
            color: message.includes('sent') ? '#22c55e' : '#ef4444',
          }}>{message}</p>
        )}
      </div>
    </div>
  );
}
