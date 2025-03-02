"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getConfig, runStagehand, startBBSSession } from "@/app/api/stagehand/run";
import { ConstructorParams } from "@browserbasehq/stagehand";
import DebuggerIframe from "@/components/stagehand/debuggerIframe";
import WikiFrame from "./components/WikiFrame";
import WikiAutocomplete from "./components/WikiAutocomplete";
import AICommentary from './components/AICommentary';

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

  // Loading state for end-game commentary
  const [isCommentaryLoading, setIsCommentaryLoading] = useState(false);

  // AI commentary state
  const [aiCommentary, setAiCommentary] = useState('');
  const [showCommentary, setShowCommentary] = useState(false);
  const commentaryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // AI state indicators
  const [aiStatus, setAiStatus] = useState<'idle' | 'thinking' | 'navigating'>('idle');

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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lastKnownUrl, setLastKnownUrl] = useState<string | null>(null);

  

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

  const endGame = useCallback(async (reason = 'completed') => {
    setRunning(false);
    setLastKnownUrl(null);
    
    if (reason === 'error') return;
    
    setGameState(prev => {
      // Determine the winner based on who reached the target first
      // If the player called endGame, they won. If the AI path contains the target, AI won.
      const aiReachedTarget = prev.aiPath.some(
        step => step.title.replace(/ /g, '_') === prev.targetPage || 
               step.url.includes(`/wiki/${prev.targetPage}`)
      );
      
      const playerReachedTarget = prev.playerPath.some(
        step => step.title.replace(/ /g, '_') === prev.targetPage
      );
      
      // Determine the winner
      let winner: 'player' | 'ai' = 'player';
      
      if (reason === 'ai-won') {
        winner = 'ai';
      } else if (aiReachedTarget && !playerReachedTarget) {
        winner = 'ai';
      } else if (playerReachedTarget && !aiReachedTarget) {
        winner = 'player';
      } else if (aiReachedTarget && playerReachedTarget) {
        // Both reached the target, compare path lengths
        winner = prev.playerPath.length <= prev.aiPath.length ? 'player' : 'ai';
      }
      
      const playerTime = prev.startTime ? (new Date().getTime() - prev.startTime.getTime()) / 1000 : 0;
      const aiTime = prev.aiPath.length > 0 
        ? (prev.aiPath[prev.aiPath.length - 1].timestamp.getTime() - prev.startTime!.getTime()) / 1000 
        : playerTime;
      
      // Create a temporary result with placeholder commentary
      const tempResult: GameResult = {
        winner,
        playerClicks: prev.playerPath.length,
        aiClicks: prev.aiPath.length,
        playerTime,
        aiTime,
        commentary: "generating commentary...",
        rating: 'mid' // Will be updated with AI response
      };
      
      // Generate AI commentary asynchronously
      generateEndGameCommentary(
        winner,
        prev.playerPath.length,
        prev.aiPath.length,
        playerTime,
        aiTime,
        prev.playerPath.map(p => p.title),
        prev.aiPath.map(p => p.title),
        prev.targetPage
      );
      
      return {
        ...prev,
        status: 'completed',
        endTime: new Date(),
        result: tempResult
      };
    });
  }, []);

  // Function to generate end-game commentary
  const generateEndGameCommentary = async (
    winner: 'player' | 'ai',
    playerClicks: number,
    aiClicks: number,
    playerTime: number,
    aiTime: number,
    playerPath: string[],
    aiPath: string[],
    targetPage: string
  ) => {
    setIsCommentaryLoading(true);
    
    try {
      const response = await fetch('/api/endgame-commentary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          winner,
          playerClicks,
          aiClicks,
          playerTime,
          aiTime,
          playerPath,
          aiPath,
          targetPage
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate end-game commentary');
      }

      const data = await response.json();
      
      // Update the game result with AI-generated commentary
      setGameState(prev => {
        if (prev.result) {
          return {
            ...prev,
            result: {
              ...prev.result,
              commentary: data.commentary,
              rating: data.rating
            }
          };
        }
        return prev;
      });
      
    } catch (error) {
      console.error('Error generating end-game commentary:', error);
      // Use fallback commentary if API call fails
      setGameState(prev => {
        if (prev.result) {
          return {
            ...prev,
            result: {
              ...prev.result,
              commentary: winner === 'player' 
                ? "you beat the ai! not bad for a human 👏" 
                : "better luck next time 😂 ai wins again",
              rating: winner === 'player' ? 'cracked' : 'cooked'
            }
          };
        }
        return prev;
      });
    } finally {
      setIsCommentaryLoading(false);
    }
  };

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
    setAiStatus('thinking');

    try {
      if (config.env === "BROWSERBASE") {
        const { sessionId, debugUrl } = await startBBSSession();
        setDebugUrl(debugUrl);
        setSessionId(sessionId);
        
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

  // Helper function to extract a readable title from a Wikipedia URL
  const extractTitleFromUrl = (url: string): string => {
    try {
      // Extract the path after /wiki/
      const pathMatch = url.match(/\/wiki\/([^#?]*)/);
      if (pathMatch && pathMatch[1]) {
        // Replace underscores with spaces and decode URI components
        return decodeURIComponent(pathMatch[1].replace(/_/g, ' '));
      }
      return 'Unknown Page';
    } catch (error) {
      console.error('Error extracting title from URL:', error);
      return 'Unknown Page';
    }
  };

  const handlePlayerNavigation = async (url: string, title: string) => {
    // Track player navigation
    setGameState(prev => {
      // Check if this URL already exists in the path to avoid duplicates
      const urlExists = prev.playerPath.some(item => item.url === url);
      if (urlExists) {
        return prev;
      }
      
      // Add the new navigation to the path
      const updatedPath = [...prev.playerPath, { url, title, timestamp: new Date() }];
      
      // Generate AI commentary if we have at least 2 pages in the path
      if (updatedPath.length >= 2 && prev.status === 'in-progress') {
        generateAICommentary(title, prev.targetPage, updatedPath.map(p => p.title));
      }
      
      return {
        ...prev,
        playerPath: updatedPath
      };
    });
  };

  // Function to generate AI commentary
  const generateAICommentary = async (currentPage: string, targetPage: string, pathTitles: string[]) => {
    try {
      const response = await fetch('/api/commentary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPage,
          targetPage,
          previousPages: pathTitles,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate commentary');
      }

      const data = await response.json();
      
      // Clear any existing timeout
      if (commentaryTimeoutRef.current) {
        clearTimeout(commentaryTimeoutRef.current);
      }
      
      // Hide any existing commentary first
      setShowCommentary(false);
      
      // Short delay before showing new commentary
      setTimeout(() => {
        setAiCommentary(data.commentary);
        setShowCommentary(true);
        
        // Auto-hide commentary after 8 seconds
        commentaryTimeoutRef.current = setTimeout(() => {
          setShowCommentary(false);
        }, 8000);
      }, 300);
      
    } catch (error) {
      console.error('Error generating AI commentary:', error);
    }
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (commentaryTimeoutRef.current) {
        clearTimeout(commentaryTimeoutRef.current);
      }
    };
  }, []);

  // Track AI navigation in real-time
  useEffect(() => {
    if (gameState.status === 'in-progress' && running && sessionId) {
      // Set initial AI status
      setAiStatus('thinking');
      
      // Function to fetch session data from our API endpoint
      const fetchSessionData = async () => {
        try {
          const response = await fetch(`/api/browserbase?sessionId=${sessionId}`);
          
          if (!response.ok) {
            console.error('Failed to fetch session data:', response.statusText);
            return;
          }
          
          const data = await response.json();
          
          // Get the current page from the pages array (usually the last one)
          if (data.pages && data.pages.length > 0) {
            const currentPage = data.pages[data.pages.length - 1];
            
            // Check if this is a new URL we haven't seen before
            if (currentPage.url !== lastKnownUrl) {
              // Update the last known URL
              setLastKnownUrl(currentPage.url);
              
              // Only add to path if it's a Wikipedia page
              if (currentPage.url.includes('wikipedia.org/wiki/')) {
                // Extract the page title from the URL or title
                let pageTitle = currentPage.title.replace(' - Wikipedia', '');
                
                // If the title is empty or not available, extract it from the URL
                if (!pageTitle || pageTitle === '') {
                  pageTitle = extractTitleFromUrl(currentPage.url);
                }
                
                // Toggle AI status to navigating
                setAiStatus('navigating');
                
                // Add the page to the AI path
                setGameState(prev => {
                  // Check if we already have this URL in the path to avoid duplicates
                  const urlExists = prev.aiPath.some(item => item.url === currentPage.url);
                  
                  if (!urlExists) {
                    const newPath = [
                      ...prev.aiPath,
                      {
                        url: currentPage.url,
                        title: pageTitle,
                        timestamp: new Date()
                      }
                    ];
                    
                    // Check if the AI has reached the target
                    const normalizedTargetPage = prev.targetPage;
                    const currentPagePath = currentPage.url.split('/wiki/')[1];
                    
                    // Check if the current page matches the target (either by exact match or by title)
                    const isTargetReached = 
                      currentPagePath === normalizedTargetPage || 
                      pageTitle.replace(/ /g, '_') === normalizedTargetPage ||
                      currentPagePath && normalizedTargetPage && 
                      currentPagePath.toLowerCase() === normalizedTargetPage.toLowerCase();
                    
                    if (isTargetReached) {
                      // Check if player already won
                      const playerReachedTarget = prev.playerPath.some(
                        step => step.title.replace(/ /g, '_') === normalizedTargetPage
                      );
                      
                      if (!playerReachedTarget) {
                        // End the game with AI as winner after a brief delay
                        setTimeout(() => endGame('ai-won'), 1000);
                      }
                    }
                    
                    return {
                      ...prev,
                      aiPath: newPath
                    };
                  }
                  
                  return prev;
                });
                
                // Set status back to thinking after a short delay
                setTimeout(() => {
                  setAiStatus('thinking');
                }, 1500);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching session data:', error);
        }
      };
      
      // Poll for session data every 2 seconds
      const pollInterval = setInterval(fetchSessionData, 2000);
      
      // Initial fetch
      fetchSessionData();
      
      // Cleanup
      return () => {
        clearInterval(pollInterval);
        setAiStatus('idle');
      };
    }
  }, [gameState.status, running, sessionId, lastKnownUrl, endGame]);

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
            <h1 className="text-4xl font-black mb-6 text-center "><span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">am I cooked chat?</span></h1>
            <p className="mb-6 text-lg">
              is your world model better than gpt-4o-mini&apos;s? try to beat the AI to the target wikipedia page by clicking on the links. if you can&apos;t, you might be cooked.
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
          <div className="flex flex-col lg:flex-row gap-4 h-[60vh]">
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
                <span className={`px-2 py-1 rounded text-xs flex items-center ${
                  aiStatus === 'thinking' ? 'bg-yellow-600' : 
                  aiStatus === 'navigating' ? 'bg-pink-600' : 'bg-gray-600'
                }`}>
                  {aiStatus === 'thinking' && (
                    <>
                      <span className="mr-1">Thinking</span>
                      <span className="flex space-x-1">
                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></span>
                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></span>
                      </span>
                    </>
                  )}
                  {aiStatus === 'navigating' && (
                    <>
                      <span className="mr-1">Navigating</span>
                      <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </>
                  )}
                  {aiStatus === 'idle' && 'Not Started'}
                </span>
              </div>
              {running && <DebuggerIframe debugUrl={debugUrl + '&navbar=false'} env={config.env} />}
            </div>
          </div>
        )}

        {/* Path History Displays */}
        {gameState.status === 'in-progress' && (
          <div className="flex flex-col lg:flex-row gap-4 mt-4">
            {/* Player's Path History */}
            <div className="flex-1 bg-white/10 backdrop-blur-md rounded-xl p-4 shadow-xl">
              <h3 className="text-lg font-bold mb-2">Your Path</h3>
              {gameState.playerPath.length === 0 ? (
                <div className="text-white/60 italic">Start your journey by clicking links in the Wikipedia page</div>
              ) : (
                <div className="flex flex-col space-y-2">
                  {gameState.playerPath.map((step, index) => {
                    const isLatest = index === gameState.playerPath.length - 1;
                    const isTarget = step.title.replace(/ /g, '_') === gameState.targetPage;
                    
                    return (
                      <div 
                        key={index} 
                        className={`flex items-center p-2 rounded-lg transition-all ${
                          isLatest ? 'bg-purple-900/50 shadow-lg' : ''
                        } ${isTarget ? 'bg-green-700/50 border border-green-400' : ''}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 ${
                          isTarget ? 'bg-green-500' : 'bg-purple-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className={`font-medium ${isLatest ? 'text-white' : 'text-white/90'}`}>
                          {step.title}
                          {isTarget && <span className="ml-2 text-green-300 text-xs font-bold">TARGET REACHED!</span>}
                        </div>
                        <div className="ml-auto text-xs text-white/50">
                          {step.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* AI's Path History */}
            <div className="flex-1 bg-black/30 backdrop-blur-md rounded-xl p-4 shadow-xl">
              <h3 className="text-lg font-bold mb-2">AI Path</h3>
              {gameState.aiPath.length === 0 ? (
                <div className="text-white/60 italic">
                  {sessionId ? (
                    <div className="flex items-center">
                      <span>Connecting to AI agent</span>
                      <span className="flex space-x-1 ml-2">
                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></span>
                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></span>
                      </span>
                    </div>
                  ) : (
                    'AI is thinking...'
                  )}
                </div>
              ) : (
                <div className="flex flex-col space-y-2">
                  {gameState.aiPath.map((step, index) => {
                    const isLatest = index === gameState.aiPath.length - 1;
                    const isTarget = step.title.replace(/ /g, '_') === gameState.targetPage;
                    
                    return (
                      <div 
                        key={index} 
                        className={`flex items-center p-2 rounded-lg transition-all ${
                          isLatest ? 'bg-pink-900/50 shadow-lg' : ''
                        } ${isTarget ? 'bg-green-700/50 border border-green-400' : ''}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 ${
                          isTarget ? 'bg-green-500' : 'bg-pink-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div className={`font-medium ${isLatest ? 'text-white' : 'text-white/90'}`}>
                          {step.title}
                          {isTarget && <span className="ml-2 text-green-300 text-xs font-bold">TARGET REACHED!</span>}
                        </div>
                        <div className="ml-auto text-xs text-white/50">
                          {step.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Commentary */}
        <AICommentary 
          message={aiCommentary} 
          isVisible={showCommentary} 
          onFinishTyping={() => {
            // Optional: Do something when typing animation finishes
          }}
        />

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
              <div className="text-xl italic">
                {isCommentaryLoading ? (
                  <div className="flex items-center space-x-2">
                    <span>AI is judging your performance</span>
                    <span className="flex space-x-1">
                      <span className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></span>
                      <span className="w-1 h-1 bg-white rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></span>
                    </span>
                  </div>
                ) : (
                  gameState.result.commentary
                )}
              </div>
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
          <p>Built with  <a href="https://stagehand.dev" target="_blank" rel="noopener noreferrer" className="underline">Stagehand</a> & <a href="https://browserbase.com" target="_blank" rel="noopener noreferrer" className="underline">Browserbase</a></p>
          
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
