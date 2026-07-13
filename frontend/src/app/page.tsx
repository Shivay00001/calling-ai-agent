'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [status, setStatus] = useState<'idle' | 'calling' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const [keys, setKeys] = useState({ openai: '', anthropic: '', gemini: '', glm: '' });
  const [provider, setProvider] = useState('gpt-4o');
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioToken, setTwilioToken] = useState('');
  const [twilioNumber, setTwilioNumber] = useState('');
  const [elevenlabsKey, setElevenlabsKey] = useState('');
  const [deepgramKey, setDeepgramKey] = useState('');

  useEffect(() => {
    setKeys({
      openai: localStorage.getItem('calling_openai_key') || '',
      anthropic: localStorage.getItem('calling_anthropic_key') || '',
      gemini: localStorage.getItem('calling_gemini_key') || '',
      glm: localStorage.getItem('calling_glm_key') || ''
    });
    setProvider(localStorage.getItem('calling_llm_provider') || 'gpt-4o');
    setTwilioSid(localStorage.getItem('calling_twilio_sid') || '');
    setTwilioToken(localStorage.getItem('calling_twilio_token') || '');
    setTwilioNumber(localStorage.getItem('calling_twilio_number') || '');
    setElevenlabsKey(localStorage.getItem('calling_elevenlabs_key') || '');
    setDeepgramKey(localStorage.getItem('calling_deepgram_key') || '');
  }, []);

  const handleSaveKeys = async () => {
    setStatus('saving');
    try {
      localStorage.setItem('calling_openai_key', keys.openai);
      localStorage.setItem('calling_anthropic_key', keys.anthropic);
      localStorage.setItem('calling_gemini_key', keys.gemini);
      localStorage.setItem('calling_glm_key', keys.glm);
      localStorage.setItem('calling_llm_provider', provider);
      localStorage.setItem('calling_twilio_sid', twilioSid);
      localStorage.setItem('calling_twilio_token', twilioToken);
      localStorage.setItem('calling_twilio_number', twilioNumber);
      localStorage.setItem('calling_elevenlabs_key', elevenlabsKey);
      localStorage.setItem('calling_deepgram_key', deepgramKey);

      await fetch('http://localhost:8006/api/settings/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          openai_api_key: keys.openai, 
          anthropic_api_key: keys.anthropic,
          gemini_api_key: keys.gemini,
          glm_api_key: keys.glm,
          llm_provider: provider,
          twilio_account_sid: twilioSid,
          twilio_auth_token: twilioToken,
          twilio_phone_number: twilioNumber,
          elevenlabs_api_key: elevenlabsKey,
          deepgram_api_key: deepgramKey
        }),
      });
      setStatus('success');
      setMessage('Keys saved!');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (e) {
      setStatus('error');
      setMessage('Network error saving keys.');
    }
  };

  const handleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return;

    setStatus('calling');
    try {
      const res = await fetch('http://localhost:8006/api/outbound-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage('Call initiated! Your phone should ring shortly.');
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to initiate call.');
      }
    } catch (e) {
      console.error(e);
      setStatus('error');
      setMessage('Network error. Ensure backend is running.');
    }
  };

  return (
    <main className="dashboard-container">
      <div className="dashboard-header">
        <h1>AI Telephony Agent</h1>
        <p>Powered by Twilio, Pipecat & ElevenLabs</p>
      </div>

      <form onSubmit={handleCall} className="call-form">
        <input 
          type="tel" 
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+1234567890" 
          className="phone-input"
          required
        />
        <button 
          type="submit"
          className="call-btn" 
          disabled={status === 'calling'}
        >
          {status === 'calling' ? 'Dialing...' : 'Call My Phone'}
        </button>
      </form>

      <div style={{marginTop: '40px', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px'}}>
        <h2 style={{fontSize:'1.2rem', marginBottom: '20px'}}>API Configuration</h2>
        <div className="form-group">
          <label>OpenAI Key</label>
          <input type="password" value={keys.openai} onChange={(e)=>setKeys({...keys, openai: e.target.value})} />
        </div>
        <div className="form-group" style={{marginTop:'10px'}}>
          <label>Anthropic Key</label>
          <input type="password" value={keys.anthropic} onChange={(e)=>setKeys({...keys, anthropic: e.target.value})} />
        </div>
        <div className="form-group" style={{marginTop:'10px'}}>
          <label>Gemini Key</label>
          <input type="password" value={keys.gemini} onChange={(e)=>setKeys({...keys, gemini: e.target.value})} />
        </div>
        <div className="form-group" style={{marginTop:'10px'}}>
          <label>ZhipuAI Key</label>
          <input type="password" value={keys.glm} onChange={(e)=>setKeys({...keys, glm: e.target.value})} />
        </div>
        <div className="form-group" style={{marginTop:'10px'}}>
          <label>LLM Engine</label>
          <select value={provider} onChange={(e)=>setProvider(e.target.value)} style={{width: '100%', padding: '10px'}}>
            <option value="gpt-4o">OpenAI (gpt-4o)</option>
            <option value="claude-3-5-sonnet-20240620">Anthropic (claude-3-5-sonnet)</option>
            <option value="gemini/gemini-1.5-pro">Google AI (gemini-1.5-pro)</option>
            <option value="zhipu/glm-4">ZhipuAI (glm-4)</option>
          </select>
        </div>
        <div className="form-group" style={{marginTop:'10px'}}>
          <label>Deepgram API Key</label>
          <input type="password" value={deepgramKey} onChange={(e)=>setDeepgramKey(e.target.value)} />
        </div>
        <div className="form-group" style={{marginTop:'10px'}}>
          <label>ElevenLabs API Key</label>
          <input type="password" value={elevenlabsKey} onChange={(e)=>setElevenlabsKey(e.target.value)} />
        </div>
        <div className="form-group" style={{marginTop:'10px'}}>
          <label>Twilio Account SID</label>
          <input type="password" value={twilioSid} onChange={(e)=>setTwilioSid(e.target.value)} />
        </div>
        <div className="form-group" style={{marginTop:'10px'}}>
          <label>Twilio Auth Token</label>
          <input type="password" value={twilioToken} onChange={(e)=>setTwilioToken(e.target.value)} />
        </div>
        <div className="form-group" style={{marginTop:'10px'}}>
          <label>Twilio Phone Number (Calling)</label>
          <input type="text" value={twilioNumber} onChange={(e)=>setTwilioNumber(e.target.value)} placeholder="+1234567890" />
        </div>
        
        <button onClick={handleSaveKeys} className="save-btn" disabled={status === 'saving'} style={{marginTop:'20px'}}>
          {status === 'saving' ? 'Saving...' : 'Save Keys'}
        </button>
      </div>

      {status !== 'idle' && status !== 'saving' && (
        <div className={`status-message ${status}`}>
          {message}
        </div>
      )}
    </main>
  );
}
