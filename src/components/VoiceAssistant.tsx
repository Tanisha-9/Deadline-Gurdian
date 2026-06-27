import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Send, Volume2, VolumeX, Sparkles, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { parseVoiceCommand } from '../api';

interface VoiceAssistantProps {
  onAddTaskFromVoice: (taskData: { title: string; dueDate: string; priority: 'low' | 'medium' | 'high' }) => Promise<any>;
}

export default function VoiceAssistant({ onAddTaskFromVoice }: VoiceAssistantProps) {
  const [command, setCommand] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechFeedback, setSpeechFeedback] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [speechSynthesisActive, setSpeechSynthesisActive] = useState(true);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
    }
  }, []);

  // Web Speech synthesis speak helper
  const speakText = (text: string) => {
    if (!speechSynthesisActive) return;
    try {
      window.speechSynthesis.cancel(); // cancel any active speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis failed:', err);
    }
  };

  // Toggle voice recognition
  const handleToggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setCommand('Listening...');
      setSpeechFeedback('');
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setCommand('');
      setSpeechFeedback('Failed to understand voice input. Try typing your command.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCommand(transcript);
      handleExecuteCommand(transcript);
    };

    recognition.start();
  };

  // Parse and execute command via Gemini
  const handleExecuteCommand = async (cmdText: string) => {
    if (!cmdText || cmdText === 'Listening...') return;

    setIsProcessing(true);
    setSpeechFeedback('AI is parsing your voice intention...');
    try {
      const result = await parseVoiceCommand(cmdText);
      setSpeechFeedback(result.spokenFeedback);
      speakText(result.spokenFeedback);

      // Execute intent actions
      if (result.intent === 'create_task' && result.extractedData) {
        const title = result.extractedData.taskTitle || 'Voice Scheduled Task';
        const rawDate = result.extractedData.dueDate || new Date().toISOString().split('T')[0];
        
        await onAddTaskFromVoice({
          title,
          dueDate: rawDate,
          priority: 'high'
        });
      }
    } catch (err) {
      console.error('Failed to process voice command:', err);
      setSpeechFeedback('Sorry, I failed to process that command. Try typing clearly.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || command === 'Listening...') return;
    handleExecuteCommand(command);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
          <h2 className="text-lg font-bold text-white font-sans">Voice Productivity Assistant</h2>
        </div>
        
        {/* Toggle synthesis speaking */}
        <button
          onClick={() => setSpeechSynthesisActive(!speechSynthesisActive)}
          className="p-1.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all flex items-center gap-1 text-[11px] font-mono"
        >
          {speechSynthesisActive ? (
            <>
              <Volume2 className="h-4 w-4 text-indigo-400" />
              <span>Voice Feedback ON</span>
            </>
          ) : (
            <>
              <VolumeX className="h-4 w-4" />
              <span>Feedback Muted</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* Floating mic icon with waves */}
        <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4">
          <div className="relative">
            {/* Animated voice wave rings */}
            {isListening && (
              <>
                <div className="absolute inset-0 bg-indigo-500/30 rounded-full animate-ping scale-150" />
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping scale-125" />
              </>
            )}
            
            <button
              onClick={handleToggleListening}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                isListening 
                  ? 'bg-rose-600 text-white border-4 border-rose-500/30 shadow-lg shadow-rose-950/40' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-4 border-indigo-500/30 shadow-lg shadow-indigo-950/40 hover:scale-105'
              }`}
            >
              {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </button>
          </div>

          <p className="text-xs font-mono text-slate-400 mt-4">
            {isListening ? 'Listening... Speak now!' : 'Click to Speak Command'}
          </p>
          
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">
            {voiceSupported ? 'Speech Recognition Ready' : 'Voice not supported, use keyboard'}
          </span>
        </div>

        {/* Text keyboard inputs or feedback panels */}
        <div className="md:col-span-8 space-y-4">
          
          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Hey, I have an interview next Monday"
              value={command}
              onChange={e => setCommand(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-all font-sans"
              disabled={isListening || isProcessing}
            />
            <button
              type="submit"
              disabled={isListening || isProcessing || !command.trim()}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-40"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </form>

          {/* Feedback section */}
          {speechFeedback && (
            <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2.5">
              <div className="flex gap-2 items-start">
                <Sparkles className="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Assistant spoken feedback</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{speechFeedback}</p>
                </div>
              </div>
            </div>
          )}

          {!speechFeedback && (
            <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl text-xs text-slate-500 font-sans leading-normal">
              💡 **Supported Voice Formulas:** <br />
              • *"Hey, I have an interview next Monday"* <br />
              • *"Set up a programming task for Flipkart competitive exam"* <br />
              • *"Plan a college assignment due Friday"* <br />
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
