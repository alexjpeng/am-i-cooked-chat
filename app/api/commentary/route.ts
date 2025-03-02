import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { currentPage, targetPage, previousPages } = await request.json();
    
    if (!currentPage) {
      return NextResponse.json({ error: 'Current page is required' }, { status: 400 });
    }
    
    // Create a prompt for the AI
    const prompt = `You are an AI opponent in a Wikipedia race game. The player just clicked from their previous page to "${currentPage}". 
Their target page is "${targetPage}". Their path so far has been: ${previousPages.join(' → ')}.

Generate a short, snarky, playful comment (max 100 characters) teasing the player about their navigation choice. 
Use all lowercase, include emojis, and make it sound like casual internet speech.
Examples:
- "can't believe you missed einstein => united states 🤣 you are so cooked"
- "going through history? target is literally in the science section lol 💀"
- "taking the scenic route i see 😂 i'll be done before you even get close"`;

    // Generate commentary
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using a smaller, faster model for quick responses
      messages: [
        { role: "system", content: "You are a playful AI opponent in a Wikipedia race game. You speak in lowercase with emojis and internet slang." },
        { role: "user", content: prompt }
      ],
      max_tokens: 100,
      temperature: 0.9, // Higher temperature for more creative responses
    });

    const commentary = response.choices[0]?.message?.content?.trim() || "lol what are you doing? 😂";
    
    return NextResponse.json({ commentary });
  } catch (error) {
    console.error('Error generating commentary:', error);
    return NextResponse.json({ error: 'Failed to generate commentary' }, { status: 500 });
  }
} 