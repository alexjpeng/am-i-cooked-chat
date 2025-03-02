import { useState, useEffect, useRef } from 'react';

interface AICommentaryProps {
  message: string;
  isVisible: boolean;
  onFinishTyping?: () => void;
}

export default function AICommentary({ message, isVisible, onFinishTyping }: AICommentaryProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messageRef = useRef(message);
  const typingSpeedRef = useRef(30); // ms per character
  
  // Reset and start typing animation when message changes
  useEffect(() => {
    if (message !== messageRef.current) {
      setDisplayedText('');
      messageRef.current = message;
      setIsTyping(true);
    }
  }, [message]);
  
  // Handle typing animation
  useEffect(() => {
    if (!isVisible || !isTyping || !message) return;
    
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex < message.length) {
        setDisplayedText(message.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
        if (onFinishTyping) onFinishTyping();
      }
    }, typingSpeedRef.current);
    
    return () => clearInterval(typingInterval);
  }, [isTyping, isVisible, message, onFinishTyping]);
  
  // Start typing when becoming visible
  useEffect(() => {
    if (isVisible && message && !isTyping && displayedText !== message) {
      setIsTyping(true);
    }
  }, [isVisible, message, isTyping, displayedText]);
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-md bg-black/80 backdrop-blur-md text-white p-4 rounded-xl shadow-xl border border-pink-500/30 animate-fadeIn">
      <div className="flex items-start space-x-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-xs font-bold">
          AI
        </div>
        <div>
          <div className="text-xs text-pink-400 font-medium mb-1">AI OPPONENT</div>
          <div className="text-sm font-medium">
            {displayedText}
            {isTyping && <span className="animate-pulse">▋</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// Add this to your global CSS or create a new CSS module
// .animate-fadeIn {
//   animation: fadeIn 0.3s ease-in-out;
// }
// @keyframes fadeIn {
//   from { opacity: 0; transform: translateY(10px); }
//   to { opacity: 1; transform: translateY(0); }
// } 