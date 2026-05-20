import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

/**
 * MobileHeader — reusable top header with back button for all pages.
 *
 * Props:
 *   title        {string}   — Page title shown in center
 *   backPath     {string}   — Navigate to this path on back (default: go back in history)
 *   rightElement {ReactNode}— Optional right-side element (e.g. theme toggle)
 *   showBack     {boolean}  — Show back button (default: true)
 */
export default function MobileHeader({ title, backPath, rightElement, showBack = true }) {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
      height: 56,
      background: theme.sidebarBg,
      borderBottom: `1px solid ${theme.border}`,
      display: 'flex', alignItems: 'center',
      padding: '0 12px',
      paddingLeft: 'max(12px, env(safe-area-inset-left))',
      paddingRight: 'max(12px, env(safe-area-inset-right))',
      boxSizing: 'border-box',
      gap: 8,
    }}>
      {/* Back button */}
      {showBack && (
        <button
          onClick={handleBack}
          aria-label="Go back"
          style={{
            width: 40, height: 40, flexShrink: 0,
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', borderRadius: 10,
            color: theme.textPrimary, fontSize: 20,
            padding: 0, minWidth: 40, minHeight: 40,
          }}
        >
          ‹
        </button>
      )}

      {/* Title */}
      <span style={{
        flex: 1,
        fontSize: 16, fontWeight: 700,
        color: theme.textPrimary,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: showBack ? 'left' : 'center',
      }}>
        {title}
      </span>

      {/* Optional right element */}
      {rightElement ? (
        <div style={{ flexShrink: 0 }}>{rightElement}</div>
      ) : (
        // Spacer so title stays centered when back is visible
        showBack && <div style={{ width: 40, flexShrink: 0 }} />
      )}
    </div>
  );
}
