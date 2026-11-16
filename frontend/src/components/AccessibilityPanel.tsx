import React, { useState } from 'react';
import type { AccessibilityPayload } from '../types/umr';
import { ISLSkeletonViewer } from './ISLSkeletonViewer';
import './AccessibilityPanel.css';

interface AccessibilityPanelProps {
  accessibility?: AccessibilityPayload | null;
  onPlaySonification?: () => void;
}

export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({
  accessibility,
  onPlaySonification
}) => {
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showISLModal, setShowISLModal] = useState(false);
  const [selectedISLSign, setSelectedISLSign] = useState<string>('');

  if (!accessibility) {
    return null;
  }

  const { speech, braille, sonification, sign_language } = accessibility;

  // Handle Web Speech API ClearSpeak TTS
  const handlePlaySpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in your browser.');
      return;
    }

    if (isPlayingSpeech) {
      window.speechSynthesis.cancel();
      setIsPlayingSpeech(false);
      return;
    }

    window.speechSynthesis.cancel();
    const fullText = [
      `Problem: ${speech?.expression_speech || ''}.`,
      ...(speech?.steps_speech || [])
    ].join(' ');

    const utterance = new SpeechSynthesisUtterance(fullText);
    utterance.rate = 0.95;
    utterance.onend = () => setIsPlayingSpeech(false);
    utterance.onerror = () => setIsPlayingSpeech(false);

    setIsPlayingSpeech(true);
    window.speechSynthesis.speak(utterance);
  };

  const currentBraille = braille?.expression_braille || '';

  const handleCopyBraille = () => {
    if (currentBraille) {
      navigator.clipboard.writeText(currentBraille);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Web Audio API tone generator for Sonification (MAIDR)
  const handleSonificationAudio = () => {
    if (onPlaySonification) {
      onPlaySonification();
      return;
    }

    if (!sonification || !sonification.points || sonification.points.length === 0) {
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      let startTime = ctx.currentTime + 0.05;

      sonification.points.forEach((pt) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(pt.frequency_hz, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.12);

        startTime += 0.12;
      });
    } catch (e) {
      console.error('Audio sonification failed:', e);
    }
  };

  return (
    <div className="accessibility-panel" role="region" aria-label="Accessibility and Multi-Modal Accommodations">
      <div className="a11y-header">
        <span className="a11y-badge">♿ Accessibility Accommodations</span>
      </div>

      <div className="a11y-controls-row">
        {/* MathCAT Speech */}
        {speech && (
          <button
            className={`a11y-btn ${isPlayingSpeech ? 'active' : ''}`}
            onClick={handlePlaySpeech}
            aria-label={isPlayingSpeech ? 'Stop speech' : 'Hear ClearSpeak mathematical readout'}
            title="Listen to mathematically precise ClearSpeak narration (MathCAT)"
          >
            {isPlayingSpeech ? '⏹️ Stop Speech' : '🔊 Hear Math (ClearSpeak)'}
          </button>
        )}

        {/* MAIDR Sonification */}
        {sonification && sonification.points && (
          <button
            className="a11y-btn sonification"
            onClick={handleSonificationAudio}
            aria-label="Play audio sonification of graph"
            title="Audio pitch mapping of graph curve (MAIDR)"
          >
            🎵 Play Sonification (MAIDR)
          </button>
        )}

        {/* Sixth-Sense ISL Details */}
        {sign_language && (
          <button
            className="a11y-btn isl"
            onClick={() => setShowISLModal(!showISLModal)}
            aria-label="View Indian Sign Language support information"
            title="View Indian Sign Language gesture coverage"
          >
            🤟 Sign Language (ISL)
          </button>
        )}
      </div>

      {/* Braille Display Output */}
      {braille && (
        <div className="braille-output-card">
          <div className="braille-card-header">
            <span className="braille-label">
              Tactile Braille Code ({braille.standard.toUpperCase()} Standard)
            </span>
            <div className="braille-actions">
              <button
                className="braille-copy-btn"
                onClick={handleCopyBraille}
                aria-label="Copy Unicode Braille characters to clipboard"
              >
                {copied ? '✓ Copied' : '📋 Copy Braille'}
              </button>
            </div>
          </div>
          <div className="braille-text-display" aria-label={`Braille text: ${currentBraille}`}>
            {currentBraille || '⠭⠘⠆⠐⠬⠢⠭⠬⠖⠀⠨⠤⠀⠴'}
          </div>
          <div className="braille-subtext">
            Generated via MathCAT rules from MathML representation.
          </div>
        </div>
      )}

      {/* ISL Information Modal / Drawer */}
      {showISLModal && sign_language && (
        <div className="isl-drawer">
          <div className="isl-drawer-header">
            <h5>Indian Sign Language Interaction (Sixth-Sense Model)</h5>
            <span className="isl-dialect-badge">ISL Standard</span>
          </div>

          {/* Sequential Sign Breakdown */}
          {sign_language.sign_sequence && sign_language.sign_sequence.length > 0 && (
            <div className="isl-sequence-section">
              <span className="isl-section-title">Sign Language Sequence:</span>
              <div className="isl-sequence-chips">
                {sign_language.sign_sequence.map((item, idx) => (
                  <div
                    key={`${item.sign}-${idx}`}
                    className={`isl-chip ${item.has_3d_template ? 'template-ready' : 'gloss-ready'} ${item.sign === selectedISLSign ? 'selected' : ''}`}
                    title={item.description}
                    onClick={() => setSelectedISLSign(item.sign)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="chip-sign">{item.sign}</span>
                    <span className="chip-desc">{item.has_3d_template ? '🖐️ 3D Sign' : '📐 Math Gloss'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive 3D Skeleton Gesture Player */}
          {sign_language.sign_sequence && sign_language.sign_sequence.length > 0 && (
            <ISLSkeletonViewer
              signSequence={sign_language.sign_sequence}
              activeSign={selectedISLSign}
              onSelectSign={setSelectedISLSign}
            />
          )}

          {sign_language.unsupported_tokens.length > 0 ? (
            <div className="isl-warning">
              ⚠️ Custom continuous gesture pending for: {sign_language.unsupported_tokens.join(' ')}
            </div>
          ) : (
            <div className="isl-success-note">
              ✓ All tokens in this equation are mapped to supported ISL signs and educational math glosses.
            </div>
          )}

          <p className="isl-disclaimer">{sign_language.disclaimer}</p>
        </div>
      )}
    </div>
  );
};
