import mongoose, { Schema, Document } from "mongoose";

export interface IFinancialData {
  year: string;
  revenue: number;
  expenses: number;
}

export interface IReview {
  name: string;
  rating: number;
  text: string;
  createdAt: Date;
}

export interface IPitchDigest {
  summary: string;
  risks: string[];
  actionItems: string[];
}

export interface IVenture extends Document {
  title: string;
  shortDesc: string;
  longDesc: string;
  category: string;
  budget: number;
  status: string;
  ownerId: string;
  imageUrl?: string;
  aiScore?: number;
  aiAnalysis?: {
    swotAnalysis?: {
      strengths: string[];
      weaknesses: string[];
      opportunities: string[];
      threats: string[];
    };
    techStack?: string[];
    competitors?: { name: string; gap: string; threatLevel: string }[];
    marketFeasibility?: string;
  };
  financialData?: IFinancialData[];
  tags?: string[];
  pitchDigest?: IPitchDigest;
  reviews?: IReview[];
  createdAt: Date;
}

const VentureSchema = new Schema<IVenture>({
  title: { type: String, required: true },
  shortDesc: { type: String, required: true },
  longDesc: { type: String, required: true },
  category: { type: String, required: true },
  budget: { type: Number, required: true },
  status: { type: String, default: "Draft" },
  ownerId: { type: String, required: true },
  imageUrl: { type: String },
  aiScore: { type: Number },
  aiAnalysis: {
    swotAnalysis: {
      strengths: [{ type: String }],
      weaknesses: [{ type: String }],
      opportunities: [{ type: String }],
      threats: [{ type: String }],
    },
    techStack: [{ type: String }],
    competitors: [
      {
        name: { type: String },
        gap: { type: String },
        threatLevel: { type: String },
      },
    ],
    marketFeasibility: { type: String },
  },
  financialData: [
    {
      year: { type: String },
      revenue: { type: Number },
      expenses: { type: Number },
    },
  ],
  tags: [{ type: String }],
  pitchDigest: {
    summary: { type: String },
    risks: [{ type: String }],
    actionItems: [{ type: String }],
  },
  reviews: [
    {
      name: { type: String, required: true },
      rating: { type: Number, required: true },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Venture ||
  mongoose.model<IVenture>("Venture", VentureSchema);
