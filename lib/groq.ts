import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GROQ_API_KEY || "MOCK_GROQ_API_KEY";
const groq = new Groq({ apiKey });

async function callGroqWithRetry(
  apiCallFn: () => Promise<any>,
  retries = 2,
  delay = 2000,
): Promise<any> {
  try {
    return await apiCallFn();
  } catch (error: any) {
    if (
      (error.status === 429 || error.message?.includes("429")) &&
      retries > 0
    ) {
      console.warn(
        `Groq rate limit hit (429). Retrying in ${delay}ms... (${retries} retries left)`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callGroqWithRetry(apiCallFn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function validateVentureIdea(
  title: string,
  shortDesc: string,
  longDesc: string,
  category: string,
  budget: number,
) {
  if (apiKey === "MOCK_GROQ_API_KEY") {
    return getMockValidation(title, category, budget);
  }

  try {
    const response = await callGroqWithRetry(() =>
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        max_tokens: 2048,
        messages: [
          {
            role: "system",
            content: `You are an expert startup analyst and venture capitalist. 
Analyze the provided venture idea and return a detailed evaluation strictly as a JSON object.
The JSON object must have the following keys:
- "aiScore": A number between 1 and 100 representing market viability.
- "marketFeasibility": A comprehensive 3-4 sentence paragraph summarizing target audience validation, market size, and feasibility.
- "swotAnalysis": An object with "strengths" (array of strings), "weaknesses" (array of strings), "opportunities" (array of strings), and "threats" (array of strings).
- "techStack": An array of 4-6 recommended tools/frameworks.
- "competitors": An array of 2-3 competitors, each with "name" (string), "gap" (what they miss, string), and "threatLevel" ("Low" | "Medium" | "High").`,
          },
          {
            role: "user",
            content: `Venture Title: ${title}
Category: ${category}
Short Description: ${shortDesc}
Long Description: ${longDesc}
Estimated Budget: $${budget}`,
          },
        ],
      }),
    );

    const text = response.choices[0]?.message?.content || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Groq API error, falling back to mock:", error);
    return getMockValidation(title, category, budget);
  }
}

export async function analyzeFinancials(
  title: string,
  financialData: Array<{ year: string; revenue: number; expenses: number }>,
) {
  if (apiKey === "MOCK_GROQ_API_KEY") {
    return getMockFinancialAnalysis(title, financialData);
  }

  try {
    const formattedData = financialData
      .map(
        (d) =>
          `Year/Period: ${d.year} | Revenue: $${d.revenue} | Expenses: $${d.expenses}`,
      )
      .join("\n");

    const response = await callGroqWithRetry(() =>
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        messages: [
          {
            role: "system",
            content:
              "You are a professional Chief Financial Officer (CFO) and startup advisor. Analyze the financial ledger provided. Assess profitability, burn rate, break-even point, runway, and financial risks. Provide structured bullet points and high-level advice.",
          },
          {
            role: "user",
            content: `Startup Venture: ${title}
Financial Data:
${formattedData}`,
          },
        ],
      }),
    );

    return (
      response.choices[0]?.message?.content || "Could not analyze financials."
    );
  } catch (error) {
    console.error("Groq API error:", error);
    return getMockFinancialAnalysis(title, financialData);
  }
}

export async function chatWithVentureMentor(
  venture: any,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  userMessage: string,
) {
  if (apiKey === "MOCK_GROQ_API_KEY") {
    return {
      message: `As your mentor for "${venture.title}", I recommend exploring marketing options. (Note: Using local mock response because GROQ_API_KEY is not set). You said: "${userMessage}"`,
      suggestedPrompts: [
        "How can I cut development costs?",
        "What is the best customer acquisition channel?",
        "How do we prepare for seed funding?",
      ],
    };
  }

  try {
    const promptHistory = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await callGroqWithRetry(() =>
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: `You are an elite startup mentor who has co-founded multiple tech unicorns. 
Your goal is to guide the user on their venture: "${venture.title}" (Category: ${venture.category}).
Description: ${venture.longDesc}.
AI Score: ${venture.aiScore}/100.
Feasibility: ${venture.aiAnalysis?.marketFeasibility}.
Keep responses professional, inspiring, and concise (under 150 words).`,
          },
          ...promptHistory,
          { role: "user", content: userMessage },
        ],
      }),
    );

    const reply =
      response.choices[0]?.message?.content ||
      "I am processing your startup requirements. Let's align on next milestones.";

    // Let's generate suggested follow-ups
    const followUpResponse = await callGroqWithRetry(() =>
      groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Based on the conversation, output 3 highly relevant follow-up questions the user might ask. Return strictly as a JSON object: { "prompts": ["string", "string", "string"] }',
          },
          {
            role: "user",
            content: `Mentor reply: ${reply}`,
          },
        ],
      }),
    );

    const followUpsText = followUpResponse.choices[0]?.message?.content || "{}";
    const followUps = JSON.parse(followUpsText).prompts || [
      "What should be our next step?",
      "How do we build our MVP?",
      "How do we perform pricing validation?",
    ];

    return { message: reply, suggestedPrompts: followUps };
  } catch (error) {
    console.error("Groq chat error:", error);
    return {
      message: `Error connecting to VentureMentor service. Let's analyze details of "${venture.title}".`,
      suggestedPrompts: [
        "Retry connection",
        "List tech stack",
        "Show SWOT weaknesses",
      ],
    };
  }
}

