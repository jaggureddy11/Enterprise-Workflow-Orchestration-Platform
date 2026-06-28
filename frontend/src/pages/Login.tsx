import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../store/auth.store';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const setToken = useAuthStore((state) => state.setToken);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      setToken(response.data.data.accessToken);
      navigate('/');
    } catch (err) {
      setError('Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: 520, margin: '0 auto', paddingTop: 80 }}>
      <div className="page-card">
        <h1 className="section-title">Sign In</h1>
        <p>Access your enterprise workflow dashboard.</p>
        <form className="grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p style={{ color: '#fb7185' }}>{error}</p>}
          <button type="submit" className="button">Sign In</button>
        </form>
      </div>
    </div>
  );
}
