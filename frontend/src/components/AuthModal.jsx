import React, { useState, useRef } from "react";
import { IconClose, IconUser, IconMail, IconShield } from "./Icons";

export const AuthModal = ({
  initialTab = "login",
  onClose,
  onLogin,
  onRegister,
  isLoading
}) => {
  const [tab, setTab] = useState(initialTab);

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: ""
  });

  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  // Profile photo state for the register tab
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_SIZE_MB = 5;

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    setPhotoError("");

    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setPhotoError("Only JPEG, PNG, or WebP images are allowed.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setPhotoError(`Image must be smaller than ${MAX_SIZE_MB} MB.`);
      e.target.value = "";
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    onLogin(loginForm);
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    // Pass the File object alongside form fields so App.jsx can build FormData
    onRegister({ ...registerForm, photoFile });
  };

  // Quick fill helper for testing/demo
  const fillQuickDemo = (role) => {
    if (role === "admin") {
      setLoginForm({ email: "admin@smarthotel.com", password: "admin" });
    } else {
      setLoginForm({ email: "guest@example.com", password: "password123" });
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
          <IconClose size={20} />
        </button>

        {/* Tab switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => setTab("login")}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "register" ? "active" : ""}`}
            onClick={() => setTab("register")}
          >
            Create Account
          </button>
        </div>

        {tab === "login" ? (
          <div className="auth-form-wrap">
            <div className="auth-header">
              <h2>Welcome Back</h2>
              <p>Sign in to manage your hotel reservations and access member rates.</p>
            </div>

            <form onSubmit={handleLoginSubmit} className="auth-form">
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <IconMail size={18} className="input-icon" />
                  <input
                    type="email"
                    placeholder="guest@example.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-with-icon">
                  <IconShield size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary w-100" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In to Account"}
              </button>
            </form>

            {/* Quick Demo Assist */}
            <div className="demo-fill-box">
              <p className="demo-fill-title">Quick Demo Logins (for evaluation):</p>
              <div className="demo-pill-group">
                <button type="button" className="demo-pill" onClick={() => fillQuickDemo("admin")}>
                  Fill Admin
                </button>
                <button type="button" className="demo-pill" onClick={() => fillQuickDemo("guest")}>
                  Fill Guest
                </button>
              </div>
            </div>

            <div className="auth-footer-prompt">
              <span>Don't have an account yet?</span>
              <button type="button" className="text-link" onClick={() => setTab("register")}>
                Create an account
              </button>
            </div>
          </div>
        ) : (
          <div className="auth-form-wrap">
            <div className="auth-header">
              <h2>Create an Account</h2>
              <p>Join Aura Luxe for instant reservations, concierge assistance, and booking history.</p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="auth-form">
              <div className="form-group">
                <label>Full Name</label>
                <div className="input-with-icon">
                  <IconUser size={18} className="input-icon" />
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <IconMail size={18} className="input-icon" />
                  <input
                    type="email"
                    placeholder="rahul@example.com"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-with-icon">
                  <IconShield size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="Create a strong password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* ── Profile Photo (optional) ── */}
              <div className="form-group">
                <label>
                  Profile Photo
                  <span className="field-optional"> — optional</span>
                </label>

                <div className="photo-upload-area">
                  {/* Preview circle */}
                  <div className="photo-preview-wrap">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Profile preview"
                        className="photo-preview-img"
                      />
                    ) : (
                      <div className="photo-preview-placeholder">
                        <IconUser size={28} />
                      </div>
                    )}
                  </div>

                  <div className="photo-upload-controls">
                    <label
                      htmlFor="profilePhotoInput"
                      className="btn-photo-pick"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                    >
                      {photoFile ? "Change Photo" : "Choose Photo"}
                    </label>
                    <input
                      id="profilePhotoInput"
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      className="photo-file-input-hidden"
                    />
                    {photoFile && (
                      <button
                        type="button"
                        className="btn-photo-clear"
                        onClick={clearPhoto}
                        title="Remove photo"
                      >
                        Remove
                      </button>
                    )}
                    <p className="photo-hint">JPEG, PNG, or WebP · max 5 MB</p>
                    {photoError && <p className="photo-error">{photoError}</p>}
                    {photoFile && !photoError && (
                      <p className="photo-filename">{photoFile.name}</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary w-100"
                disabled={isLoading || !!photoError}
              >
                {isLoading ? "Creating Account..." : "Create Free Account"}
              </button>
            </form>

            <div className="auth-footer-prompt">
              <span>Already have an account?</span>
              <button type="button" className="text-link" onClick={() => setTab("login")}>
                Sign in here
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
