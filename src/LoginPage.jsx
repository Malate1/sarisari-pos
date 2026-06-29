// src/components/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';

export default function LoginPage() {
  const { signIn, signUp, loading } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setErrors({});
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      fullName: '',
    });
  }, [isLogin]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    }
    
    if (!isLogin) {
      if (!formData.fullName) {
        newErrors.fullName = 'Full name is required';
      }
      
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    
    if (isLogin) {
      await signIn(formData.username, formData.password);
    } else {
      await signUp(formData.fullName, formData.username, formData.password);
    }
    
    setIsSubmitting(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      fullName: '',
    });
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return (
    <div className="login-container">
      {/* Premium Cover Background */}
      <div className="background-effects">
        <div className="gradient-overlay"></div>
        <div className="blur-circle-1"></div>
        <div className="blur-circle-2"></div>
        <div className="blur-circle-3"></div>
        <div className="grid-pattern"></div>
      </div>

      {/* Cover Page Layout - Split Screen */}
      <div className="cover-wrapper">
        
        {/* Left Panel - Brand Cover */}
        <div className="brand-panel">
          <div className="deco-circle-1"></div>
          <div className="deco-circle-2"></div>
          <div className="deco-circle-3"></div>
          
          <div className="brand-content">
            <div className="brand-header">
              <div className="brand-icon">
                <span>🏪</span>
              </div>
              <div>
                <h1 className="brand-title">LM SariHub</h1>
                <p className="brand-subtitle">Premium Store Management</p>
              </div>
            </div>

            <div className="hero-section">
              <h2 className="hero-title">
                {isLogin ? (
                  <>Welcome Back<br /><span className="gradient-text">to Your Dashboard</span></>
                ) : (
                  <>Join the<br /><span className="gradient-text">SariHub Community</span></>
                )}
              </h2>
              
              <p className="hero-description">
                {isLogin 
                  ? 'Access your store dashboard and manage your business efficiently.'
                  : 'Start your journey with LM SariHub and transform your store management.'}
              </p>

              <div className="status-indicators">
                <div className="status-item">
                  <span className="status-dot green"></span>
                  <span>{isLogin ? 'Secure Access' : 'Free Registration'}</span>
                </div>
                <div className="status-item">
                  <span className="status-dot blue"></span>
                  <span>{isLogin ? '24/7 Support' : 'Premium Features'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="feature-grid">
            <div className="feature-item">
              <span>📊</span>
              <span>Analytics</span>
            </div>
            <div className="feature-item">
              <span>📦</span>
              <span>Inventory</span>
            </div>
            <div className="feature-item">
              <span>👥</span>
              <span>Customers</span>
            </div>
            <div className="feature-item">
              <span>💰</span>
              <span>Reports</span>
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="form-panel">
          <div className="form-wrapper">
            <div className="form-header">
              <h3>{isLogin ? 'Sign In' : 'Create Account'}</h3>
              <p>{isLogin ? 'Enter your credentials to continue' : 'Fill in the details to get started'}</p>
            </div>

            <form onSubmit={handleSubmit} className="form-fields">
              {!isLogin && (
                <div className="field-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    disabled={isSubmitting || loading}
                  />
                  {errors.fullName && <p className="error-text">{errors.fullName}</p>}
                </div>
              )}

              <div className="field-group">
                <label>Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  disabled={isSubmitting || loading}
                  autoComplete="username"
                />
                {errors.username && <p className="error-text">{errors.username}</p>}
              </div>

              <div className="field-group">
                <label>Password</label>
                <div className="password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    disabled={isSubmitting || loading}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="toggle-password"
                  >
                    {showPassword ? '👁️‍🗨️' : '👁️'}
                  </button>
                </div>
                {errors.password && <p className="error-text">{errors.password}</p>}
              </div>

              {!isLogin && (
                <div className="field-group">
                  <label>Confirm Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      disabled={isSubmitting || loading}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="toggle-password"
                    >
                      {showConfirmPassword ? '👁️‍🗨️' : '👁️'}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || loading}
                className="submit-button"
              >
                {isSubmitting || loading ? (
                  <>
                    <div className="spinner"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                )}
              </button>
            </form>

            <div className="divider">
              <span>
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </span>
            </div>

            <button
              onClick={toggleMode}
              disabled={isSubmitting || loading}
              className="toggle-button"
            >
              {isLogin ? 'Create New Account' : 'Sign In Instead'}
            </button>
          </div>
        </div>
      </div>

      <style>
        {`
          /* Container */
          .login-container {
            min-height: 100vh;
            background: #0a0a0f;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
            position: relative;
            overflow: hidden;
          }

          /* Background Effects */
          .background-effects {
            position: absolute;
            inset: 0;
          }

          .gradient-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
            opacity: 0.9;
          }

          .blur-circle-1 {
            position: absolute;
            top: 2.5rem;
            left: 2.5rem;
            width: 18rem;
            height: 18rem;
            background: #7c3aed;
            border-radius: 50%;
            filter: blur(3rem);
            opacity: 0.2;
            animation: pulse 2s ease-in-out infinite;
          }

          .blur-circle-2 {
            position: absolute;
            bottom: 2.5rem;
            right: 2.5rem;
            width: 24rem;
            height: 24rem;
            background: #2563eb;
            border-radius: 50%;
            filter: blur(3rem);
            opacity: 0.2;
            animation: pulse 2s ease-in-out infinite 1s;
          }

          .blur-circle-3 {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 600px;
            height: 600px;
            background: #4f46e5;
            border-radius: 50%;
            filter: blur(3rem);
            opacity: 0.1;
          }

          .grid-pattern {
            position: absolute;
            inset: 0;
            background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
          }

          /* Cover Wrapper */
          .cover-wrapper {
            position: relative;
            width: 100%;
            max-width: 72rem;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
            border-radius: 1.5rem;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: fadeIn 0.6s ease-out;
          }

          /* Brand Panel */
          .brand-panel {
            position: relative;
            background: linear-gradient(135deg, #1e1b4b, #312e81, #1e3a5f);
            padding: 3rem 4rem;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 700px;
          }

          .deco-circle-1 {
            position: absolute;
            top: 0;
            right: 0;
            width: 16rem;
            height: 16rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 50%;
            transform: translate(50%, -50%);
          }

          .deco-circle-2 {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 12rem;
            height: 12rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 50%;
            transform: translate(-50%, 50%);
          }

          .deco-circle-3 {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            height: 400px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 50%;
          }

          .brand-content {
            position: relative;
            z-index: 10;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .brand-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 3rem;
          }

          .brand-icon {
            width: 3.5rem;
            height: 3.5rem;
            background: linear-gradient(135deg, #60a5fa, #a78bfa);
            border-radius: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.75rem;
            box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.3);
          }

          .brand-title {
            color: white;
            font-size: 1.5rem;
            font-weight: 700;
            letter-spacing: -0.025em;
          }

          .brand-subtitle {
            color: rgba(191, 219, 254, 0.7);
            font-size: 0.875rem;
          }

          .hero-section {
            margin-bottom: 2rem;
          }

          .hero-title {
            font-size: 2.5rem;
            font-weight: 700;
            color: white;
            line-height: 1.2;
            margin-bottom: 1rem;
          }

          .gradient-text {
            background: linear-gradient(135deg, #60a5fa, #a78bfa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .hero-description {
            color: rgba(191, 219, 254, 0.7);
            font-size: 1.125rem;
            max-width: 20rem;
          }

          .status-indicators {
            display: flex;
            gap: 1rem;
            padding-top: 1rem;
          }

          .status-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: rgba(191, 219, 254, 0.6);
            font-size: 0.875rem;
          }

          .status-dot {
            width: 0.5rem;
            height: 0.5rem;
            border-radius: 50%;
          }

          .status-dot.green {
            background: #34d399;
            animation: pulse 2s ease-in-out infinite;
          }

          .status-dot.blue {
            background: #60a5fa;
          }

          .feature-grid {
            position: relative;
            z-index: 10;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            padding-top: 3rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }

          .feature-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: rgba(191, 219, 254, 0.6);
            font-size: 0.875rem;
          }

          .feature-item span:first-child {
            font-size: 1.25rem;
          }

          /* Form Panel */
          .form-panel {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(12px);
            padding: 3rem 4rem;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .form-wrapper {
            width: 100%;
            max-width: 24rem;
          }

          .form-header {
            text-align: center;
            margin-bottom: 2rem;
          }

          .form-header h3 {
            color: white;
            font-size: 1.5rem;
            font-weight: 700;
          }

          .form-header p {
            color: rgba(255, 255, 255, 0.5);
            font-size: 0.875rem;
            margin-top: 0.25rem;
          }

          .form-fields {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .field-group {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }

          .field-group label {
            color: rgba(255, 255, 255, 0.7);
            font-size: 0.875rem;
            font-weight: 500;
          }

          .field-group input {
            width: 100%;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.75rem;
            color: white;
            transition: all 0.2s;
          }

          .field-group input:focus {
            outline: none;
            border-color: rgba(96, 165, 250, 0.5);
          }

          .field-group input::placeholder {
            color: rgba(255, 255, 255, 0.3);
          }

          .field-group input:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .password-wrapper {
            position: relative;
          }

          .password-wrapper input {
            padding-right: 3rem;
          }

          .toggle-password {
            position: absolute;
            right: 0.75rem;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.4);
            cursor: pointer;
            font-size: 1rem;
            padding: 0.25rem;
          }

          .toggle-password:hover {
            color: rgba(255, 255, 255, 0.8);
          }

          .error-text {
            color: #f87171;
            font-size: 0.75rem;
          }

          .submit-button {
            width: 100%;
            padding: 0.875rem;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            color: white;
            border: none;
            border-radius: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(139, 92, 246, 0.2);
          }

          .submit-button:hover:not(:disabled) {
            background: linear-gradient(135deg, #2563eb, #7c3aed);
            box-shadow: 0 10px 15px -3px rgba(139, 92, 246, 0.4);
          }

          .submit-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .spinner {
            width: 1.25rem;
            height: 1.25rem;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          .divider {
            position: relative;
            margin: 1.5rem 0;
          }

          .divider::before {
            content: '';
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }

          .divider span {
            position: relative;
            display: block;
            text-align: center;
            padding: 0 1rem;
            background: transparent;
            color: rgba(255, 255, 255, 0.4);
            font-size: 0.875rem;
          }

          .toggle-button {
            width: 100%;
            padding: 0.75rem;
            background: transparent;
            color: rgba(255, 255, 255, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.75rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }

          .toggle-button:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.3);
          }

          .toggle-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          /* Animations */
          @keyframes pulse {
            0%, 100% {
              opacity: 0.2;
            }
            50% {
              opacity: 0.3;
            }
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px) scale(0.98);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          /* Responsive */
          @media (max-width: 1024px) {
            .cover-wrapper {
              grid-template-columns: 1fr;
              max-width: 28rem;
            }

            .brand-panel {
              padding: 2rem;
              min-height: 400px;
            }

            .form-panel {
              padding: 2rem;
            }

            .hero-title {
              font-size: 2rem;
            }

            .brand-content {
              justify-content: flex-start;
            }

            .brand-header {
              margin-bottom: 1.5rem;
            }

            .feature-grid {
              padding-top: 1.5rem;
            }
          }

          @media (max-width: 640px) {
            .brand-panel {
              padding: 1.5rem;
              min-height: 300px;
            }

            .form-panel {
              padding: 1.5rem;
            }

            .hero-title {
              font-size: 1.5rem;
            }

            .feature-grid {
              grid-template-columns: 1fr 1fr;
              gap: 0.5rem;
            }

            .brand-icon {
              width: 2.75rem;
              height: 2.75rem;
              font-size: 1.25rem;
            }

            .brand-title {
              font-size: 1.25rem;
            }

            .status-indicators {
              flex-direction: column;
              gap: 0.5rem;
            }
          }
        `}
      </style>
    </div>
  );
}