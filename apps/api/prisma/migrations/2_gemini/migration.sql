-- Añade el proveedor LLM "gemini" (Gemini nativo con Google Search grounding).
ALTER TYPE "LlmProvider" ADD VALUE IF NOT EXISTS 'gemini';
