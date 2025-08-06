import prisma from '../db/prismaClient.js';
import slugify from 'slugify'; // Recordatorio: npm install slugify

const throwError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
};

export const createArticeModel = async (data) => {
    const { title, subtitle, content, coverImage, status, category, authorName } = data;
    const slug = slugify(title, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
    if (await prisma.article.findUnique({ where: { slug } })) {
        throwError('An article with this title already exists, resulting in a duplicate slug.', 409);
    }
    return prisma.article.create({ data: { title, slug, subtitle, content, coverImage, status, category, authorName } });
};

export const getAllArticlesModel = async () => {
    return prisma.article.findMany({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' } });
};

export const getArticleBySlugModel = async (slug) => {
    const article = await prisma.article.findUnique({ where: { slug } });
    if (!article) throwError('Article not found.', 404);
    return article;
};

export const updateArticleModel = async (id, data) => {
    if (data.title) data.slug = slugify(data.title, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
    try {
        return await prisma.article.update({ where: { id: parseInt(id) }, data });
    } catch (error) {
        if (error.code === 'P2025') throwError('Article not found.', 404);
        if (error.code === 'P2002') throwError('The updated title creates a duplicate slug.', 409);
        throw error;
    }
};

export const deleteArticleModel = async (id) => {
    try {
        await prisma.article.delete({ where: { id: parseInt(id) } });
    } catch (error) {
        if (error.code === 'P2025') throwError('Article not found.', 404);
        throw error;
    }
};