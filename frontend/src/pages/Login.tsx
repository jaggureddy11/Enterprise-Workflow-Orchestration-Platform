import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { useAuthStore } from '../store/auth.store';
import api from '../api/client';

export function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration specific fields
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (data.session) {
        setToken(data.session.access_token);
        navigate('/');
      } else {
        throw new Error('No session returned from Supabase Auth.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      // 1. Call custom backend to register tenant & provision Postgres schema
      const response = await api.post('/auth/register-tenant', {
        tenantName,
        tenantSlug,
        ownerEmail: email,
        ownerPassword: password,
        ownerFirstName: firstName,
        ownerLastName: lastName,
      });

      const { accessToken } = response.data.data;
      if (!accessToken) {
        throw new Error('Tenant registration completed but access token was not returned.');
      }

      // Decode local JWT token to extract the generated tenantId (UUID)
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const { tenantId } = payload;

      // 2. Register the user in Supabase Auth, embedding tenantId and tenantSlug in metadata
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            tenantId,
            tenantSlug,
            role: 'OWNER',
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        setToken(data.session.access_token);
        navigate('/');
      } else {
        setSuccess('Registration successful! Please check your email for confirmation, or try signing in.');
        setIsRegistering(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.message || 'Registration failed.');
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: 520, margin: '0 auto', paddingTop: 80 }}>
      <div className="page-card">
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, borderBottom: '1px solid rgba(148, 163, 184, 0.12)', paddingBottom: 12 }}>
          <button
            onClick={() => { setIsRegistering(false); setError(''); setSuccess(''); }}
            style={{
              background: 'none',
              border: 'none',
              color: !isRegistering ? '#3b82f6' : '#94a3b8',
              fontWeight: 600,
              fontSize: '1.1rem',
              cursor: 'pointer',
              padding: '4px 8px',
              borderBottom: !isRegistering ? '2px solid #3b82f6' : 'none',
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => { setIsRegistering(true); setError(''); setSuccess(''); }}
            style={{
              background: 'none',
              border: 'none',
              color: isRegistering ? '#3b82f6' : '#94a3b8',
              fontWeight: 600,
              fontSize: '1.1rem',
              cursor: 'pointer',
              padding: '4px 8px',
              borderBottom: isRegistering ? '2px solid #3b82f6' : 'none',
            }}
          >
            Register Tenant
          </button>
        </div>

        {!isRegistering ? (
          <>
            <h1 className="section-title">Sign In</h1>
            <p>Access your enterprise workflow dashboard.</p>
            <form className="grid" onSubmit={handleSignIn}>
              <label>
                Email
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Password
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              {error && <p style={{ color: '#fb7185' }}>{error}</p>}
              {success && <p style={{ color: '#34d399' }}>{success}</p>}
              <button type="submit" className="button">Sign In</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="section-title">Register Tenant</h1>
            <p>Setup a new enterprise workspace & admin account.</p>
            <form className="grid" onSubmit={handleRegister}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  First Name
                  <input className="input" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </label>
                <label>
                  Last Name
                  <input className="input" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label>
                  Tenant Name
                  <input className="input" type="text" placeholder="e.g. Acme Corporation" value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
                </label>
                <label>
                  Tenant Slug
                  <input className="input" type="text" placeholder="e.g. acme" value={tenantSlug} onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required />
                </label>
              </div>
              <label>
                Email Address
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label>
                Password
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              {error && <p style={{ color: '#fb7185' }}>{error}</p>}
              {success && <p style={{ color: '#34d399' }}>{success}</p>}
              <button type="submit" className="button">Create Workspace & Account</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
