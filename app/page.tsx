"use client";

import { useState, useEffect, useCallback } from "react";
import { getConfig, runStagehand, startBBSSession } from "@/app/api/stagehand/run";
import { ConstructorParams } from "@browserbasehq/stagehand";
import DebuggerIframe from "@/components/stagehand/debuggerIframe";
import WikiFrame from "./components/WikiFrame";
import WikiAutocomplete from "./components/WikiAutocomplete";

// Define types for our game state
interface PlayerPath {
  url: string;
  title: string;
  timestamp: Date;
}

interface GameResult {
  winner: 'player' | 'ai';
  playerClicks: number;
  aiClicks: number;
  playerTime: number;
  aiTime: number;
  commentary: string;
  rating: 'cooked' | 'cracked' | 'mid';
}

interface GameStateType {
  status: 'not-started' | 'in-progress' | 'completed';
  startPage: string;
  targetPage: string;
  playerPath: PlayerPath[];
  aiPath: PlayerPath[];
  startTime: Date | null;
  endTime: Date | null;
  result: GameResult | null;
}

export default function Home() {
  // Game state
  const [gameState, setGameState] = useState<GameStateType>({
    status: 'not-started',
    startPage: '',
    targetPage: '',
    playerPath: [],
    aiPath: [],
    startTime: null,
    endTime: null,
    result: null
  });

  // Custom start/target inputs
  const [customStart, setCustomStart] = useState('');
  const [customTarget, setCustomTarget] = useState('');
  // Store the Wikipedia page IDs (for API use)
  const [customStartPage, setCustomStartPage] = useState('');
  const [customTargetPage, setCustomTargetPage] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Browserbase/Stagehand state
  const [config, setConfig] = useState<ConstructorParams | null>(null);
  const [running, setRunning] = useState(false);
  const [debugUrl, setDebugUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  

  const fetchConfig = useCallback(async () => {
    const config = await getConfig();
    setConfig(config);
    const warningToShow: string[] = [];
    if (!config.hasLLMCredentials) {
      warningToShow.push(
        "No LLM credentials found. Edit stagehand.config.ts to configure your LLM client."
      );
    }
    if (!config.hasBrowserbaseCredentials) {
      warningToShow.push(
        "No BROWSERBASE_API_KEY or BROWSERBASE_PROJECT_ID found. You will probably want this to run Stagehand in the cloud."
      );
    }
    setWarning(warningToShow.join("\n"));
  }, []);

  const endGame = useCallback((reason = 'completed') => {
    setRunning(false);
    
    if (reason === 'error') return;
    
    setGameState(prev => ({
      ...prev,
      status: 'completed',
      endTime: new Date(),
      result: {
        winner: Math.random() > 0.5 ? 'player' : 'ai', // For demo purposes
        playerClicks: prev.playerPath.length,
        aiClicks: prev.aiPath.length,
        playerTime: prev.startTime ? (new Date().getTime() - prev.startTime.getTime()) / 1000 : 0,
        aiTime: prev.startTime ? (new Date().getTime() - prev.startTime.getTime() - 2000) / 1000 : 0, // AI is slightly faster for demo
        commentary: generateCommentary(prev.playerPath.length),
        rating: prev.playerPath.length < 8 ? 'cracked' : prev.playerPath.length > 12 ? 'cooked' : 'mid'
      }
    }));
  }, []);

  const startGame = useCallback(async (start = '', target = '') => {
    if (!config) return;

    // Random Wikipedia page pairs
  const wikiPairs = [
    { start: "Pizza", target: "Albert_Einstein" },
    { start: "Taylor_Swift", target: "Quantum_mechanics" },
    { start: "Basketball", target: "Ancient_Rome" },
    { start: "Coffee", target: "Moon_landing" },
    { start: "TikTok", target: "Dinosaur" }
  ];

    // If no custom pages provided, pick a random pair
    if (!start || !target) {
      const randomPair = wikiPairs[Math.floor(Math.random() * wikiPairs.length)];
      start = randomPair.start;
      target = randomPair.target;
    }

    setGameState({
      status: 'in-progress',
      startPage: start,
      targetPage: target,
      playerPath: [],
      aiPath: [],
      startTime: new Date(),
      endTime: null,
      result: null
    });

    setRunning(true);

    try {
      if (config.env === "BROWSERBASE") {
        const { sessionId, debugUrl } = await startBBSSession();
        setDebugUrl(debugUrl);
        
        // Pass start and target pages to Stagehand
        await runStagehand(sessionId, {
          startPage: start,
          targetPage: target
        });
      } else {
        await runStagehand(undefined, {
          startPage: start,
          targetPage: target
        });
      }
    } catch (error) {
      setError((error as Error).message);
      endGame('error');
    }
  }, [config, endGame]);

  const generateCommentary = (clicks: number): string => {
    const roasts = [
      "you got cooked by gpt-4o-mini in 3 clicks. ngmi",
      "maybe you didn't get enough pretraining in the womb. cooked.",
    ];
    
    const praise = [
      "absolutely cracked. you might be safe from agi (for now)",
    ];
    
    return clicks < 8 ? praise[Math.floor(Math.random() * praise.length)] : 
           roasts[Math.floor(Math.random() * roasts.length)];
  };

  const handlePlayerNavigation = (url: string, title: string) => {
    // Track player navigation
    setGameState(prev => ({
      ...prev,
      playerPath: [...prev.playerPath, { url, title, timestamp: new Date() }]
    }));
  };

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  if (config === null) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-bounce text-2xl font-bold text-purple-600">Loading...</div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <div className="text-3xl font-extrabold">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
            WikiRace AI
          </span>
        </div>
        {gameState.status === 'in-progress' && (
          <div className="bg-black/30 p-2 rounded-lg text-xl">
            <span className="font-mono">Target: {gameState.targetPage.replace(/_/g, ' ')}</span>
          </div>
        )}
        {/* GitHub star and Slack join buttons */}
        <div className="flex items-center gap-3">
          <a 
            href="https://github.com/browserbase/stagehand" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-black/30 hover:bg-black/50 px-3 py-1.5 rounded-lg text-sm transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            Star on GitHub
          </a>
          <a 
            href="https://join.slack.com/t/browserbase/shared_invite/zt-25njy7r1y-j~upVRuRvit1qg04~nyXuw" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 bg-[#4A154B]/80 hover:bg-[#4A154B] px-3 py-1.5 rounded-lg text-sm transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M3.362 10.11c0 .926-.756 1.681-1.681 1.681S0 11.036 0 10.111C0 9.186.756 8.43 1.68 8.43h1.682v1.68zm.846 0c0-.924.756-1.68 1.681-1.68s1.681.756 1.681 1.68v4.21c0 .924-.756 1.68-1.68 1.68a1.685 1.685 0 0 1-1.682-1.68v-4.21zM5.89 3.362c-.926 0-1.682-.756-1.682-1.681S4.964 0 5.89 0s1.68.756 1.68 1.68v1.682H5.89zm0 .846c.924 0 1.68.756 1.68 1.681S6.814 7.57 5.89 7.57H1.68C.757 7.57 0 6.814 0 5.89c0-.926.756-1.682 1.68-1.682h4.21zm6.749 1.682c0-.926.755-1.682 1.68-1.682.925 0 1.681.756 1.681 1.681s-.756 1.681-1.68 1.681h-1.681V5.89zm-.848 0c0 .924-.755 1.68-1.68 1.68A1.685 1.685 0 0 1 8.43 5.89V1.68C8.43.757 9.186 0 10.11 0c.926 0 1.681.756 1.681 1.68v4.21zm-1.681 6.748c.926 0 1.682.756 1.682 1.681S11.036 16 10.11 16s-1.681-.756-1.681-1.68v-1.682h1.68zm0-.847c-.924 0-1.68-.755-1.68-1.68 0-.925.756-1.681 1.68-1.681h4.21c.924 0 1.68.756 1.68 1.68 0 .926-.756 1.681-1.68 1.681h-4.21z"/>
            </svg>
            Join our Slack
          </a>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {/* Game not started */}
        {gameState.status === 'not-started' && (
          <div className="max-w-md mx-auto bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-xl">
            <h1 className="text-4xl font-black mb-6 text-center">Race Against AI</h1>
            <p className="mb-6 text-lg">
              Navigate from one Wikipedia page to another using only hyperlinks. The AI will race you and judge your performance!
            </p>
            
            <div className="space-y-4">
              {showCustom ? (
                <>
                  <div className="space-y-4 z-10">
                    <WikiAutocomplete
                      value={customStart}
                      onChange={setCustomStart}
                      onSelect={(pageName) => {
                        setCustomStartPage(pageName);
                        setCustomStart(pageName.replace(/_/g, ' '));
                      }}
                      placeholder="Type to search for a start page..."
                      label="Start Page"
                    />
                    
                    <WikiAutocomplete
                      value={customTarget}
                      onChange={setCustomTarget}
                      onSelect={(pageName) => {
                        setCustomTargetPage(pageName);
                        setCustomTarget(pageName.replace(/_/g, ' '));
                      }}
                      placeholder="Type to search for a target page..."
                      label="Target Page"
                    />
                  </div>
                  
                  <div className="flex space-x-2 mt-6">
                    <button
                      onClick={() => startGame(customStartPage || customStart.replace(/ /g, '_'), customTargetPage || customTarget.replace(/ /g, '_'))}
                      disabled={!customStart || !customTarget}
                      className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 py-3 px-6 rounded-lg font-bold text-white shadow-lg hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50"
                    >
                      Start Custom Race
                    </button>
                    <button
                      onClick={() => setShowCustom(false)}
                      className="bg-white/20 py-3 px-4 rounded-lg font-medium hover:bg-white/30 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startGame()}
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 py-4 px-6 rounded-lg font-bold text-xl text-white shadow-lg hover:from-pink-600 hover:to-purple-700 transition-all"
                  >
                    🔥 Start Random Race
                  </button>
                  <button
                    onClick={() => setShowCustom(true)}
                    className="w-full bg-white/20 py-3 px-6 rounded-lg font-medium hover:bg-white/30 transition-all"
                  >
                    Customize Pages
                  </button>
                </>
              )}
            </div>
            
            {error && (
              <div className="mt-4 bg-red-500/70 text-white rounded-md p-3">
                Error: {error}
              </div>
            )}
            {warning && (
              <div className="mt-4 bg-yellow-500/70 text-black rounded-md p-3 text-sm">
                <strong>Warning:</strong> {warning}
              </div>
            )}
          </div>
        )}

        {/* Game in progress */}
        {gameState.status === 'in-progress' && (
          <div className="flex flex-col lg:flex-row gap-4 h-[80vh]">
            {/* Player's Wikipedia frame */}
            <div className="flex-1 bg-white rounded-xl overflow-hidden shadow-xl flex flex-col">
              <div className="bg-gray-800 p-2 text-sm font-medium flex justify-between items-center">
                <span>Your Wikipedia</span>
                <span className="bg-purple-600 px-2 py-1 rounded text-xs">
                  Clicks: {gameState.playerPath.length}
                </span>
              </div>
              
              {/* Use our custom WikiFrame component instead of iframe */}
              <WikiFrame 
                startPage={gameState.startPage}
                targetPage={gameState.targetPage}
                onNavigation={handlePlayerNavigation}
                onTargetReached={() => endGame()}
              />
            </div>
            
            {/* AI's Browserbase viewport */}
            <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-xl flex flex-col">
              <div className="bg-gray-800 p-2 text-sm font-medium flex justify-between items-center">
                <span>AI Opponent</span>
                <span className="bg-pink-600 px-2 py-1 rounded text-xs">
                  Thinking...
                </span>
              </div>
              {running && <DebuggerIframe debugUrl={debugUrl} env={config.env} />}
            </div>
          </div>
        )}

        {/* Game completed */}
        {gameState.status === 'completed' && gameState.result && (
          <div className="max-w-lg mx-auto bg-white/10 backdrop-blur-md p-8 rounded-xl shadow-xl">
            <h1 className="text-4xl font-black mb-6 text-center">
              {gameState.result.winner === 'player' ? '🏆 You Won!' : '😭 AI Won!'}
            </h1>
            
            <div className="flex justify-between mb-6">
              <div className="text-center">
                <div className="text-sm opacity-70">Your Clicks</div>
                <div className="text-3xl font-bold">{gameState.result.playerClicks}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-70">Your Time</div>
                <div className="text-3xl font-bold">{gameState.result.playerTime.toFixed(1)}s</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-70">AI Time</div>
                <div className="text-3xl font-bold">{gameState.result.aiTime.toFixed(1)}s</div>
              </div>
            </div>
            
            <div className="bg-black/30 p-4 rounded-lg mb-6">
              <div className="text-sm mb-2 font-medium">
                {gameState.result.rating === 'cracked' ? '✨ YOU&apos;RE CRACKED' : 
                 gameState.result.rating === 'cooked' ? '💀 YOU GOT COOKED' : '😐 MID PERFORMANCE'}
              </div>
              <div className="text-xl italic">{gameState.result.commentary}</div>
            </div>
            
            {/* Stagehand CTAs */}
            <div className="mb-6 p-4 bg-white/10 rounded-lg">
              <p className="text-sm mb-3">
                Enjoyed this demo? Support the Stagehand project:
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a 
                  href="https://github.com/browserbase/stagehand" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 flex justify-center items-center gap-2 bg-black/30 hover:bg-black/50 py-2 px-4 rounded-lg transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  Star on GitHub
                </a>
                <a 
                  href="https://join.slack.com/t/browserbase/shared_invite/zt-25njy7r1y-j~upVRuRvit1qg04~nyXuw" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 flex justify-center items-center gap-2 bg-[#4A154B]/80 hover:bg-[#4A154B] py-2 px-4 rounded-lg transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M3.362 10.11c0 .926-.756 1.681-1.681 1.681S0 11.036 0 10.111C0 9.186.756 8.43 1.68 8.43h1.682v1.68zm.846 0c0-.924.756-1.68 1.681-1.68s1.681.756 1.681 1.68v4.21c0 .924-.756 1.68-1.68 1.68a1.685 1.685 0 0 1-1.682-1.68v-4.21zM5.89 3.362c-.926 0-1.682-.756-1.682-1.681S4.964 0 5.89 0s1.68.756 1.68 1.68v1.682H5.89zm0 .846c.924 0 1.68.756 1.68 1.681S6.814 7.57 5.89 7.57H1.68C.757 7.57 0 6.814 0 5.89c0-.926.756-1.682 1.68-1.682h4.21zm6.749 1.682c0-.926.755-1.682 1.68-1.682.925 0 1.681.756 1.681 1.681s-.756 1.681-1.68 1.681h-1.681V5.89zm-.848 0c0 .924-.755 1.68-1.68 1.68A1.685 1.685 0 0 1 8.43 5.89V1.68C8.43.757 9.186 0 10.11 0c.926 0 1.681.756 1.681 1.68v4.21zm-1.681 6.748c.926 0 1.682.756 1.682 1.681S11.036 16 10.11 16s-1.681-.756-1.681-1.68v-1.682h1.68zm0-.847c-.924 0-1.68-.755-1.68-1.68 0-.925.756-1.681 1.68-1.681h4.21c.924 0 1.68.756 1.68 1.68 0 .926-.756 1.681-1.68 1.681h-4.21z"/>
                  </svg>
                  Join our Slack
                </a>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => startGame()}
                className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 py-3 px-6 rounded-lg font-bold text-white shadow-lg hover:from-pink-600 hover:to-purple-700 transition-all"
              >
                Play Again
              </button>
              <button
                onClick={() => {
                  // Share functionality (simplified)
                  alert('Sharing functionality would go here!');
                }}
                className="bg-white/20 py-3 px-4 rounded-lg font-medium hover:bg-white/30 transition-all"
              >
                Share
              </button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="p-4 text-center text-sm opacity-7 z-5">
        <div className="flex flex-col items-center gap-3">
          <p>Built with <a href="https://stagehand.dev" target="_blank" rel="noopener noreferrer" className="underline">Stagehand</a> & <a href="https://browserbase.com" target="_blank" rel="noopener noreferrer" className="underline">Browserbase</a> | A fun demo of AI-powered web automation</p>
          
          <div className="flex items-center gap-4 mt-1">
            <a 
              href="https://github.com/browserbase/stagehand" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-white/90 hover:text-white transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              Star on GitHub
            </a>
            <a 
              href="https://join.slack.com/t/browserbase/shared_invite/zt-25njy7r1y-j~upVRuRvit1qg04~nyXuw" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-white/90 hover:text-white transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M3.362 10.11c0 .926-.756 1.681-1.681 1.681S0 11.036 0 10.111C0 9.186.756 8.43 1.68 8.43h1.682v1.68zm.846 0c0-.924.756-1.68 1.681-1.68s1.681.756 1.681 1.68v4.21c0 .924-.756 1.68-1.68 1.68a1.685 1.685 0 0 1-1.682-1.68v-4.21zM5.89 3.362c-.926 0-1.682-.756-1.682-1.681S4.964 0 5.89 0s1.68.756 1.68 1.68v1.682H5.89zm0 .846c.924 0 1.68.756 1.68 1.681S6.814 7.57 5.89 7.57H1.68C.757 7.57 0 6.814 0 5.89c0-.926.756-1.682 1.68-1.682h4.21zm6.749 1.682c0-.926.755-1.682 1.68-1.682.925 0 1.681.756 1.681 1.681s-.756 1.681-1.68 1.681h-1.681V5.89zm-.848 0c0 .924-.755 1.68-1.68 1.68A1.685 1.685 0 0 1 8.43 5.89V1.68C8.43.757 9.186 0 10.11 0c.926 0 1.681.756 1.681 1.68v4.21zm-1.681 6.748c.926 0 1.682.756 1.682 1.681S11.036 16 10.11 16s-1.681-.756-1.681-1.68v-1.682h1.68zm0-.847c-.924 0-1.68-.755-1.68-1.68 0-.925.756-1.681 1.68-1.681h4.21c.924 0 1.68.756 1.68 1.68 0 .926-.756 1.681-1.68 1.681h-4.21z"/>
              </svg>
              Join Slack Community
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
