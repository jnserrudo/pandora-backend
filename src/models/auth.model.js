import prisma from "../db/prismaClient.js";
import bcrypt from "bcryptjs";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.utils.js";

const throwError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

export const registerUserService = async (userData) => {
  const { email, username, password, name } = userData;
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existingUser) {
    const message =
      existingUser.email === email
        ? "Email already in use."
        : "Username already exists.";
    throwError(message, 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: { email, username, name, password: hashedPassword },
  });

  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
};

export const loginUserService = async (identifier, password) => {
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
  });

  if (!user) {
    throwError("Invalid credentials.", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throwError("Invalid credentials.", 401);
  }

  const accessTokenPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  const refreshTokenPayload = { id: user.id };

  const accessToken = generateAccessToken(accessTokenPayload);
  const refreshToken = generateRefreshToken(refreshTokenPayload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return { accessToken, refreshToken };
};

export const refreshAccessTokenService = async (token) => {
  if (!token) {
    throwError("Refresh Token is required.", 401);
  }

  const decoded = verifyRefreshToken(token);
  if (!decoded) {
    throwError("Invalid or expired Refresh Token.", 403);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: decoded.id,
      refreshToken: token,
    },
  });

  if (!user) {
    throwError("Refresh Token is not valid or has been revoked.", 403);
  } // 1. Genera un NUEVO Access Token

  const newAccessTokenPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
  };
  
  // 1. Genera un NUEVO Access Token
  const newAccessToken = generateAccessToken(newAccessTokenPayload);

  // 2. Genera un NUEVO Refresh Token
  const newRefreshToken = generateRefreshToken({ id: user.id }); 
  
  // 3. Actualiza el token en la base de datos
  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: newRefreshToken },
  }); 

  // 4. Devuelve AMBOS tokens al cliente
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logoutUserService = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
};
