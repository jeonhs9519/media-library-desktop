import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [policy, setPolicy] = useState('once')

  useEffect(() => {
    window.api.settings.get('fileModifiedAt.updatePolicy').then(v => {
      if (v) setPolicy(v)
    })
  }, [])

  const handleChange = async (v: string) => {
    setPolicy(v)
    await window.api.settings.set('fileModifiedAt.updatePolicy', v)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
      <button className="btn-secondary" onClick={() => navigate('/')} style={{ marginBottom: 24 }}>← Back</button>
      <h1 style={{ fontSize: 24, marginBottom: 24 }}>Settings</h1>

      <div style={{ background: '#16213e', borderRadius: 8, padding: 20 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>File Modified Date Policy</h2>
        <p style={{ color: '#a0a0b0', marginBottom: 16, fontSize: 14 }}>
          When to read the file's modification date.
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            value="once"
            checked={policy === 'once'}
            onChange={() => handleChange('once')}
          />
          <div>
            <div>Once (default)</div>
            <div style={{ fontSize: 12, color: '#a0a0b0' }}>Read only when adding to library</div>
          </div>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            value="always"
            checked={policy === 'always'}
            onChange={() => handleChange('always')}
          />
          <div>
            <div>Always</div>
            <div style={{ fontSize: 12, color: '#a0a0b0' }}>Re-read on every library load</div>
          </div>
        </label>
      </div>
    </div>
  )
}
