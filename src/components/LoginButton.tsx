import React, { useState } from 'react';

interface LoginButtonProps {
  onLogin?: (username: string) => void;
}

const LoginButton: React.FC<LoginButtonProps> = ({ onLogin }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('CREDENTIALS REQUIRED');
      return;
    }
    onLogin?.(username);
    setIsOpen(false);
    setUsername('');
    setPassword('');
    setError('');
  };

  const handleClose = () => {
    setIsOpen(false);
    setUsername('');
    setPassword('');
    setError('');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="z-10 group relative px-6 py-3 bg-transparent border border-holo-blue text-holo-blue font-display font-bold tracking-[0.3em] text-sm hover:bg-holo-blue/10 transition-all duration-300 cursor-pointer"
        data-testid="login-button"
      >
        <div className="absolute inset-0 w-full h-full border border-holo-blue blur-[2px] opacity-50 group-hover:opacity-100 transition-opacity"></div>
        LOGIN
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          data-testid="login-modal"
        >
          <div className="relative bg-black border border-holo-cyan shadow-[0_0_40px_rgba(0,240,255,0.3)] p-8 w-96">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-holo-cyan"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-holo-cyan"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-holo-cyan"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-holo-cyan"></div>

            <h2 className="font-display font-bold text-xl text-holo-cyan tracking-[0.3em] mb-1">
              AUTHENTICATION
            </h2>
            <div className="h-px bg-holo-cyan/30 mb-6"></div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-400 block mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-transparent border border-holo-cyan/40 text-holo-cyan font-mono px-3 py-2 text-sm focus:outline-none focus:border-holo-cyan transition-all"
                  placeholder="ENTER ID"
                  data-testid="username-input"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-400 block mb-1">
                  Access Code
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-transparent border border-holo-cyan/40 text-holo-cyan font-mono px-3 py-2 text-sm focus:outline-none focus:border-holo-cyan transition-all"
                  placeholder="••••••••"
                  data-testid="password-input"
                />
              </div>

              {error && (
                <div className="text-alert-red text-xs font-mono tracking-widest" data-testid="error-message">
                  ⚠ {error}
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-holo-cyan/10 border border-holo-cyan text-holo-cyan font-display font-bold tracking-[0.2em] text-sm hover:bg-holo-cyan/20 transition-all"
                  data-testid="submit-button"
                >
                  ACCESS
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2 bg-transparent border border-gray-600 text-gray-400 font-display font-bold tracking-[0.2em] text-sm hover:border-gray-400 hover:text-gray-200 transition-all"
                  data-testid="cancel-button"
                >
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default LoginButton;
