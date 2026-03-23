import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Cpu, 
  Flame, 
  ShieldCheck, 
  Lock, 
  Binary, 
  Workflow, 
  ChevronRight,
  Star,
  Activity
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  const engines = [
    {
      id: 'prometheus',
      name: 'Prometheus Engine',
      icon: <Flame size={32} />,
      gradient: 'var(--accent-gradient)',
      description: 'Advanced Abstract Syntax Tree (AST) level obfuscation. Provides high compatibility and variable/function name mangling.',
      features: ['Variable Renaming', 'String Encryption', 'Constant Folding', 'Control Flow Flattening'],
      security: 'High',
      link: '/'
    },
    {
      id: 'custom-vm',
      name: 'Astra VM Engine',
      icon: <Cpu size={32} />,
      gradient: 'var(--vm-gradient)',
      description: 'Next-gen virtualization. Compiles your Lua into a custom instruction set executed by a polymorphic virtual machine.',
      features: ['Bytecode Compilation', 'Custom Opcodes', 'XOR-Encrypted VM', 'Hardware-like Execution'],
      security: 'Military Grade',
      link: '/custom'
    }
  ];

  const stats = [
    { label: 'Scripts Protected', value: '1.2M+' },
    { label: 'Average Protection Time', value: '< 1s' },
    { label: 'Decompilation Proof', value: '99.9%' }
  ];

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="hero-content"
        >
          <div className="badge">
            <Star size={14} className="text-yellow-400" />
            <span>Introducing Astra VM 2.0</span>
          </div>
          <h1 className="hero-title">
            The World's Most <span className="highlight">Advanced</span> Lua Protection
          </h1>
          <p className="hero-subtitle">
            Secure your intellectual property with military-grade obfuscation. Choose between high-performance AST mangling or our proprietary virtual machine engine.
          </p>
          
          <div className="hero-cta">
            <button className="primary-btn" onClick={() => navigate('/custom')}>
              Get Started with VM
              <ChevronRight size={18} />
            </button>
            <button className="secondary-btn" onClick={() => navigate('/')}>
              Use Prometheus
            </button>
          </div>
        </motion.div>

        {/* Hero Background Elements */}
        <div className="hero-visual">
          <motion.div 
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 20, 
              repeat: Infinity,
              ease: "linear" 
            }}
            className="orb purple-orb"
          />
          <motion.div 
            animate={{ 
              rotate: -360,
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              duration: 25, 
              repeat: Infinity,
              ease: "linear" 
            }}
            className="orb blue-orb"
          />
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="stat-card"
          >
            <span className="stat-v">{stat.value}</span>
            <span className="stat-l">{stat.label}</span>
          </motion.div>
        ))}
      </section>

      {/* Engine Selection Section */}
      <section className="engine-grid-section">
        <div className="section-header">
          <h2 className="section-title">Select Your Protection Layer</h2>
          <p className="section-subtitle">Different workflows for different security needs</p>
        </div>

        <div className="engine-cards">
          {engines.map((engine, i) => (
            <motion.div
              key={engine.id}
              whileHover={{ y: -10 }}
              initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className={`engine-card-large ${engine.id}`}
              onClick={() => navigate(engine.link)}
            >
              <div className="card-inner">
                <div className="card-header">
                  <div className="engine-icon-large" style={{ background: engine.gradient }}>
                    {engine.icon}
                  </div>
                  <div className="security-badge">
                    <ShieldCheck size={14} />
                    {engine.security}
                  </div>
                </div>
                
                <h3 className="card-title">{engine.name}</h3>
                <p className="card-desc">{engine.description}</p>
                
                <div className="card-features">
                  {engine.features.map(f => (
                    <div key={f} className="feature-item">
                      <div className="feature-dot" style={{ background: engine.gradient }} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <div className="card-footer">
                  <span className="action-text">Launch Engine</span>
                  <ChevronRight size={18} className="arrow" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className="tech-section">
        <div className="tech-marquee">
          <div className="tech-item"><Binary size={20} /> Bytecode Encrypted</div>
          <div className="tech-item"><Lock size={20} /> Polymorphic VM</div>
          <div className="tech-item"><Activity size={20} /> Real-time Protection</div>
          <div className="tech-item"><Workflow size={20} /> CI/CD Ready</div>
          <div className="tech-item"><Zap size={20} /> Ultra Fast</div>
        </div>
      </section>
    </div>
  );
}
