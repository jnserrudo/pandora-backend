import fs from 'fs';
import path from 'path';
import Groq from 'groq-sdk';
import { isModelAccessError, toPublicAiError } from '../utils/ai-errors.js';

const DEFAULT_GROQ_MODEL = 'qwen/qwen3.6-27b';
const TEXT_MODEL = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
const VISION_MODEL = process.env.GROQ_VISION_MODEL || DEFAULT_GROQ_MODEL;
const TEXT_FALLBACKS = [TEXT_MODEL, DEFAULT_GROQ_MODEL]
  .filter((model, index, list) => list.indexOf(model) === index);
const VISION_FALLBACKS = [VISION_MODEL, DEFAULT_GROQ_MODEL]
  .filter((model, index, list) => list.indexOf(model) === index);

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

let groqClient = null;

function providerIsGroq() {
  return String(process.env.AI_PROVIDER || 'groq').toLowerCase() === 'groq';
}

export function isAiConfigured() {
  return providerIsGroq() && Boolean(process.env.GROQ_API_KEY);
}

export function getAiRuntimeStatus() {
  return {
    configured: isAiConfigured(),
    provider: providerIsGroq() ? 'groq' : (process.env.AI_PROVIDER || 'none'),
    textModel: TEXT_MODEL,
    visionModel: VISION_MODEL,
    hasKey: Boolean(process.env.GROQ_API_KEY),
  };
}

function getClient() {
  if (!isAiConfigured()) return null;
  if (!groqClient) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

export function stripThinking(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text
    .replace(/<(think|thinking|thought|reasoning)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(think|thinking|thought|reasoning)[^>]*>[\s\S]*/gi, '')
    .replace(/<\/(?:think|thinking|thought|reasoning)>/gi, '')
    .replace(/here'?s a thinking process:[\s\S]*?(?=\n[A-ZÁÉÍÓÚÑ¿¡])/i, '')
    .replace(/analyze user input:[\s\S]*?(?=\n[A-ZÁÉÍÓÚÑ¿¡])/i, '')
    .trim();
  return cleaned;
}

async function groqChat(client, { model, temperature, messages }) {
  const base = { model, temperature, messages };
  try {
    return await client.chat.completions.create({
      ...base,
      reasoning_effort: 'none',
      reasoning_format: 'hidden',
    });
  } catch (error) {
    const message = String(error?.message || '');
    if (error?.status === 400 && /reasoning/i.test(message)) {
      return client.chat.completions.create(base);
    }
    throw error;
  }
}

function parseJsonResponse(raw) {
  const cleaned = stripThinking(raw);
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fenced ? fenced[1] : cleaned;
  const start = payload.indexOf('{');
  const end = payload.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('La respuesta de Groq no incluyó JSON');
  }
  return JSON.parse(payload.slice(start, end + 1));
}

async function createTextCompletion({ messages, temperature }) {
  const client = getClient();
  if (!client) {
    throw toPublicAiError(new Error('Groq no configurada'));
  }

  let lastError = null;
  for (const model of TEXT_FALLBACKS) {
    try {
      const completion = await groqChat(client, { model, temperature, messages });
      return stripThinking(completion.choices?.[0]?.message?.content || '');
    } catch (error) {
      lastError = error;
      console.error(`[AI] Modelo de texto no disponible (${model}):`, error.message);
      if (isModelAccessError(error)) continue;
      throw toPublicAiError(error);
    }
  }

  throw toPublicAiError(lastError);
}

async function toImageContent(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return { type: 'image_url', image_url: { url } };
  }
  const relative = url.replace(/^\/+/, '');
  const abs = path.resolve(PUBLIC_DIR, relative);
  if (!abs.startsWith(PUBLIC_DIR) || !fs.existsSync(abs)) return null;
  const ext = path.extname(abs).slice(1).toLowerCase() || 'jpeg';
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const base64 = fs.readFileSync(abs).toString('base64');
  return { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } };
}

const CLASSIFY_SYSTEM = `Sos el AI Guard de PANDORA, plataforma de descubrimiento local de Salta, Argentina (no e-commerce).
Clasificá fichas de comercio, eventos, artículos, comentarios o mensajes del buzón.
Respondé SOLO JSON válido:
{"status":"APPROVED"|"FLAGGED"|"REJECTED","reason":"frase corta en español","categories":["insultos"|"sexual"|"violencia"|"estafa"|"spam"|"datos_sensibles"|"odio"|"drogas"|"armas"|"otro"],"confidence":"low"|"medium"|"high","summary":"qué revisaste en una frase"}
No uses etiquetas think.
REJECTED: estafas, phishing, sexual/pornográfico explícito, nudez sexual, menores en contexto sexual, violencia gráfica, odio grave, venta de drogas/armas, datos de tarjetas.
FLAGGED: insultos fuertes, lenguaje ofensivo, demasiado dudoso, spam, promocional agresivo, datos personales sensibles, incoherente.
APPROVED: locales, comida, agenda cultural, peñas, teatro, turismo, comentarios normales de Salta.`;

