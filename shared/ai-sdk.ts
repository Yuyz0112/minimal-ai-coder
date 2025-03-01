import "jsr:@std/dotenv/load";
import { google } from "npm:@ai-sdk/google";
// import { openai } from "npm:@ai-sdk/openai";

export const provider = {
  coderModel: google("gemini-2.0-flash"),
  architectModel: google("gemini-2.0-flash"),
};

export { generateText } from "npm:ai";
