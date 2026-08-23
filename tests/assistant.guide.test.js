import { describe, it, expect } from '@jest/globals';
import { detectIntent, itemsFor } from '../src/services/assistant.guide.js';

const catalog = {
  commerces: [
    {
      id: 'commerce-1',
      type: 'commerce',
      label: 'La Casona de Salta',
      hint: 'Gastronomía',
      meta: 'Caseros 100',
      category: 'GASTRONOMIA',
      searchText: 'La Casona de Salta Cocina regional Caseros GASTRONOMIA',
      to: '/commerce/1',
    },
    {
      id: 'commerce-2',
      type: 'commerce',
      label: 'Bar El Solar',
      hint: 'Vida nocturna',
      category: 'VIDA_NOCTURNA',
      searchText: 'Bar El Solar tragos VIDA_NOCTURNA',
      to: '/commerce/2',
    },
  ],
  events: [
    {
      id: 'event-9',
      type: 'event',
      label: 'Peña del viernes',
      hint: 'vie 21:00',
      searchText: 'Peña del viernes folklore',
      to: '/event/9',
    },
  ],
  articles: [
    {
      id: 'article-salta',
      type: 'article',
      label: 'Guía de peñas',
      hint: 'Cultura',
      searchText: 'Guía de peñas revista',
      to: '/article/guia-penas',
    },
  ],
};

describe('assistant.guide listados', () => {
  it('detecta pedidos de listar entidades', () => {
    expect(detectIntent('Mostrame comercios')).toBe('list_commerces');
    expect(detectIntent('Mostrame eventos')).toBe('list_events');
    expect(detectIntent('Qué hay en la revista')).toBe('list_articles');
    expect(detectIntent('Recomendame algo')).toBe('discover');
  });

  it('lista comercios cuando lo piden', () => {
    const items = itemsFor('list_commerces', catalog, 'Mostrame comercios');
    expect(items.map((item) => item.label)).toEqual(['La Casona de Salta', 'Bar El Solar']);
  });

  it('filtra por rubro si lo piden', () => {
    const items = itemsFor('list_commerces', catalog, 'dónde comer');
    expect(items.map((item) => item.label)).toEqual(['La Casona de Salta']);
  });

  it('lista eventos cuando lo piden', () => {
    const items = itemsFor('list_events', catalog, 'Mostrame eventos');
    expect(items).toHaveLength(1);
    expect(items[0].to).toBe('/event/9');
  });

  it('encuentra una ficha por nombre aunque no digan el tipo', () => {
    const items = itemsFor('overview', catalog, 'contame de la casona');
    expect(items[0].label).toBe('La Casona de Salta');
  });

  it('lista varios comercios con Mostrame comercios (no uno solo)', () => {
    const items = itemsFor('list_commerces', catalog, 'Mostrame comercios');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('mezcla entidades en descubrir', () => {
    const items = itemsFor('discover', catalog, 'recomendame algo');
    expect(items.some((item) => item.type === 'commerce')).toBe(true);
    expect(items.some((item) => item.type === 'event')).toBe(true);
    expect(items.some((item) => item.type === 'article')).toBe(true);
  });
});
