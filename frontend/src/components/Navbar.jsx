import React, { useState } from "react";
import { IconHotel, IconLogout, IconSettings, IconShield, IconCalendar } from "./Icons";

export const Navbar = ({
  page,
  setPage,
  user,
  onLogout,
  onOpenAuth,
  apiEndpoint,
  onOpenApiSettings,
  isApiOnline
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (targetPage) => {
    setPage(targetPage);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <header className="site-header">
      <div className="header-inner container">
        {/* Brand Logo */}
        <div className="brand" onClick={() => handleNav("home")}>
          <div className="brand-icon-wrap">
            <IconHotel size={22} />
          </div>
          <div className="brand-text">
            <span className="brand-name">AURA LUXE</span>
            <span className="brand-tagline">Smart Cloud Hotel</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="desktop-nav">
          <button
            className={`nav-link ${page === "home" ? "active" : ""}`}
            onClick={() => handleNav("home")}
          >
            Home
          </button>
          <button
            className={`nav-link ${page === "rooms" ? "active" : ""}`}
            onClick={() => handleNav("rooms")}
          >
            Rooms & Suites
          </button>
          <button
            className={`nav-link ${page === "amenities" ? "active" : ""}`}
            onClick={() => handleNav("amenities")}
          >
            Amenities
          </button>

          {user && (
            <button
              className={`nav-link ${page === "my-bookings" ? "active" : ""}`}
              onClick={() => handleNav("my-bookings")}
            >
              <IconCalendar size={15} />
              My Bookings
            </button>
          )}

          {user?.role === "admin" && (
            <button
              className={`nav-link admin-pill-link ${page === "admin" ? "active" : ""}`}
              onClick={() => handleNav("admin")}
            >
              <IconShield size={14} />
              Admin Panel
            </button>
          )}
        </nav>

        {/* Header Right Action Area */}
        <div className="header-actions">
          {/* API Health Pill */}
          <button
            className={`api-indicator-pill ${isApiOnline ? "online" : "offline"}`}
            onClick={onOpenApiSettings}
            title={`Backend: ${apiEndpoint} (Click to configure)`}
          >
            <span className="pulse-dot"></span>
            <span className="api-text">{isApiOnline ? "Cloud Online" : "Local / Demo"}</span>
            <IconSettings size={13} className="settings-cog" />
          </button>

          {/* User Profile or Auth Buttons */}
          {!user ? (
            <div className="auth-buttons">
              <button className="btn-nav-login" onClick={() => onOpenAuth("login")}>
                Sign In
              </button>
              <button className="btn-nav-register" onClick={() => onOpenAuth("register")}>
                Register
              </button>
            </div>
          ) : (
            <div className="user-profile-menu">
              <div className="user-avatar-badge" title={user.email}>
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={`${user.name} profile`}
                    className="avatar-photo"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const letterEl = e.currentTarget.parentElement?.querySelector(".avatar-letter");
                      if (letterEl) letterEl.style.display = "flex";
                    }}
                  />
                ) : null}
                <span
                  className="avatar-letter"
                  style={{ display: user.photoUrl ? "none" : "flex" }}
                >
                  {user.name?.charAt(0).toUpperCase()}
                </span>
                <span className="user-name-display">{user.name.split(" ")[0]}</span>
                {user.role === "admin" && <span className="admin-tag">ADMIN</span>}
              </div>
              <button className="btn-logout" onClick={onLogout} title="Log Out">
                <IconLogout size={16} />
              </button>
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            className="mobile-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            <span className={`bar ${mobileMenuOpen ? "open" : ""}`}></span>
            <span className={`bar ${mobileMenuOpen ? "open" : ""}`}></span>
            <span className={`bar ${mobileMenuOpen ? "open" : ""}`}></span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer">
          <button
            className={`mobile-nav-link ${page === "home" ? "active" : ""}`}
            onClick={() => handleNav("home")}
          >
            Home
          </button>
          <button
            className={`mobile-nav-link ${page === "rooms" ? "active" : ""}`}
            onClick={() => handleNav("rooms")}
          >
            Rooms & Suites
          </button>
          <button
            className={`mobile-nav-link ${page === "amenities" ? "active" : ""}`}
            onClick={() => handleNav("amenities")}
          >
            Amenities
          </button>
          {user && (
            <button
              className={`mobile-nav-link ${page === "my-bookings" ? "active" : ""}`}
              onClick={() => handleNav("my-bookings")}
            >
              My Bookings
            </button>
          )}
          {user?.role === "admin" && (
            <button
              className={`mobile-nav-link admin-mobile ${page === "admin" ? "active" : ""}`}
              onClick={() => handleNav("admin")}
            >
              Admin Dashboard
            </button>
          )}

          <div className="mobile-drawer-auth">
            {!user ? (
              <>
                <button className="btn-primary w-100" onClick={() => { setMobileMenuOpen(false); onOpenAuth("login"); }}>
                  Sign In
                </button>
                <button className="btn-secondary w-100" onClick={() => { setMobileMenuOpen(false); onOpenAuth("register"); }}>
                  Create Account
                </button>
              </>
            ) : (
              <button className="btn-secondary w-100" onClick={() => { setMobileMenuOpen(false); onLogout(); }}>
                <IconLogout size={16} /> Log Out ({user.name})
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
