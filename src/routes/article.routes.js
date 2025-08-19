import { Router } from "express";
import {
  getArticles,
  getArticleBySlug,
  createArticle,
  updateArticle,
  deleteArticle,
  getAllArticlesForAdmin,
  getArticleCategories,
} from "../controllers/article.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { authorizeRole } from "../middlewares/authorize.middleware.js";

const router = Router();

// ===============================================
// ==           RUTAS PÚBLICAS (GET)            ==
// ===============================================

router.get("/articles", getArticles);
router.get("/articles/categories", getArticleCategories);
router.get("/articles/:slug", getArticleBySlug);

// ===============================================
// ==         RUTAS PROTEGIDAS (PARA ADMINS)    ==
// ===============================================

// --- RUTA CORREGIDA ---
// Obtiene TODOS los artículos (publicados y borradores) para el panel de gestión
router.get(
  "/articles/manage/all",
  authenticateToken,
  authorizeRole(["ADMIN"]),
  getAllArticlesForAdmin
);

// Crear un nuevo artículo
router.post(
  "/articles",
  authenticateToken,
  authorizeRole(["ADMIN"]),
  createArticle
);

// Actualizar un artículo
router.put(
  "/articles/:id",
  authenticateToken,
  authorizeRole(["ADMIN"]),
  updateArticle
);

// Eliminar un artículo
router.delete(
  "/articles/:id",
  authenticateToken,
  authorizeRole(["ADMIN"]),
  deleteArticle
);

export default router;
