import { describe, it, expect } from '@jest/globals';
import { stripThinking } from '../src/services/ai.service.js';

describe('stripThinking', () => {
  it('saca bloques thinking de Llama', () => {
    expect(stripThinking('<thinking>interno</thinking>\n{"status":"APPROVED"}')).toBe('{"status":"APPROVED"}');
  });

  it('saca el think de Qwen y deja solo la respuesta al usuario', () => {
    const leaked = `<think> Here's a thinking process:

Analyze User Input:
User says: "Qué puedo hacer acá"
Intent: overview
✅ </think>

Acá podés descubrir locales de Salta, sin carrito.`;
    expect(stripThinking(leaked)).toBe('Acá podés descubrir locales de Salta, sin carrito.');
    expect(stripThinking(leaked)).not.toMatch(/think|Analyze User Input/i);
  });
});
