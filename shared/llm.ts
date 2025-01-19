import OpenAI from "jsr:@openai/openai";
import "jsr:@std/dotenv/load";

export const provider = {
  apiKey: Deno.env.get("API_KEY"),
  baseUrl: Deno.env.get("BASE_URL"),
  model: Deno.env.get("MODEL") || "",
};

export const client = new OpenAI({
  apiKey: provider.apiKey,
  baseURL: provider.baseUrl,
});
