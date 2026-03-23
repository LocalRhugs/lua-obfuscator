import { useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { useDropzone } from 'react-dropzone';
import { 
  Cpu, 
  ShieldCheck, 
  Download, 
  Copy, 
  Check, 
  Trash2, 
  AlertCircle, 
  Loader2, 
  FileCode,
  Star,
  Shield,
  Zap,
  Lock,
  Binary,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ObfuscationStrength = 'Light' | 'Medium' | 'Heavy';

interface VMStats {
  originalSize: number;
  obfuscatedSize: number;
  compressionRatio: string;
  timeTaken: string;
  engine: string;
  keyLength: number;
  bytecodeSize: number;
}

export default function CustomVMPage() {
  const [inputCode, setInputCode] = useState<string>('-- Astra Custom VM Engine\n-- Enter your Lua code below or drag and drop a .lua file\n-- Your code will be encrypted into a custom bytecode VM\n\nlocal message = "Protected by Astra VM"\nprint(message)\n\nfor i = 1, 5 do\n  print("Iteration: " .. i)\nend');
  const [outputCode, setOutputCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [strength, setStrength] = useState<ObfuscationStrength>('Medium');
  const [stats, setStats] = useState<VMStats | null>(null);
  const [showCopyCheckmark, setShowCopyCheckmark] = useState<boolean>(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setInputCode(text);
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    accept: { 'text/x-lua': ['.lua'] }
  });

  const handleObfuscate = async () => {
    if (!inputCode.trim()) {
      setError('Please enter some code to obfuscate.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStats(null);

    try {
      const response = await fetch(`${API_URL}/obfuscate-vm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inputCode, strength }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'VM obfuscation failed');
      }

      setOutputCode(data.output || '');
      setStats(data.stats || null);
    } catch (err) {
      const error = err as Error;
      setError(error.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!outputCode) return;
    navigator.clipboard.writeText(outputCode);
    setShowCopyCheckmark(true);
    setTimeout(() => setShowCopyCheckmark(false), 2000);
  };

  const downloadOutput = () => {
    if (!outputCode) return;
    const blob = new Blob([outputCode], { type: 'text/x-lua' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `astra_vm_${strength.toLowerCase()}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearInput = () => {
    setInputCode('');
    setError(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      
      <AnimatePresence>
        {isDragActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="dropzone-overlay"
          >
            <div className="text-center">
              <FileCode size={64} className="mb-4 text-white" />
              <p className="text-2xl font-bold text-white">Drop to Upload .lua File</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VM Engine Feature Chips */}
      <div className="vm-features">
        <div className="vm-chip">
          <Binary size={14} />
          <span>Custom Bytecode</span>
        </div>
        <div className="vm-chip">
          <Key size={14} />
          <span>XOR Encryption</span>
        </div>
        <div className="vm-chip">
          <Lock size={14} />
          <span>Dead Code Injection</span>
        </div>
        <div className="vm-chip">
          <Cpu size={14} />
          <span>VM Interpreter</span>
        </div>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="error-banner"
        >
          <AlertCircle size={20} />
          <div>
            <strong>Error:</strong> {error}
          </div>
        </motion.div>
      )}

      <div className="controls-bar vm-controls">
        <div className="strength-selector">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '0.5rem', fontWeight: 600, textTransform: 'uppercase' }}>VM Strength:</span>
          {(['Light', 'Medium', 'Heavy'] as ObfuscationStrength[]).map((level) => (
            <button
              key={level}
              className={`strength-btn vm-strength ${strength === level ? 'active' : ''}`}
              onClick={() => setStrength(level)}
            >
              {level === 'Light' && <Zap size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />}
              {level === 'Medium' && <Shield size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />}
              {level === 'Heavy' && <Star size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />}
              {level}
            </button>
          ))}
        </div>

        <button 
          className="obfuscate-btn vm-obfuscate-btn" 
          onClick={handleObfuscate}
          disabled={isLoading || !inputCode.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="spinner" size={20} />
              Encrypting VM...
            </>
          ) : (
            <>
              <Cpu size={20} />
              Encrypt to VM
            </>
          )}
        </button>
      </div>

      <div className="editor-layout">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card"
        >
          <div className="panel-header">
            <span className="panel-title">
              <FileCode size={16} />
              Source Code
            </span>
            <button className="icon-btn" onClick={clearInput} title="Clear Input">
              <Trash2 size={16} />
            </button>
          </div>
          <CodeMirror
            value={inputCode}
            height="450px"
            theme={dracula}
            extensions={[StreamLanguage.define(lua)]}
            onChange={(value) => setInputCode(value)}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
            }}
          />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card"
        >
          <div className="panel-header">
            <span className="panel-title">
              <ShieldCheck size={16} />
              VM-Protected Output
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className={`icon-btn ${showCopyCheckmark ? 'success' : ''}`} 
                onClick={copyToClipboard}
                disabled={!outputCode || isLoading}
                title="Copy to Clipboard"
              >
                {showCopyCheckmark ? <Check size={16} /> : <Copy size={16} />}
                <span>{showCopyCheckmark ? 'Copied' : 'Copy'}</span>
              </button>
              <button 
                className="icon-btn" 
                onClick={downloadOutput}
                disabled={!outputCode || isLoading}
                title="Download File"
              >
                <Download size={16} />
                <span>Download</span>
              </button>
            </div>
          </div>
          <CodeMirror
            value={outputCode}
            height={stats ? "340px" : "450px"}
            theme={dracula}
            extensions={[StreamLanguage.define(lua)]}
            readOnly={true}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: false,
            }}
          />
          {stats && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="stats-bar vm-stats"
            >
              <div className="stat-item">
                <span className="stat-label">Original</span>
                <span className="stat-value">{formatSize(stats.originalSize)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">VM Output</span>
                <span className="stat-value">{formatSize(stats.obfuscatedSize)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Ratio</span>
                <span className="stat-value">{stats.compressionRatio}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Key Size</span>
                <span className="stat-value vm-accent">{stats.keyLength} bytes</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Bytecode</span>
                <span className="stat-value vm-accent">{formatSize(stats.bytecodeSize)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Time</span>
                <span className="stat-value">{stats.timeTaken}</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
