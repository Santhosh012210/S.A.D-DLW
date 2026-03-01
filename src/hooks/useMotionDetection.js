// src/hooks/useMotionDetection.js
// Real optical-flow approximation via pixel-difference on canvas frames

import { useRef, useCallback, useEffect, useState } from 'react';

const CANVAS_W = 160;
const CANVAS_H = 90;
const CRASH_THRESHOLD = 72; // % motion to auto-trigger
const SAMPLE_INTERVAL = 120; // ms between frames

export function useMotionDetection({ videoRef, onCrashDetected, enabled = true }) {
  const canvasRef     = useRef(null);
  const prevDataRef   = useRef(null);
  const intervalRef   = useRef(null);
  const baselineRef   = useRef([]); // rolling baseline (last 20 readings)
  const [motionLevel, setMotionLevel]   = useState(0);
  const [motionHistory, setMotionHistory] = useState(Array(60).fill(0));

  // Create off-screen canvas once
  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
    canvasRef.current.width  = CANVAS_W;
    canvasRef.current.height = CANVAS_H;
  }, []);

  const computeMotion = useCallback(() => {
    const video  = videoRef?.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2 || video.paused) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, CANVAS_W, CANVAS_H);
    const frame = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);

    if (!prevDataRef.current) {
      prevDataRef.current = frame.data;
      return;
    }

    // Sum absolute differences on luminance channel
    let totalDiff = 0;
    const pixels  = frame.data.length / 4;
    for (let i = 0; i < frame.data.length; i += 4) {
      const rDiff = Math.abs(frame.data[i]     - prevDataRef.current[i]);
      const gDiff = Math.abs(frame.data[i + 1] - prevDataRef.current[i + 1]);
      const bDiff = Math.abs(frame.data[i + 2] - prevDataRef.current[i + 2]);
      totalDiff  += (rDiff * 0.299 + gDiff * 0.587 + bDiff * 0.114);
    }
    prevDataRef.current = frame.data;

    // Normalize to 0–100
    const rawPct = Math.min(100, (totalDiff / pixels) * 1.8);

    // Compute adaptive baseline (rolling average of last 20)
    baselineRef.current.push(rawPct);
    if (baselineRef.current.length > 20) baselineRef.current.shift();
    const baseline = baselineRef.current.reduce((a, b) => a + b, 0) / baselineRef.current.length;

    // Spike = how much above baseline this frame is (amplified)
    const spike = Math.max(0, Math.min(100, ((rawPct - baseline) * 3.5) + baseline * 0.4));

    setMotionLevel(spike);
    setMotionHistory(prev => {
      const next = [...prev.slice(1), spike];
      return next;
    });

    // Trigger crash if spike exceeds threshold
    if (spike >= CRASH_THRESHOLD) {
      onCrashDetected?.({ motionLevel: spike, raw: rawPct });
    }
  }, [videoRef, onCrashDetected]);

  const start = useCallback(() => {
    prevDataRef.current  = null;
    baselineRef.current  = [];
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(computeMotion, SAMPLE_INTERVAL);
  }, [computeMotion]);

  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    setMotionLevel(0);
    prevDataRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) stop();
    return () => clearInterval(intervalRef.current);
  }, [enabled, stop]);

  return { motionLevel, motionHistory, start, stop };
}
