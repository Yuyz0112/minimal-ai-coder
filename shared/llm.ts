import OpenAI from "jsr:@openai/openai";
import "jsr:@std/dotenv/load";

export const provider = {
  apiKey: Deno.env.get("API_KEY"),
  baseUrl: Deno.env.get("BASE_URL"),
  model: Deno.env.get("MODEL") || "",
  architectModel: Deno.env.get("ARCHITECT_MODEL") || "",
  coderModel: Deno.env.get("CODER_MODEL") || "",
};

export const client = new OpenAI({
  apiKey: provider.apiKey,
  baseURL: provider.baseUrl,
  fetch: async (url: RequestInfo, init?: RequestInit): Promise<Response> => {
    if (init?.body) {
      const input = JSON.parse(init.body.toString());
      input.messages.forEach((m: any) => {
        // console.log(m.content);
        if (m.role === "user") {
          historyLog(m);
        }
      });
    }
    return fetch(url, init);
  },
});

export const historyLog = (message: { role: string; content: string }) => {
  // let current: { role: string; content: string }[] = [];
  // try {
  //   current = parse(Deno.readTextFileSync("history.yaml")) as typeof current;
  // } catch {}
  // current.push(message);
  // Deno.writeTextFileSync("history.yaml", stringify(current));
};
