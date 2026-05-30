import React, { useEffect, useRef, useState } from 'react';
import { Message } from '../types';
import { Terminal as TerminalIcon, Mic, Send, Paperclip, MicOff, AlertCircle } from 'lucide-react';

interface TerminalProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  onFileUpload: (file: File) => void;
  isProcessing: boolean;
}

const Terminal: React.FC<TerminalProps> = ({ messages, onSendMessage, onFileUpload, isProcessing }) => {
  const [input, setInput] = React.useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        onSendMessage(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [onSendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.error("Mic Error", e);
        }
      } else {
        alert("Audio sensors offline.");
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/80 backdrop-blur-xl border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)] cyber-panel overflow-hidden">
      {/* Cyber Header */}
      <div className="flex items-center px-4 py-3 bg-gradient-to-r from-cyan-950/50 to-transparent border-b border-cyan-500/30 justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400 font-hud text-xs tracking-[0.2em] uppercase">Secure_Link_V2</span>
        </div>
        {isListening ? (
           <span className="flex items-center gap-2 text-red-500 text-xs animate-pulse font-mono-tech border border-red-500/50 px-2 py-0.5 rounded bg-red-950/30">
             <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
             REC_ACTIVE
           </span>
        ) : (
          <span className="text-[10px] text-cyan-700 font-mono-tech">ENCRYPTED</span>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-[fadeIn_0.3s_ease-out]`}>
            <div className={`max-w-[85%] px-4 py-3 relative group ${
              msg.role === 'user' 
                ? 'bg-cyan-900/20 text-cyan-100 border-r-2 border-cyan-500 cyber-panel-reverse' 
                : 'bg-black/40 text-cyan-300 border-l-2 border-cyan-500 cyber-panel'
            }`}>
              <p className="text-sm font-mono-tech leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              {/* Decorative corner accent */}
              <div className={`absolute w-2 h-2 ${msg.role === 'user' ? 'bottom-0 right-0 border-b border-r border-cyan-400' : 'top-0 left-0 border-t border-l border-cyan-400'} opacity-50`}></div>
            </div>
            <span className="text-[9px] text-cyan-600 mt-1 uppercase tracking-wider font-mono-tech">
              {msg.role === 'user' ? 'CMD_INPUT' : 'AI_RESPONSE'} :: {msg.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center space-x-2 text-cyan-500 px-2">
            <span className="w-1 h-4 bg-cyan-500 animate-pulse"></span>
            <span className="text-xs font-hud tracking-widest animate-pulse">PROCESSING DATA STREAM...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-cyan-500/30 bg-black/60 flex items-center gap-2 relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-cyan-600 hover:text-cyan-300 transition-colors border border-transparent hover:border-cyan-500/30 rounded"
        >
          <Paperclip size={18} />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={handleFileChange}
        />
        
        <button
          type="button"
          onClick={toggleListening}
          className={`p-2 transition-all border rounded ${isListening ? 'text-red-500 border-red-500/50 bg-red-950/20 animate-pulse' : 'text-cyan-600 border-transparent hover:text-cyan-300 hover:border-cyan-500/30'}`}
        >
          {isListening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isListening ? "AWAITING VOICE INPUT..." : "ENTER COMMAND SEQUENCE..."}
          className="flex-1 bg-transparent border-b border-cyan-900 focus:border-cyan-400 outline-none text-cyan-300 font-mono-tech text-sm placeholder-cyan-800/50 py-1 transition-colors"
        />
        
        <button 
          type="submit" 
          disabled={!input.trim()}
          className="p-2 text-cyan-500 hover:text-white disabled:opacity-30 transition-colors"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default Terminal;