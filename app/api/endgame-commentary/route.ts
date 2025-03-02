import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { 
      winner, 
      playerClicks, 
      aiClicks, 
      playerTime, 
      aiTime, 
      playerPath, 
      aiPath,
      targetPage
    } = await request.json();
    
    // Create a prompt for the AI
    const prompt = `You are judging the results of a Wikipedia race game where a human player competed against an AI to reach the target page "${targetPage.replace(/_/g, ' ')}".

Game stats:
- Winner: ${winner === 'player' ? 'Human player' : 'AI'}
- Player clicks: ${playerClicks}
- AI clicks: ${aiClicks}
- Player time: ${playerTime.toFixed(1)} seconds
- AI time: ${aiTime.toFixed(1)} seconds
- Player's path: ${playerPath.join(' → ')}
${aiPath ? `- AI's path: ${aiPath.join(' → ')}` : ''}

Generate a short, snarky commentary (max 100 characters) about the player's performance. 
If the player won, it could be congratulatory but still teasing. If the AI won, it should be more mocking.
Use all lowercase, include emojis, and make it sound like casual internet speech.

Examples:
- "you got cooked by gpt-4o-mini in 3 clicks. ngmi"
- "maybe you didn't get enough pretraining in the womb. cooked."
- "absolutely cracked. you might be safe from agi (for now)"
- "took you long enough 💀 but at least you beat a language model at navigation lol"`;

    // Generate commentary
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using a smaller, faster model for quick responses
      messages: [
        { role: "system", content: "You are a playful AI judge in a Wikipedia race game. You speak in lowercase with emojis and internet slang." },
        { role: "user", content: prompt }
      ],
      max_tokens: 100,
      temperature: 0.9, // Higher temperature for more creative responses
    });

    const commentary = response.choices[0]?.message?.content?.trim() || "gg i guess 🤷‍♂️";
    
    // Determine rating based on performance
    let rating: 'cracked' | 'cooked' | 'mid' = 'mid';
    
    if (winner === 'player') {
      // Player won
      if (playerClicks < aiClicks || (playerClicks === aiClicks && playerTime < aiTime)) {
        rating = 'cracked'; // Player did better than AI
      } else {
        rating = 'mid'; // Player won but not impressively
      }
    } else {
      // AI won
      if (aiClicks < playerClicks - 2) {
        rating = 'cooked'; // AI did much better
      } else {
        rating = 'mid'; // Close race
      }
    }
    
    return NextResponse.json({ commentary, rating });
  } catch (error) {
    console.error('Error generating end-game commentary:', error);
    return NextResponse.json({ error: 'Failed to generate commentary' }, { status: 500 });
  }
} 