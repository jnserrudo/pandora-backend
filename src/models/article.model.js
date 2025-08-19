import prisma from '../db/prismaClient.js';
import { throwError } from '../utils/error.utils.js';
import slugify from 'slugify';

// --- FUNCIONES PÚBLICAS (PARA CONSUMIDORES) ---

/**
 * Obtiene todos los artículos que están publicados.
 * Incluye la categoría a la que pertenecen.
 * @returns {Promise<Array>} Lista de artículos publicados.
 */
export const getAllPublishedArticlesModel = async () => {
    return prisma.article.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        include: {
            category: {
                select: {
                    name: true,
                    slug: true,
                },
            },
        },
    });
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
    // Un usuario público solo puede ver artículos publicados.
    if (!article || article.status !== 'PUBLISHED') {
        throwError('Article not found or is not published.', 404);
    }
    return article;
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
        throwError('Title is required to create an article.', 400);
    }
    
    // Generamos un slug único a partir del título.
    const slug = slugify(title, { lower: true, strict: true });

    // Verificamos si ya existe un artículo con ese slug
    const existingArticle = await prisma.article.findUnique({ where: { slug } });
    if (existingArticle) {
        throwError('An article with this title already exists, resulting in a duplicate slug.', 409);
    }

    return prisma.article.create({
        data: {
            title,
            slug,
            ...articleData,
        },
    });
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
        return await prisma.article.update({
            where: { id: parseInt(id) },
            data,
        });
    } catch (error) {
        if (error.code === 'P2025') { // "Registro no encontrado"
            throwError('Article not found.', 404);
        }
        if (error.code === 'P2002') { // "Constraint único falló" (slug duplicado)
            throwError('The updated title creates a duplicate slug.', 409);
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
        await prisma.article.delete({
            where: { id: parseInt(id) },
        });
    } catch (error) {
        if (error.code === 'P2025') {
            throwError('Article not found.', 404);
        }
        throw error;
    }
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



/**
 * Crea una nueva categoría de artículo.
 * @param {object} data - Datos, ej. { name: 'Nueva Categoría' }
 */
export const createCategoryModel = async (data) => {
    const { name } = data;
    if (!name) throwError('Category name is required.', 400);

    const slug = slugify(name, { lower: true, strict: true });
    const existingCategory = await prisma.articleCategory.findFirst({
        where: { OR: [{ name }, { slug }] }
    });
    if (existingCategory) throwError('A category with this name or slug already exists.', 409);

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
        if (error.code === 'P2025') throwError('Category not found.', 404);
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