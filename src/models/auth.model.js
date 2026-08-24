import prisma from "../db/prismaClient.js";
import bcrypt from "bcryptjs";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.utils.js";

import { verifyTurnstileToken, generateOTP } from "../utils/captcha.util.js";

const throwError = (message, statusCode, extra = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  throw error;
};

export const registerUserService = async (userData) => {
  const { email, username, password, name, captchaToken } = userData;
  
  const isValidCaptcha = await verifyTurnstileToken(captchaToken);
  if (!isValidCaptcha) {
    throwError("Validación de captcha fallida.", 400);
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    throwError("La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.", 400);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.toLowerCase().trim();
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
  });

  if (existingUser) {
    const message =
      existingUser.email === normalizedEmail
        ? "El email ya está en uso."
        : "El nombre de usuario ya existe.";
    throwError(message, 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await prisma.user.create({
    data: { 
      email: normalizedEmail, 
      username: normalizedUsername, 
      name, 
      password: hashedPassword,
      isVerified: false
    },
  });

  const otpCode = generateOTP();
  await prisma.verificationToken.create({
    data: {
      userId: newUser.id,
      token: otpCode,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    }
  });

  const { password: _, ...userWithoutPassword } = newUser;
  return { user: userWithoutPassword, otpCode };
};

export const loginUserService = async (identifier, password, captchaToken) => {
  const normalizedIdentifier = identifier.toLowerCase().trim();

  // Captcha siempre (en test / SKIP_CAPTCHA / dev sin secret el util lo saltea)
  const isValidCaptcha = await verifyTurnstileToken(captchaToken);
  if (!isValidCaptcha) {
    throwError("Completá el captcha para entrar.", 400, { requireCaptcha: true });
  }

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }] },
  });

  if (!user) {
    throwError("Credenciales inválidas.", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: { increment: 1 } },
    });
    throwError("Credenciales inválidas.", 401);
  }

  // Resetear intentos fallidos al validar contraseña correcta
  if (user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0 }
    });
  }

  // Si requiere verificación de cuenta
  if (!user.isVerified) {
    throwError("Cuenta no verificada. Revisa tu email.", 403, { isVerified: false });
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
    data: { 
      refreshToken,
      failedLoginAttempts: 0 // Reset fallos
    },
  });

  return { accessToken, refreshToken };
};

export const refreshAccessTokenService = async (token) => {
  if (!token) {
    throwError("Se requiere el Refresh Token.", 401);
  }

  const result = verifyRefreshToken(token);
  if (!result.valid) {
    throwError("Refresh Token inválido o expirado.", 403);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: result.payload.id,
      refreshToken: token,
    },
  });

  if (!user) {
    throwError("El Refresh Token no es válido o ha sido revocado.", 403);
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
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  } catch (error) {
    if (error.code !== 'P2025') throw error;
  }
};

export const verifyOTPService = async (email, otp) => {
  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase().trim() } });
  if (!user) throwError("Usuario no encontrado", 404);

  const record = await prisma.verificationToken.findFirst({
    where: { userId: user.id, token: otp },
    orderBy: { createdAt: 'desc' }
  });

  if (!record || new Date() > record.expiresAt) {
    throwError("Código inválido o expirado", 400);
  }

  await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
  await prisma.verificationToken.deleteMany({ where: { userId: user.id } });
  return { success: true };
};

/**
 * Genera un nuevo OTP y lo guarda para reenvío
 */
export const resendOTPService = async (email) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findFirst({ where: { email: normalizedEmail } });
  
  if (!user) {
    throwError("Usuario no encontrado", 404);
  }

  // Verificar si el usuario ya está verificado
  if (user.isVerified) {
    throwError("La cuenta ya está verificada", 400);
  }

  // Limpiar tokens anteriores del usuario
  await prisma.verificationToken.deleteMany({ where: { userId: user.id } });

  // Generar nuevo OTP
  const otpCode = generateOTP();
  await prisma.verificationToken.create({
    data: {
      userId: user.id,
      token: otpCode,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutos
    }
  });

  const { password: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, otpCode };
};
