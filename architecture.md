# WikiRace AI: Architecture Document

## Overview

WikiRace AI is a fun, irreverent web application where users race against a Browserbase-powered AI to navigate from one Wikipedia page to another using only hyperlinks. The game features a split-screen interface with real-time AI competition and sassy commentary on the player's performance.

## Core Concepts

- **Race**: A timed challenge to navigate from a start Wikipedia page to a target Wikipedia page using only hyperlinks.
- **AI Opponent**: A Browserbase-powered virtual competitor that navigates the same challenge in real-time.
- **Evaluation**: Analysis of the player's path choices with Gen-Z style commentary.
- **Roast**: Humorous, irreverent commentary on whether the player is "cooked" (poor performance) or "cracked" (excellent performance).

## Simplified System Architecture

### Frontend (Single Page Application)

- **Framework**: Next.js with React (using existing Stagehand quickstart)
- **State Management**: React useState/useContext for ephemeral session state
- **Styling**: Tailwind CSS with vibrant, Gen-Z inspired design elements
- **Layout**: Split-screen with Browserbase viewport and player's Wikipedia frame

### Browserbase Integration

- **Stagehand**: Leveraging Stagehand's `act`, `extract`, and `observe` methods
- **Session Management**: Using the existing Browserbase session infrastructure
- **Real-time Visualization**: Showing the AI opponent's navigation in real-time

## Key Components

### Game Interface
```typescript
interface GameState {
  startPage: string;
  targetPage: string;
  playerPath: {
    url: string;
    title: string;
    timestamp: Date;
  }[];
  aiPath: {
    url: string;
    title: string;
    timestamp: Date;
  }[];
  startTime: Date;
  endTime?: Date;
  status: 'not-started' | 'in-progress' | 'completed';
  result?: {
    winner: 'player' | 'ai';
    playerClicks: number;
    aiClicks: number;
    playerTime: number;
    aiTime: number;
    commentary: string;
    rating: 'cooked' | 'cracked' | 'mid';
  };
}
```

## Key Features

### Game Setup
1. Simple interface to start a new race
2. Random selection of start and target Wikipedia pages
3. Option for custom start/target pages

### Gameplay
1. Split-screen view with:
   - Left: Player's Wikipedia navigation frame
   - Right: Browserbase viewport showing AI opponent
2. Real-time tracking of player's path and time
3. Visual indication of AI opponent's progress

### AI Implementation
1. Stagehand-powered navigation using `act`, `extract`, and `observe`
2. Wikipedia navigation using semantic understanding of page content
3. Strategic path finding based on topic relevance

### Results & Commentary
1. Gen-Z style commentary on player performance
2. "Cooked" vs. "Cracked" rating with emoji-rich feedback
3. Option to share results with friends

## Technical Implementation

### Wikipedia Integration
- iFrame-based Wikipedia embedding with custom navigation wrapper
- Event listeners to track player navigation
- CSS modifications to maintain Wikipedia functionality while tracking progress

### Stagehand Implementation
```typescript
// Example Stagehand implementation
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config";
import { z } from "zod";

export async function runWikiRace(startPage: string, targetPage: string) {
  const stagehand = new Stagehand(StagehandConfig);
  await stagehand.init();
  
  const page = stagehand.page;
  const context = stagehand.context;
  
  // Navigate to start page
  await page.goto(`https://en.wikipedia.org/wiki/${startPage}`);
  
  try {
    // Extract links from current page
    const links = await page.extract({
      instruction: "extract all links on this Wikipedia page",
      schema: z.object({
        links: z.array(z.object({
          text: z.string(),
          href: z.string(),
        })),
      }),
      useTextExtract: true,
    });
    
    // Make strategic decision on which link to follow
    const nextLink = findBestLink(links.links, targetPage);
    
    // Click the chosen link
    await page.act({
      action: `click the link to ${nextLink.text}`,
    });
    
    // Continue until target is reached...
  } catch (error) {
    console.error("Error during WikiRace:", error);
  }
}

function findBestLink(links, targetPage) {
  // Algorithm to find the most promising link
  // ...
}
```

## User Flow

1. **Landing Page**: Single page with vibrant, Gen-Z styling featuring:
   - Game title and brief explanation
   - Start button
   - Option to customize start/target pages
   
2. **Game Screen**:
   - Split view with player frame and AI viewport
   - Progress indicators for both player and AI
   - Timer and click counter
   
3. **Results Screen**:
   - Performance comparison
   - AI-generated roast/praise with Gen-Z slang
   - Share button and play again option

## Development Approach

### Phase 1: Core Setup
- Set up split-screen interface
- Implement Wikipedia iframe for player
- Configure Browserbase viewport for AI

### Phase 2: Game Logic
- Implement start/target page selection
- Track player navigation events
- Implement timer and click counter

### Phase 3: AI Implementation
- Implement Stagehand navigation logic
- Create strategic path-finding algorithm
- Add visual indicators of AI progress

### Phase 4: Results & Commentary
- Implement performance comparison
- Create Gen-Z style commentary generator
- Add share functionality

## Design Elements

- **Color Scheme**: Vibrant, high-contrast colors (neon purples, electric blues)
- **Typography**: Bold, chunky fonts with playful elements
- **Iconography**: Emoji-rich, meme-inspired visual elements
- **Animations**: Smooth transitions with playful micro-interactions
- **Language**: Irreverent, Gen-Z slang throughout the interface

## Technical Considerations

1. **Cross-Origin Issues**: Handling Wikipedia iframe cross-origin restrictions
2. **Performance**: Ensuring smooth split-screen experience
3. **Browserbase Integration**: Leveraging existing Stagehand infrastructure
4. **Mobile Responsiveness**: Optional - adapting the split-screen for smaller devices

## Conclusion

This simplified WikiRace AI focuses on creating an engaging, single-page Browserbase demo that showcases the capabilities of Stagehand while providing a fun, competitive experience. By emphasizing the real-time race aspect and delivering irreverent Gen-Z style commentary, the application creates a memorable and shareable experience without the complexity of user accounts or persistent storage. 