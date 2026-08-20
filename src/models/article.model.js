import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
import slugify from 'slugify';
import { moderateContent, attachModerationResource, collectImageUrls } from '../services/moderation.service.js';

// --- FUNCIONES PÚBLICAS (PARA CONSUMIDORES) ---

/**
 * Obtiene todos los artículos que están publicados.
 * Incluye la categoría a la que pertenecen.
 * @returns {Promise<Array>} Lista de artículos publicados.
 */
export const getAllPublishedArticlesModel = async (options = {}) => {
    const { page = 1, limit = 10, sortBy = 'recent' } = options;
    const skip = (page - 1) * limit;
    // Por ahora 'popular' no tiene métrica definida, usamos createdAt desc por defecto
    const orderBy = { createdAt: 'desc' };

    const [articles, total] = await Promise.all([
        prisma.article.findMany({
            where: { 
                status: 'PUBLISHED',
                isActive: true
            },
            orderBy,
            skip,
            take: limit,
            include: {
                category: {
                    select: {
                        name: true,
                        slug: true,
                    },
                },
            },
        }),
        prisma.article.count({ where: { status: 'PUBLISHED', isActive: true } })
    ]);

    return { articles, total };
};

/**
 * Obtiene un solo artículo publicado por su slug.
 * @param {string} slug - El slug del artículo.
 * @returns {Promise<Object>} El objeto del artículo.
 */
export const getArticleBySlugModel = async (slug) => {
    const article = await prisma.article.findUnique({
        where: { slug: slug },
        include: {
            category: true,
        },
    });
    // Un usuario público solo puede ver artículos publicados y que no estén eliminados lógicamente.
    if (!article || article.status !== 'PUBLISHED' || !article.isActive) {
        throwError('Artículo no encontrado o no publicado.', 404);
    }

    const related = await prisma.article.findMany({
        where: {
            status: 'PUBLISHED',
            isActive: true,
            id: { not: article.id },
        },
        select: {
            id: true,
            slug: true,
            title: true,
            subtitle: true,
            coverImage: true,
            authorName: true,
            createdAt: true,
            category: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
    });

    return { ...article, related };
};

// --- FUNCIONES PROTEGIDAS (PARA ADMINS) ---

/**
 * Crea un nuevo artículo. Genera el slug automáticamente.
 * @param {object} data - Datos del artículo.
 * @returns {Promise<Object>} El nuevo artículo creado.
 */
export const createArticleModel = async (data) => {
    const { title, ...articleData } = data;
    if (!title) {
        throwError('El título es requerido para crear un artículo.', 400);
    }
    
    // Generamos un slug único a partir del título.
    const slug = slugify(title, { lower: true, strict: true });

    // Verificamos si ya existe un artículo con ese slug
    const existingArticle = await prisma.article.findUnique({ where: { slug } });
    if (existingArticle) {
        throwError('Ya existe un artículo con este título (slug duplicado).', 409);
    }

    const moderationResult = await moderateContent(
        `${title}\n${articleData.subtitle || ''}\n${articleData.content || ''}`,
        'ARTICLE',
        null,
        collectImageUrls(articleData)
    );

    const created = await prisma.article.create({
        data: {
            title,
            slug,
            ...articleData,
        },
    });
    await attachModerationResource(moderationResult.logId, created.id);
    return created;
};

/**
 * Actualiza un artículo por su ID.
 * @param {number} id - ID del artículo.
 * @param {object} data - Datos a actualizar.
 * @returns {Promise<Object>} El artículo actualizado.
 */
export const updateArticleModel = async (id, data) => {
    try {
        // Si el título cambia, regeneramos el slug.
        if (data.title) {
            data.slug = slugify(data.title, { lower: true, strict: true });
        }
        const textToAnalyze = `${data.title || ''}\n${data.subtitle || ''}\n${data.content || ''}`.trim();
        const images = collectImageUrls(data);
        if (textToAnalyze || images.length) {
            await moderateContent(
                textToAnalyze || '(solo imágenes)',
                'ARTICLE',
                parseInt(id),
                images,
                { fieldsAnalyzed: ['title', 'subtitle', 'content', 'imágenes'] }
            );
        }
        return await prisma.article.update({
            where: { id: parseInt(id) },
            data,
        });
    } catch (error) {
        if (error.code === 'P2025') { // "Registro no encontrado"
            throwError('Artículo no encontrado.', 404);
        }
        if (error.code === 'P2002') { // "Constraint único falló" (slug duplicado)
            throwError('El título actualizado genera un slug duplicado.', 409);
        }
        throw error;
    }
};

/**
 * Elimina un artículo por su ID.
 * @param {number} id - ID del artículo.
 */
export const deleteArticleModel = async (id) => {
    try {
        await prisma.article.update({
            where: { id: parseInt(id) },
            data: { isActive: false }
        });
    } catch (error) {
        if (error.code === 'P2025') {
            throwError('Artículo no encontrado.', 404);
        }
        throw error;
    }
};

/**
 * Actualiza el estado isActive de un artículo (solo ADMIN).
 */
export const updateArticleStatusModel = async (id, isActive) => {
    return prisma.article.update({
        where: { id: parseInt(id) },
        data: { isActive }
    });
};


export const getAllCategoriesModel = async () => {
    return prisma.articleCategory.findMany({
        orderBy: { name: 'asc' },
    });
};

export const getAllArticlesForAdminModel = async () => {
    return prisma.article.findMany({
        orderBy: { createdAt: 'desc' },
        include: { category: { select: { name: true } } },
    });
};

export const getArticleByIdForAdminModel = async (id) => {
    return prisma.article.findUnique({
        where: { id: parseInt(id) },
        include: { category: { select: { id: true, name: true, slug: true } } },
    });
};



/**
 * Crea una nueva categoría de artículo.
 * @param {object} data - Datos, ej. { name: 'Nueva Categoría' }
 */
export const createCategoryModel = async (data) => {
    const { name } = data;
    if (!name) throwError('El nombre de la categoría es requerido.', 400);

    const slug = slugify(name, { lower: true, strict: true });
    const existingCategory = await prisma.articleCategory.findFirst({
        where: { OR: [{ name }, { slug }] }
    });
    if (existingCategory) throwError('Ya existe una categoría con este nombre o slug.', 409);

    return prisma.articleCategory.create({ data: { name, slug } });
};

/**
 * Actualiza una categoría de artículo por su ID.
 * @param {number} id - ID de la categoría.
 * @param {object} data - Datos a actualizar.
 */
export const updateCategoryModel = async (id, data) => {
    if (data.name) {
        data.slug = slugify(data.name, { lower: true, strict: true });
    }
    try {
        return await prisma.articleCategory.update({
            where: { id: parseInt(id) },
            data,
        });
    } catch (error) {
        if (error.code === 'P2025') throwError('Categoría no encontrada.', 404);
        throw error;
    }
};

/**
 * Elimina una categoría de artículo por su ID.
 * @param {number} id - ID de la categoría.
 */
export const deleteCategoryModel = async (id) => {
    // Verificación: No permitir borrar si la categoría tiene artículos
    const categoryWithArticles = await prisma.articleCategory.findUnique({
        where: { id: parseInt(id) },
        include: { articles: true },
    });
    if (!categoryWithArticles) throwError('Category not found.', 404);
    if (categoryWithArticles.articles.length > 0) {
        throwError('Cannot delete category because it is associated with articles.', 400);
    }

    await prisma.articleCategory.delete({ where: { id: parseInt(id) } });
};