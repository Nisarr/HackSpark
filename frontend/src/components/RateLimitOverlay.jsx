import React, { useState, useEffect } from 'react';
import { onRateLimitChange, getRateLimitState } from '../api';

/**
 * Full-screen overlay that appears when the API rate limit is hit.
 * Shows a loading animation with countdown timer until requests can resume.
 */
export default function RateLimitOverlay() {
  const [state, setState] = useState(getRateLimitState());

  useEffect(() => {
    const unsubscribe = onRateLimitChange(setState);
    return unsubscribe;
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!state.isLimited) return;
    const interval = setInterval(() => {
      setState(getRateLimitState());
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isLimited]);

  if (!state.isLimited) return null;

  const seconds = Math.ceil(state.remainingMs / 1000);

  return (
    <div className="rate-limit-overlay">
      <div className="rate-limit-card">
        {/* Animated spinner */}
        <div className="rate-limit-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring spinner-ring-2"></div>
          <div className="spinner-ring spinner-ring-3"></div>
        </div>
        
        <h2 className="rate-limit-title">Syncing Data</h2>
        <p className="rate-limit-message">
          Refreshing cache from the central server. This keeps everything fast and up-to-date.
        </p>
        
        <div className="rate-limit-countdown">
          <span className="countdown-number">{seconds}</span>
          <span className="countdown-label">seconds remaining</span>
        </div>

        {/* Progress bar */}
        <div className="rate-limit-progress-track">
          <div 
            className="rate-limit-progress-bar"
            style={{
              width: `${Math.max(0, 100 - (state.remainingMs / (60 * 1000)) * 100)}%`
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}
