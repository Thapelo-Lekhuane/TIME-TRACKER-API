import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [error, setError] = useState('');
  const { login, signup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignup) {
        await signup(email, password, fullName, designation);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || (isSignup ? 'Sign up failed' : 'Login failed'));
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Time Tracker</h1>
        <div className="auth-toggle">
          <button
            type="button"
            className={!isSignup ? 'active' : ''}
            onClick={() => setIsSignup(false)}
          >
            Login
          </button>
          <button
            type="button"
            className={isSignup ? 'active' : ''}
            onClick={() => setIsSignup(true)}
          >
            Sign Up
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {isSignup && (
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {isSignup && (
            <div className="form-group">
              <label>Designation (Optional)</label>
              <input
                type="text"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="e.g., Software Developer"
              />
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <button type="submit" className="btn-primary">
            {isSignup ? 'Sign Up' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