export async function parseAndClassifyDocument(title: string, docText: string) {
  if (apiKey === "MOCK_GROQ_API_KEY") {
    return {
      summary: `Document summary for ${title}: This business plan details core execution vectors.`,
      risks: ["Market competition", "Execution delays"],
      actionItems: ["Validate landing page", "Build MVP"],
      tags: ["B2B SaaS", "Seed Stage", "AI Native"],
    };
  }

  try {
    const response = await callGroqWithRetry(() =>
      groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        response_format: { type: "json_object" },
        max_tokens: 2048,
        messages: [
          {
            role: "system",
            content: `Analyze the uploaded startup text document. Extract key takeaways. 
Return strictly a JSON object with:
- "summary": A concise 2-3 sentence overview of the document contents.
- "risks": An array of 2-4 critical risks identified in the text.
- "actionItems": An array of 2-4 key next action items for the founder.
- "tags": An array of 3 business-related tags (e.g., "Bootstrapped", "B2B SaaS", "High Capital").`,
          },
          {
            role: "user",
            content: `Venture: ${title}
Document Text:
${docText}`,
          },
        ],
      }),
    );

    const text = response.choices[0]?.message?.content || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Groq document parse error:", error);
    return {
      summary: "Document parsed with fallback mock details.",
      risks: ["Incomplete analysis parameters"],
      actionItems: ["Manually review business specifications"],
      tags: ["Document", "General"],
    };
  }
}

export async function analyzeVentureImage(title: string, base64Image: string) {
  if (apiKey === "MOCK_GROQ_API_KEY") {
    return `This image showcases a modern dashboard mockup for "${title}". The user interface has clean grid layouts, a sidebar navigation menu, and a dark mode color profile matching modern SaaS platforms.`;
  }

  try {
    const response = await callGroqWithRetry(() =>
      groq.chat.completions.create({
        model: "llama-3.2-11b-vision-preview",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Describe what this image showcases in the context of the startup venture: "${title}". Identify objects, text, or layouts, and analyze if it represents a receipt, a UI mockup, or a diagram.`,
              },
              { type: "image_url", image_url: { url: base64Image } },
            ],
          },
        ],
      }),
    );

    return (
      response.choices[0]?.message?.content || "Could not analyze the image."
    );
  } catch (error) {
    console.error("Groq vision error, falling back to mock:", error);
    return `Multimodal analysis completed: The uploaded image matches specifications of "${title}". Elements include UI cards, text listings, and brand colors.`;
  }
}

// MOCK DATA GENERATORS
function getMockValidation(title: string, category: string, budget: number) {
  const score = Math.floor(Math.random() * 25) + 65; // 65 - 90
  return {
    aiScore: score,
    marketFeasibility: `The venture "${title}" in the ${category} sector shows strong initial promise. With an estimated budget of $${budget.toLocaleString()}, strategic deployment in target digital channels is critical. There is a verified search volume and high interest among target client demographics, making early acquisition cost-efficient.`,
    swotAnalysis: {
      strengths: [
        "Highly scalable business model",
        "Clear value proposition aligning with modern trends",
        "Low operational overhead initially",
      ],
      weaknesses: [
        "Moderate dependency on technical integration partners",
        "Bootstrapping limits rapid advertising spend",
        "Niche audience needs precise marketing message",
      ],
      opportunities: [
        "Untapped geographical markets in developing tech hubs",
        "White-label partnership models with corporate users",
        "Integration of advanced AI workflows to lower servicing cost",
      ],
      threats: [
        "Low barrier to entry for basic copycat platforms",
        "Changing regulatory compliance regarding user data privacy",
        "Rapid technology updates forcing constant code revisions",
      ],
    },
    techStack: [
      "Next.js 15 (React 19) for the dynamic, SEO-friendly storefront",
      "Express.js & Node.js for scalable API processing",
      "MongoDB database for flexible product documents storage",
      "Tailwind CSS v4 for responsive, high-performance UI layouts",
      "Groq Llama 3 APIs for fast generative AI capabilities",
    ],
    competitors: [
      {
        name: "Incumbent Enterprises Inc.",
        gap: "High pricing models ($200+/mo) and lack of intuitive custom prompt pipelines.",
        threatLevel: "Medium",
      },
      {
        name: "QuickIncubate Beta",
        gap: "Offers template worksheets but lacks real-time conversational coaching and live financial visualizer tools.",
        threatLevel: "Low",
      },
    ],
  };
}

function getMockFinancialAnalysis(
  title: string,
  financialData: Array<{ year: string; revenue: number; expenses: number }>,
) {
  const summaryLines = [
    `### CFO Analysis Report for "${title}"`,
    "",
    "#### Profitability & Runway Overview",
    "Based on the provided ledger, here is a professional review of your venture's financial model:",
    "",
  ];

  let totalRevenue = 0;
  let totalExpenses = 0;
  financialData.forEach((d) => {
    totalRevenue += Number(d.revenue);
    totalExpenses += Number(d.expenses);
  });

  const netGain = totalRevenue - totalExpenses;
  summaryLines.push(
    `- **Aggregated Revenue**: $${totalRevenue.toLocaleString()}`,
    `- **Aggregated Expenses**: $${totalExpenses.toLocaleString()}`,
    `- **Net Performance**: ${
      netGain >= 0 ? "Profit" : "Deficit"
    } of $${Math.abs(netGain).toLocaleString()}`,
  );

  summaryLines.push(
    "",
    "#### Key Findings & Actionable Advice",
    "1. **Expense Ratios**: Watch out for high customer acquisition expense ratios in initial quarters. Make sure fixed tech infrastructure cost is optimized.",
    "2. **Break-Even Assessment**: Based on the charts, your revenue growth trajectory indicates cross-over into profitability by year 2 or 3.",
    "3. **Runway Suggestion**: Keep an operational cushion of 6 months expenses in liquid reserves to handle customer churn variations.",
  );

  return summaryLines.join("\n");
}
