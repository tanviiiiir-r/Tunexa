import React, { useState } from 'react';
import { apiUrl } from '../config';

interface ClaimButtonProps {
  artistId: string;
  artistName: string;
}

export function ClaimArtistButton({ artistId, artistName }: ClaimButtonProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ email: '', name: '', proof_description: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    try {
      const resp = await fetch(apiUrl('/claim'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist_id: artistId,
          email: formData.email,
          name: formData.name,
          proof_description: formData.proof_description
        })
      });

      const data = await resp.json();

      if (resp.ok) {
        setStatus('success');
        setMessage(data.message || 'Claim submitted successfully!');
      } else {
        setStatus('error');
        setMessage(data.detail || 'Failed to submit claim');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div style={{
        background: 'rgba(29, 185, 84, 0.2)',
        border: '1px solid #1DB954',
        borderRadius: '8px',
        padding: '1rem',
        textAlign: 'center'
      }}>
        <div style={{ color: '#1DB954', fontSize: '1.5rem' }}>✓</div>
        <div style={{ color: '#fff', marginTop: '0.5rem' }}>{message}</div>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        style={{
          width: '100%',
          padding: '0.75rem 1.5rem',
          background: '#1DB954',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          transition: 'background 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.background = '#1ed760'}
        onMouseOut={(e) => e.currentTarget.style.background = '#1DB954'}
      >
        📝 Claim This Artist
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h4 style={{ margin: '0 0 0.5rem 0', color: '#fff', fontSize: '1rem' }}>
        Claim &quot;{artistName}&quot;
      </h4>
      <input
        type="text"
        placeholder="Your Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
        style={{
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #444',
          background: '#2a2a3e',
          color: '#fff'
        }}
      />
      <input
        type="email"
        placeholder="your@email.com"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
        style={{
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #444',
          background: '#2a2a3e',
          color: '#fff'
        }}
      />
      <textarea
        placeholder="Proof you own this artist profile (e.g., official website, social media links)"
        value={formData.proof_description}
        onChange={(e) => setFormData({ ...formData, proof_description: e.target.value })}
        rows={3}
        style={{
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #444',
          background: '#2a2a3e',
          color: '#fff',
          resize: 'vertical'
        }}
      />
      {status === 'error' && (
        <div style={{ color: '#ff6b6b', fontSize: '0.85rem' }}>{message}</div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="submit"
          disabled={status === 'submitting'}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            background: status === 'submitting' ? '#666' : '#1DB954',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: status === 'submitting' ? 'not-allowed' : 'pointer'
          }}
        >
          {status === 'submitting' ? 'Submitting...' : 'Submit Claim'}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          style={{
            padding: '0.5rem 1rem',
            background: 'transparent',
            color: '#888',
            border: '1px solid #444',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
