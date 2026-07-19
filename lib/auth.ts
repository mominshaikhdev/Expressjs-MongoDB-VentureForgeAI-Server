import dns from "dns";
try {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  }
} catch (e) {
  console.warn("Could not set DNS servers:", e);
}

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { bearer } from "better-auth/plugins";

dotenv.config();

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("CRITICAL: MONGODB_URI is not set in env vars.");
  process.exit(1);
}
const client = new MongoClient(mongoUri);
const db = client.db();

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [bearer()],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_MOCK",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET_MOCK",
    },
  },
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "SUPER_SECRET_DUMMY_KEY_FOR_LOCAL_DEVELOPMENT_12345",
  trustedOrigins: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
    : [],
  advanced: {
    cookiePrefix: "ventureforge",
    useSecureCookies: process.env.NODE_ENV === "production",
    ...(process.env.NODE_ENV === "production"
      ? {
          defaultCookieAttributes: {
            sameSite: "none",
            secure: true,
          },
        }
      : {}),
  },
});

async function seedDatabase() {
  try {
    const usersToSeed = [
      {
        email: "demo@ventureforge.ai",
        password: "DemoFounder123!",
        name: "Demo Founder",
      },
      {
        email: "example@example.com",
        password: "JohnPassword123!",
        name: "John Doe",
      },
    ];

    const usersCollection = db.collection("user");

    for (const u of usersToSeed) {
      const existing = await usersCollection.findOne({ email: u.email });
      if (!existing) {
        console.log(`Seeding user account ${u.email} to MongoDB...`);
        try {
          await auth.api.signUpEmail({
            body: {
              email: u.email,
              password: u.password,
              name: u.name,
            },
          });
        } catch {
          try {
            await (auth.api as any).signUpEmail({
              email: u.email,
              password: u.password,
              name: u.name,
            });
          } catch (e) {
            console.error(`Failed to signup ${u.email}:`, e);
          }
        }
      }
    }

    // Fetch user IDs
    const demoUser = await usersCollection.findOne({
      email: "demo@ventureforge.ai",
    });
    
    const johnUser = await usersCollection.findOne({
      email: "example@example.com",
    });

    const demoUserId = demoUser?._id?.toString() || demoUser?.id;

    const johnUserId = johnUser?._id?.toString() || johnUser?.id;

    if (!demoUserId || !johnUserId) {
      console.warn("Could not retrieve all user IDs for seeding ventures.");
      return;
    }

    // Seed Ventures
    const venturesCollection = db.collection("ventures");

    const venturesToSeed = [
      {
        title: "VentureForge AI",
        category: "AI/ML Native",
        shortDesc:
          "Automated business model validation pipeline powered by LLMs.",
        longDesc:
          "VentureForge AI is an advanced SaaS application designed to help startup incubators and individual founders audit early business copies. Using state-of-the-art LLMs, the platform conducts comprehensive feasibility studies, formats SWOT analyses, estimates competitor gaps, and charts budget projection models.",
        budget: 85000,
        status: "Validated",
        ownerId: demoUserId,
        imageUrl:
          "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&auto=format&fit=crop",
        aiScore: 92,
        aiAnalysis: {
          swotAnalysis: {
            strengths: [
              "Highly integrated LLM orchestration",
              "Real-time interactive mentor chat logs",
              "Automated custom CSV spreadsheet parsing",
            ],
            weaknesses: [
              "Dependent on upstream API rate-limits",
              "Requires high GPU server processing budgets",
            ],
            opportunities: [
              "Integration with startup accelerator portfolios",
              "White-label enterprise subscription licensing models",
            ],
            threats: [
              "Rapid open-source LLM releases bypassing standard platforms",
              "Changing data privacy standard compliance requirements",
            ],
          },
          techStack: [
            "Next.js 15 (Turbopack)",
            "Express & Mongoose",
            "MongoDB Atlas DB",
            "Groq Llama 3.3, 3.1 & 3.2 Vision APIs",
            "Tailwind CSS v4",
          ],
          competitors: [
            {
              name: "Incumbents Corp",
              gap: "Slower audit cycles, higher monthly subscription plans.",
              threatLevel: "Medium",
            },
          ],
          marketFeasibility:
            "VentureForge AI fills a critical gap in accelerated validation. Initial scores are high and the target budget matches development cycles.",
        },
        financialData: [
          { year: "2024", revenue: 12000, expenses: 24000 },
          { year: "2025", revenue: 54000, expenses: 40000 },
          { year: "2026", revenue: 145000, expenses: 85000 },
        ],
        tags: ["AI Native", "SaaS", "Seed Stage"],
        reviews: [
          {
            name: "Marcus Aurelius",
            rating: 5,
            text: "The tech stack recommendation fits our team profile exactly. Saved us weeks of debates.",
            createdAt: new Date("2026-07-10"),
          },
          {
            name: "Devon Lane",
            rating: 4,
            text: "Swot analysis identified threats we didn't initially factor in.",
            createdAt: new Date("2026-07-14"),
          },
        ],
        pitchDigest: {
          summary:
            "Business deck targeting incubator validation pipelines. Employs modular Groq LLM chains to analyze startup copy inputs.",
          risks: [
            "Upstream service downtime",
            "High tokens consumption overhead",
          ],
          actionItems: [
            "Finalize Better Auth integration blueprints",
            "Optimize chart visualizers responsive scales",
          ],
        },
        createdAt: new Date(),
      },
      {
        title: "EcoSphere IoT",
        category: "CleanTech",
        shortDesc:
          "AI-powered IoT SaaS for industrial carbon tracking and emission reduction.",
        longDesc:
          "EcoSphere IoT is an AI-powered SaaS platform that helps heavy manufacturing plants reduce carbon emissions and energy consumption. The platform integrates with existing hardware sensors and systems to provide real-time operational adjustments. The company aims to accelerate the industrial transition to net-zero while saving operators millions in utility bills and carbon taxation.",
        budget: 150000,
        status: "Validated",
        ownerId: demoUserId,
        imageUrl:
          "https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=600&auto=format&fit=crop",
        aiScore: 88,
        aiAnalysis: {
          swotAnalysis: {
            strengths: [
              "Proprietary real-time optimization algorithm",
              "Deep integration compatibility with legacy PLCs",
              "Strong team background in industrial engineering",
            ],
            weaknesses: [
              "High initial custom integration cost for clients",
              "Long B2B enterprise sales cycles",
              "Hardware dependency on sensor accuracy",
            ],
            opportunities: [
              "New European carbon tax regulations forcing compliance by Q3 2026",
              "Partnership opportunities with green energy providers",
              "Expansion into maritime and logistics sectors",
            ],
            threats: [
              "Established heavy industrial players building in-house trackers",
              "Changes in government environmental subsidies",
            ],
          },
          techStack: [
            "Next.js 15",
            "Node.js & Express",
            "MongoDB for sensor logs",
            "InfluxDB for time-series metrics",
            "Tailwind CSS",
          ],
          competitors: [
            {
              name: "CarbonGrid Inc.",
              gap: "Static auditing logs rather than active machine closed-loop optimization.",
              threatLevel: "Medium",
            },
            {
              name: "GreenPLC",
              gap: "Only supports Siemens hardware, lacks multi-protocol translator software.",
              threatLevel: "Low",
            },
          ],
          marketFeasibility:
            "EcoSphere IoT targets a highly motivated sector due to rising regulatory penalties. The budget is sufficient for initial firmware development and a pilot launch, and local industry associations show high interest in early partnerships.",
        },
        financialData: [
          { year: "2024", revenue: 0, expenses: 60000 },
          { year: "2025", revenue: 45000, expenses: 80000 },
          { year: "2026", revenue: 180000, expenses: 110000 },
        ],
        tags: ["CleanTech", "IoT", "B2B Enterprise"],
        reviews: [
          {
            name: "Devon Lane",
            rating: 4,
            text: "Swot analysis identified threats we didn't initially factor in.",
            createdAt: new Date("2026-07-14"),
          },
          {
            name: "Marcus Aurelius",
            rating: 5,
            text: "The tech stack recommendation fits our team profile exactly. Saved us weeks of debates.",
            createdAt: new Date("2026-07-10"),
          },
          {
            name: "A. Sharma",
            rating: 5,
            text: "Dashboard matches industrial user needs. The integration steps are clear.",
            createdAt: new Date("2026-07-16"),
          },
        ],
        pitchDigest: {
          summary:
            "Business plan focusing on smart sensor integration to decrease factory fuel utility expenses. Outlines hardware modules and subscription software models.",
          risks: [
            "Regulatory changes",
            "Client PLC protocol translation failure",
          ],
          actionItems: [
            "Finalize pilot agreement with German packaging plants by Q3 2026",
            "Attain ISO 27001 cybersecurity certification by Q4 2026",
          ],
        },
        createdAt: new Date(),
      },
      {
        title: "EduPulse",
        category: "EdTech",
        shortDesc:
          "Gamified learning pathways and AI-driven homework feedback loops.",
        longDesc:
          "EduPulse is an interactive classroom management and gamified homework application. The platform helps educators design responsive learning quests that adapt to individual student paces, while using fine-tuned Llama models to auto-grade math and writing tasks with structured suggestions.",
        budget: 45000,
        status: "Validated",
        ownerId: demoUserId,
        imageUrl:
          "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop",
        aiScore: 78,
        aiAnalysis: {
          swotAnalysis: {
            strengths: [
              "High classroom engagement via gamification quests",
              "Saves teacher grading time by up to 60%",
              "Adheres to core K-12 curriculum standards",
            ],
            weaknesses: [
              "Requires school district approval board review cycles",
              "Dependent on students having active device access",
            ],
            opportunities: [
              "Expansion into homeschooling markets",
              "Developing integrations with popular LMS like Canvas and Google Classroom",
            ],
            threats: [
              "In-house tool developments by Google or Microsoft Classroom",
              "Privacy policies regarding student data protection",
            ],
          },
          techStack: [
            "Next.js 15",
            "Express & MongoDB",
            "Groq Llama 3.3, 3.1 & 3.2 Vision APIs",
            "Tailwind CSS",
            "Socket.io for live classroom response",
          ],
          competitors: [
            {
              name: "GradeFast AI",
              gap: "Lacks student gamification, only does teacher grading portal.",
              threatLevel: "Medium",
            },
            {
              name: "QuestEdu",
              gap: "Only offers flashcards, lacks adaptive AI pathways.",
              threatLevel: "Low",
            },
          ],
          marketFeasibility:
            "EduPulse has a strong value proposition for teacher retention. The budget is tight but sufficient for a single school district pilot.",
        },
        financialData: [
          { year: "2024", revenue: 2000, expenses: 15000 },
          { year: "2025", revenue: 18000, expenses: 22000 },
          { year: "2026", revenue: 62000, expenses: 40000 },
        ],
        tags: ["EdTech", "Gamification", "SaaS"],
        reviews: [
          {
            name: "A. Sharma",
            rating: 4,
            text: "Excellent classroom retention features, needs FERPA compliance docs.",
            createdAt: new Date("2026-07-16"),
          },
        ],
        pitchDigest: {
          summary:
            "Pitch deck outlining classroom quest models and automated evaluation layers. Outlines pricing structure per district license.",
          risks: [
            "FERPA data compliance issues",
            "Long adoption cycles in public schools",
          ],
          actionItems: [
            "Consult school district privacy lawyer",
            "Build teacher dashboard quest builder prototype",
          ],
        },
        createdAt: new Date(),
      },
      {
        title: "HealthFlow AI",
        category: "HealthTech",
        shortDesc:
          "HIPAA-compliant administrative agent optimizing clinic booking schedules.",
        longDesc:
          "HealthFlow AI is a secure clinical workflow automation tool. It acts as an agentic scheduler, automating doctor appointment bookings, processing intake records with OCR and parsing visual insurance cards, and alerting staff regarding potential patient check-in bottlenecks.",
        budget: 120000,
        status: "Validated",
        ownerId: johnUserId,
        imageUrl:
          "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&auto=format&fit=crop",
        aiScore: 85,
        aiAnalysis: {
          swotAnalysis: {
            strengths: [
              "HIPAA-compliant data encryption by design",
              "Integrates directly with standard Epic EHR pipelines",
              "Decreases clinic appointment no-shows by 35%",
            ],
            weaknesses: [
              "Requires expensive third-party security audits",
              "High entry barrier due to strict healthcare compliance",
            ],
            opportunities: [
              "Expansion into telehealth provider networks",
              "Integrating voice-based AI assistant for elderly patient scheduling",
            ],
            threats: [
              "EHR incumbents upgrading their built-in booking modules",
              "Liability risks regarding administrative booking errors",
            ],
          },
          techStack: [
            "Next.js 15",
            "Express & PostgreSQL",
            "Groq Llama 3.3, 3.1 & 3.2 Vision APIs",
            "Tailwind CSS",
            "Better Auth for secure doctor login",
          ],
          competitors: [
            {
              name: "EHR-Booker",
              gap: "No dynamic route optimization or bottleneck prediction models.",
              threatLevel: "High",
            },
            {
              name: "ClinicHelper",
              gap: "Lacks HIPAA secure chat transcripts memory.",
              threatLevel: "Medium",
            },
          ],
          marketFeasibility:
            "HealthFlow AI targets high-burnout clinics. The budget covers security audits and initial EHR API integrations.",
        },
        financialData: [
          { year: "2024", revenue: 0, expenses: 45000 },
          { year: "2025", revenue: 38000, expenses: 60000 },
          { year: "2026", revenue: 150000, expenses: 95000 },
        ],
        tags: ["HealthTech", "B2B Enterprise", "SaaS"],
        reviews: [
          {
            name: "Marcus Aurelius",
            rating: 4,
            text: "Solid EHR integration workflow. Addresses real administrative burnout.",
            createdAt: new Date("2026-07-10"),
          },
        ],
        pitchDigest: {
          summary:
            "Workflow plan detailing clinical check-in queues optimization and insurance verification. Outlines SaaS tiered pricing for private clinics.",
          risks: [
            "Epic system EHR API access approval delays",
            "Clinic onboarding learning curves",
          ],
          actionItems: [
            "Apply for Epic App Market developer program",
            "Prepare SOC2 type II audit preparation logs",
          ],
        },
        createdAt: new Date(),
      },
    ];

    for (const v of venturesToSeed) {
      const existingVenture = await venturesCollection.findOne({
        title: v.title,
      });
      if (!existingVenture) {
        console.log(`Seeding venture ${v.title} into database...`);
        await venturesCollection.insertOne(v);
      } else {
        console.log(
          `Venture ${v.title} already exists in database. Checking for updates and merging reviews...`,
        );

        const mergedReviews = [...(existingVenture.reviews || [])];
        for (const seedRev of v.reviews || []) {
          const alreadyExists = mergedReviews.some(
            (r: any) => r.name === seedRev.name && r.text === seedRev.text,
          );
          if (!alreadyExists) {
            mergedReviews.push(seedRev);
          }
        }

        await venturesCollection.updateOne(
          { _id: existingVenture._id },
          {
            $set: {
              shortDesc: v.shortDesc,
              longDesc: v.longDesc,
              category: v.category,
              budget: v.budget,
              status: v.status,
              ownerId: v.ownerId,
              imageUrl: v.imageUrl,
              aiScore: v.aiScore,
              aiAnalysis: v.aiAnalysis,
              financialData: v.financialData,
              tags: v.tags,
              pitchDigest: v.pitchDigest,
              reviews: mergedReviews,
            },
          },
        );
      }
    }

    console.log("Database seeding check completed successfully!");
  } catch (err) {
    console.error("Warning: Failed to seed database:", err);
  }
}

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  client
    .connect()
    .then(() => {
      seedDatabase();
    })
    .catch((err) => {
      console.error("MongoClient connection error during seeding:", err);
    });
}
