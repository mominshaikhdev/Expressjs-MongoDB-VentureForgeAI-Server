import dns from "dns";
try {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
} catch (e) {
  console.warn("Could not set DNS servers:", e);
}

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "./lib/auth.js";
import { connectDB } from "./lib/db.js";
import Venture from "./models/Venture.js";
import ChatMessage from "./models/ChatMessage.js";
import {
  validateVentureIdea,
  analyzeFinancials,
  chatWithVentureMentor,
  parseAndClassifyDocument,
  analyzeVentureImage,
} from "./lib/groq.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowedOrigins = process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(",").map((o) => o.trim())
        : [];
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Connect to MongoDB Database
connectDB();

// Express middleware to verify Better Auth session
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      return res
        .status(401)
        .json({ error: "Unauthorized. Please log in first." });
    }
    req.user = session.user;
    req.session = session.session;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal Auth verification failed." });
  }
};

// Mount Better Auth endpoints on Express
app.use("/api/auth", toNodeHandler(auth));

app.get("/", (req: any, res: any) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' http: https: data: blob: 'unsafe-inline'; connect-src 'self' http: https:;",
  );
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>VentureForge AI - Service Portal</title>
        <style>
          body {
            background-color: #090d16;
            color: #f8fafc;
            font-family: 'Inter', -apple-system, system-ui, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background: rgba(18, 24, 38, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 2.5rem;
            border-radius: 1.25rem;
            text-align: center;
            max-width: 440px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
          }
          h1 {
            color: #6366f1;
            font-size: 1.5rem;
            margin-top: 0;
            font-weight: 800;
            letter-spacing: -0.025em;
          }
          p {
            color: #94a3b8;
            font-size: 0.85rem;
            line-height: 1.6;
          }
          .btn {
            display: inline-block;
            margin-top: 1.5rem;
            background-color: #6366f1;
            color: #ffffff;
            padding: 0.6rem 1.2rem;
            border-radius: 0.75rem;
            font-size: 0.8rem;
            font-weight: 600;
            text-decoration: none;
            transition: background-color 0.2s;
          }
          .btn:hover {
            background-color: #4f46e5;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>VentureForge AI Service</h1>
          <p>The Express API backend and Groq LLM validator is active and listening on port 5000.</p>
          <p>To access the client interface and start forging startup plans, please navigate to the frontend portal.</p>
          <a href="http://localhost:3000" class="btn">Launch Frontend Portal (Port 3000)</a>
        </div>
      </body>
    </html>
  `);
});

app.get(
  "/.well-known/appspecific/com.chrome.devtools.json",
  (req: any, res: any) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self' http: https:; connect-src 'self' http: https:;",
    );
    res.status(404).json({});
  },
);

// VENTURES API (CRUD)
// GET /api/ventures - List ventures (support search, multi-field filtering, and sorting)

app.get("/api/ventures", async (req: any, res: any) => {
  try {
    const {
      search,
      category,
      budgetMin,
      budgetMax,
      scoreMin,
      scoreMax,
      sortBy,
      sortOrder,
    } = req.query;

    const filter: any = {};

    // Search query (case-insensitive title search)
    if (search) {
      filter.title = { $regex: search, $options: "i" };
    }

    // Category filter
    if (category && category !== "All") {
      filter.category = category;
    }

    // Budget range filter
    if (budgetMin || budgetMax) {
      filter.budget = {};
      if (budgetMin) filter.budget.$gte = Number(budgetMin);
      if (budgetMax) filter.budget.$lte = Number(budgetMax);
    }

    // AI Score range filter
    if (scoreMin || scoreMax) {
      filter.aiScore = {};
      if (scoreMin) filter.aiScore.$gte = Number(scoreMin);
      if (scoreMax) filter.aiScore.$lte = Number(scoreMax);
    }

    // Sorting parameters
    const validSortFields = ["createdAt", "aiScore", "budget"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    const ventures = await Venture.find(filter).sort({
      [sortField]: sortDirection,
    });
    res.json(ventures);
  } catch (error) {
    console.error("Error fetching ventures:", error);
    res.status(500).json({ error: "Failed to fetch ventures list." });
  }
});

// GET /api/ventures/:id - Fetch single venture details
app.get("/api/ventures/:id", async (req: any, res: any) => {
  try {
    const venture = await Venture.findById(req.params.id);
    if (!venture) {
      return res.status(404).json({ error: "Venture project not found." });
    }
    res.json(venture);
  } catch (error) {
    console.error("Error fetching venture details:", error);
    res.status(500).json({ error: "Failed to fetch venture details." });
  }
});

// POST /api/ventures - Add a new venture
app.post("/api/ventures", requireAuth, async (req: any, res: any) => {
  try {
    const { title, shortDesc, longDesc, category, budget, imageUrl } = req.body;

    if (!title || !shortDesc || !longDesc || !category || !budget) {
      return res
        .status(400)
        .json({ error: "All fields are required to submit an idea." });
    }

    // Trigger Groq LLM validation agent
    const aiAnalysis = await validateVentureIdea(
      title,
      shortDesc,
      longDesc,
      category,
      Number(budget),
    );

    const newVenture = new Venture({
      title,
      shortDesc,
      longDesc,
      category,
      budget: Number(budget),
      imageUrl:
        imageUrl ||
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop",
      ownerId: req.user.id,
      aiScore: aiAnalysis.aiScore || 75,
      aiAnalysis: {
        swotAnalysis: aiAnalysis.swotAnalysis || {},
        techStack: aiAnalysis.techStack || [],
        competitors: aiAnalysis.competitors || [],
        marketFeasibility: aiAnalysis.marketFeasibility || "",
      },
      status: "Validated",
    });

    const savedVenture = await newVenture.save();
    res.status(201).json(savedVenture);
  } catch (error) {
    console.error("Error creating venture:", error);
    res
      .status(500)
      .json({ error: "Failed to validate or create venture project." });
  }
});

// DELETE /api/ventures/:id - Delete a venture
app.delete("/api/ventures/:id", requireAuth, async (req: any, res: any) => {
  try {
    const venture = await Venture.findById(req.params.id);
    if (!venture) {
      return res.status(404).json({ error: "Venture project not found." });
    }

    // Ensure the requester owns the venture
    if (venture.ownerId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Forbidden: You do not own this project." });
    }

    await Venture.findByIdAndDelete(req.params.id);
    // Also delete associated chat histories
    await ChatMessage.deleteMany({ ventureId: req.params.id });

    res.json({ message: "Venture project deleted successfully." });
  } catch (error) {
    console.error("Error deleting venture:", error);
    res.status(500).json({ error: "Failed to delete venture project." });
  }
});

// POST /api/ventures/:id/reviews - Submit a review
app.post(
  "/api/ventures/:id/reviews",
  requireAuth,
  async (req: any, res: any) => {
    try {
      const { name, rating, text } = req.body;
      if (!name || rating === undefined || !text) {
        return res
          .status(400)
          .json({ error: "Review name, rating, and content are required." });
      }
      const venture = await Venture.findById(req.params.id);
      if (!venture) {
        return res.status(404).json({ error: "Venture project not found." });
      }
      const newReview = {
        name,
        rating: Number(rating),
        text,
        createdAt: new Date(),
      };
      if (!venture.reviews) {
        venture.reviews = [];
      }
      venture.reviews.push(newReview);
      await venture.save();
      res.status(201).json(venture);
    } catch (error) {
      console.error("Error adding review:", error);
      res.status(500).json({ error: "Failed to submit user review." });
    }
  },
);

// PUT /api/ventures/:id/tags - Update venture tags
app.put("/api/ventures/:id/tags", requireAuth, async (req: any, res: any) => {
  try {
    const { tags } = req.body;
    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({ error: "Tags array is required." });
    }
    const venture = await Venture.findById(req.params.id);
    if (!venture) {
      return res.status(404).json({ error: "Venture project not found." });
    }
    venture.tags = tags;
    await venture.save();
    res.json(venture);
  } catch (error) {
    console.error("Error updating tags:", error);
    res.status(500).json({ error: "Failed to update venture tags." });
  }
});

// AGENTIC AI ENDPOINTS
// POST /api/ai/chat - Conversation with Startup Mentor
app.post("/api/ai/chat", requireAuth, async (req: any, res: any) => {
  try {
    const { ventureId, message } = req.body;
    if (!ventureId || !message) {
      return res
        .status(400)
        .json({ error: "Venture ID and message content are required." });
    }

    const venture = await Venture.findById(ventureId);
    if (!venture) {
      return res.status(404).json({ error: "Venture project not found." });
    }

    // Fetch conversation history from db
    const history = await ChatMessage.find({
      ventureId,
      userId: req.user.id,
    }).sort({ timestamp: 1 });

    const formattedHistory = history.map((h) => ({
      role: h.role,
      content: h.message,
    }));

    // Trigger Groq AI startup coach
    const result = await chatWithVentureMentor(
      venture,
      formattedHistory,
      message,
    );

    // Save user message and assistant reply to DB
    const userMsg = new ChatMessage({
      role: "user",
      message,
      ventureId,
      userId: req.user.id,
    });
    await userMsg.save();

    const assistantMsg = new ChatMessage({
      role: "assistant",
      message: result.message,
      ventureId,
      userId: req.user.id,
    });
    await assistantMsg.save();

    res.json({
      reply: result.message,
      suggestedPrompts: result.suggestedPrompts,
      history: [...history, userMsg, assistantMsg],
    });
  } catch (error) {
    console.error("Error in AI Mentor Chat:", error);
    res
      .status(500)
      .json({ error: "Startup Mentor service is currently unavailable." });
  }
});

// GET /api/ai/chat/history/:ventureId - Fetch history
app.get(
  "/api/ai/chat/history/:ventureId",
  requireAuth,
  async (req: any, res: any) => {
    try {
      const history = await ChatMessage.find({
        ventureId: req.params.ventureId,
        userId: req.user.id,
      }).sort({ timestamp: 1 });
      res.json(history);
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ error: "Failed to fetch session chat history." });
    }
  },
);

// POST /api/ai/analyze-financials - CFO audit of expenses/projections
app.post(
  "/api/ai/analyze-financials",
  requireAuth,
  async (req: any, res: any) => {
    try {
      const { ventureId, financialData } = req.body;
      if (!ventureId || !financialData || !Array.isArray(financialData)) {
        return res
          .status(400)
          .json({ error: "Venture ID and valid ledger array are required." });
      }

      const venture = await Venture.findById(ventureId);
      if (!venture) {
        return res.status(404).json({ error: "Venture project not found." });
      }

      // Call Groq analyzer
      const analysisReport = await analyzeFinancials(
        venture.title,
        financialData,
      );

      // Save financial data to venture schema
      venture.financialData = financialData;
      await venture.save();

      res.json({ report: analysisReport });
    } catch (error) {
      console.error("Error analyzing financials:", error);
      res
        .status(500)
        .json({ error: "Failed to perform financial projections analysis." });
    }
  },
);

// POST /api/ai/digest-pitch - Digest text plans or PDFs
app.post("/api/ai/digest-pitch", requireAuth, async (req: any, res: any) => {
  try {
    const { ventureId, text } = req.body;
    if (!ventureId || !text) {
      return res
        .status(400)
        .json({ error: "Venture ID and document text content are required." });
    }

    const venture = await Venture.findById(ventureId);
    if (!venture) {
      return res.status(404).json({ error: "Venture project not found." });
    }

    const docInsights = await parseAndClassifyDocument(venture.title, text);

    venture.pitchDigest = {
      summary: docInsights.summary || "",
      risks: docInsights.risks || [],
      actionItems: docInsights.actionItems || [],
    };
    if (docInsights.tags) {
      // Merge unique tags
      const currentTags = venture.tags || [];
      const newTags = Array.from(
        new Set([...currentTags, ...docInsights.tags]),
      );
      venture.tags = newTags;
    }
    await venture.save();

    res.json(docInsights);
  } catch (error) {
    console.error("Error analyzing document text:", error);
    res.status(500).json({ error: "Document intelligence analysis failed." });
  }
});

// POST /api/ai/analyze-image - Vision analyzer for receipt/mockup
app.post("/api/ai/analyze-image", requireAuth, async (req: any, res: any) => {
  try {
    const { ventureId, image } = req.body;
    if (!ventureId || !image) {
      return res
        .status(400)
        .json({ error: "Venture ID and base64 image data are required." });
    }

    const venture = await Venture.findById(ventureId);
    if (!venture) {
      return res.status(404).json({ error: "Venture project not found." });
    }

    const explanation = await analyzeVentureImage(venture.title, image);
    res.json({ explanation });
  } catch (error) {
    console.error("Error analyzing image:", error);
    res.status(500).json({ error: "Multimodal vision analysis failed." });
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`VentureForge Express server listening on port ${PORT}`);
  });
}

export default app;
