import { z } from "zod";

export const topicSchema = z.object({
  topic: z.enum(["react", "javascript", "both", "offtopic"]).describe(
    "react = React/JSX/hooks/component questions; javascript = core language, DOM, async, modules; both = React question that depends on JS fundamentals; offtopic = anything else"
  ),
});

export const verdictSchema = z.object({
  verdict: z.enum(["enough", "not_enough"]).describe("Does the evidence directly answer the question?"),
});