function normalizeCategories(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').toLowerCase().trim())
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Clasifica texto con Groq. Si no hay key, skipped=true.
 */
export async function classifyContent(text) {
  const client = getClient();
  if (!client) {
    return { skipped: true, reason: 'Groq no configurada' };
  }

  try {
    const raw = await createTextCompletion({
      temperature: 0.1,
      messages: [
        { role: 'system', content: CLASSIFY_SYSTEM },
        { role: 'user', content: String(text || '').slice(0, 8000) },
      ],
    });
    const parsed = parseJsonResponse(raw);
    const status = String(parsed.status || 'APPROVED').toUpperCase();
    return {
      skipped: false,
      status: ['APPROVED', 'FLAGGED', 'REJECTED'].includes(status) ? status : 'FLAGGED',
      reason: parsed.reason || '',
      categories: normalizeCategories(parsed.categories),
      confidence: parsed.confidence || 'medium',
      summary: parsed.summary || '',
      raw,
    };
  } catch (error) {
    console.error('[AI] Error clasificando texto:', error.message);
    return { skipped: true, error: true, message: error.message };
  }
}

/**
 * Revisa hasta 5 imágenes. Fallback de modelos si el de visión no está habilitado.
 */
export async function analyzeImages(imageUrls = []) {
  const client = getClient();
  if (!client || !imageUrls.length) {
    return { skipped: true };
  }

  const contents = [];
  for (const url of imageUrls.slice(0, 5)) {
    const part = await toImageContent(url);
    if (part) contents.push(part);
  }
  if (!contents.length) {
    return { skipped: true, reason: 'No se pudieron leer las imágenes' };
  }

  contents.unshift({
    type: 'text',
    text: 'Analizá estas imágenes de una ficha de PANDORA (Salta). Respondé SOLO JSON {"status":"APPROVED"|"FLAGGED"|"REJECTED","reason":"frase corta en español","categories":["sexual"|"violencia"|"estafa"|"spam"|"odio"|"otro"],"confidence":"low"|"medium"|"high","summary":"qué viste"}. REJECTED: sexual, nudez, pornografía, violencia gráfica. FLAGGED: dudoso. APPROVED: locales, comida, eventos, cultura, gente vestida en contextos normales.',
  });

  let lastError = null;
  for (const model of VISION_FALLBACKS) {
    try {
      const completion = await groqChat(client, {
        model,
        temperature: 0.1,
        messages: [{ role: 'user', content: contents }],
      });
      const raw = completion.choices?.[0]?.message?.content || '';
      const parsed = parseJsonResponse(raw);
      const status = String(parsed.status || 'APPROVED').toUpperCase();
      return {
        skipped: false,
        model,
        status: ['APPROVED', 'FLAGGED', 'REJECTED'].includes(status) ? status : 'FLAGGED',
        reason: parsed.reason || '',
        categories: normalizeCategories(parsed.categories),
        confidence: parsed.confidence || 'medium',
        summary: parsed.summary || '',
        imagesChecked: contents.length - 1,
        raw: stripThinking(raw),
      };
    } catch (error) {
      lastError = error;
      if (isModelAccessError(error)) {
        console.warn(`[AI] Modelo de visión no disponible (${model}), probando fallback`);
        continue;
      }
      console.error('[AI] Error analizando imágenes:', error.message);
      return { skipped: true, error: true, message: error.message };
    }
  }

  return { skipped: true, error: true, message: lastError?.message || 'Visión no disponible' };
}

const CHAT_SYSTEM = `Sos el asistente de moderación de PANDORA para administradores.
PANDORA es descubrimiento local de Salta: comercios, eventos, revista y publicidades. No es un e-commerce.
Ayudás a validar altas, interpretar contenido flagged y aplicar políticas con criterio.
Respondé en español, breve y accionable. No inventes datos de la base salvo los que te pasen en el chat.
Nunca muestres razonamiento interno ni etiquetas think.
Si el admin pega un texto dudoso, recomendá APPROVED, FLAGGED o REJECTED y por qué.`;

export async function chatCompletion(messages = [], options = {}) {
  const client = getClient();
  if (!client) {
    throw toPublicAiError(new Error('Groq no configurada'));
  }

  const safeMessages = (Array.isArray(messages) ? messages : [])
    .filter((msg) => msg && ['user', 'assistant'].includes(msg.role) && typeof msg.content === 'string')
    .slice(-20)
    .map((msg) => ({ role: msg.role, content: msg.content.slice(0, 4000) }));

  return createTextCompletion({
    temperature: 0.4,
    messages: [{ role: 'system', content: options.systemPrompt || CHAT_SYSTEM }, ...safeMessages],
  });
}
