import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  Zap, 
  Github, 
  MessageSquare, 
  ExternalLink,
  Layout as LayoutIcon,
  Cpu,
  Flame
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="app-container">
      <header className="header">
        <div className="logo-container">
          <div className="logo-icon">
            <Zap size={24} color="white" />
          </div>
          <h1 className="logo-text">Astra Obfuscator</h1>
        </div>
        <div className="header-links">
          <button className="icon-btn" onClick={() => window.open('https://github.com/prometheus-lua/Prometheus', '_blank')}>
            <Github size={18} />
          </button>
        </div>
      </header>

      {/* Engine Navigation Bar */}
      <nav className="engine-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `engine-nav-btn ${isActive ? 'active' : ''}`}
        >
          <motion.div
            className="engine-nav-inner"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="engine-nav-icon prometheus-icon">
              <Flame size={20} />
            </div>
            <div className="engine-nav-text">
              <span className="engine-nav-title">Prometheus Engine</span>
              <span className="engine-nav-desc">AST-level obfuscation via Prometheus</span>
            </div>
          </motion.div>
        </NavLink>

        <NavLink
          to="/custom"
          className={({ isActive }) => `engine-nav-btn ${isActive ? 'active' : ''}`}
        >
          <motion.div
            className="engine-nav-inner"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="engine-nav-icon vm-icon">
              <Cpu size={20} />
            </div>
            <div className="engine-nav-text">
              <span className="engine-nav-title">Custom VM Engine</span>
              <span className="engine-nav-desc">XOR-encrypted bytecode virtual machine</span>
            </div>
          </motion.div>
        </NavLink>
      </nav>

      {/* Active engine indicator */}
      <div className="engine-indicator">
        <div className={`indicator-dot ${location.pathname === '/custom' ? 'vm' : 'prometheus'}`} />
        <span className="indicator-text">
          Active: {location.pathname === '/custom' ? 'Custom VM Engine' : 'Prometheus Engine'}
        </span>
      </div>

      <main>
        <Outlet />
      </main>

      <footer className="footer">
        <p>© 2026 Astra Obfuscator — Advanced Lua Protection System</p>
        <div className="footer-links">
          <a href="#" className="footer-link">
            <MessageSquare size={16} />
            Discord Community
          </a>
          <a href="#" className="footer-link">
            <LayoutIcon size={16} />
            Documentation
          </a>
          <a href="#" className="footer-link">
            <ExternalLink size={16} />
            Terms of Use
          </a>
        </div>
      </footer>
    </div>
  );
}
