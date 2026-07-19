import mongoose, { Schema, Document } from "mongoose";

export interface IChatMessage extends Document {
  role: "user" | "assistant";
  message: string;
  ventureId: string;
  userId: string;
  timestamp: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>({
  role: { type: String, enum: ["user", "assistant"], required: true },
  message: { type: String, required: true },
  ventureId: { type: String, required: true },
  userId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.models.ChatMessage || mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
