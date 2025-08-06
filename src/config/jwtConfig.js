// src/config/jwtConfig.js
const jwtConfig = {
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret_key_fallback',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret_key_fallback',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  };
  
  export default jwtConfig;