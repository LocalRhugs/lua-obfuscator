import { useState } from 'react';
import './index.css';

function App() {
  const [inputCode, setInputCode] = useState<string>('-- Enter your Lua code here\nprint("Hello World!")');
  const [outputCode, setOutputCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  const handleObfuscate = async () => {
    if (!inputCode.trim()) {
      setError('Please enter some code to obfuscate.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOutputCode('');

    try {
      const response = await fetch(`${API_URL}/obfuscate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: inputCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to obfuscate code');
      }

      setOutputCode(data.output || '');
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
    alert('Output copied to clipboard!');
  };

  return (
    <>
      <header className="header">
        <h1>
          Lua<span className="header-accent">Obfuscator</span>
        </h1>
        <a href="https://github.com/prometheus-lua/Prometheus" target="_blank" rel="noreferrer" style={{color: 'var(--text-secondary)', textDecoration: 'none'}}>
          Powered by Prometheus
        </a>
      </header>

      <main className="main-content">
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="panels-container">
          {/* Input Panel */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Source Code</span>
            </div>
            <textarea
              className="code-area"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Paste your Lua code here..."
              spellCheck={false}
            />
          </div>

          {/* Output Panel */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Obfuscated Output</span>
              <button 
                className="button button-secondary" 
                onClick={copyToClipboard}
                disabled={!outputCode}
              >
                Copy Output
              </button>
            </div>
            <textarea
              className="code-area"
              readOnly
              value={outputCode}
              placeholder="Obfuscated code will appear here..."
              spellCheck={false}
            />
          </div>
        </div>

        <div className="controls">
          <button 
            className="button obfuscate-btn" 
            onClick={handleObfuscate}
            disabled={isLoading || !inputCode.trim()}
          >
            {isLoading ? 'Obfuscating...' : 'Obfuscate Code'}
          </button>
        </div>
      </main>
    </>
  );
}

export default App;
