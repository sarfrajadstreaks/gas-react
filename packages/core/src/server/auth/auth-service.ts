import type { AuthConfig, EmailConfig } from '../../types/config';

// ─── Token Management ───────────────────────────────────────────────────────

let cachedSecretKey: string | null = null;

function getSecretKey(): string {
  if (cachedSecretKey) return cachedSecretKey;
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty('JWT_SECRET_KEY');
  if (!key) {
    key = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('JWT_SECRET_KEY', key);
  }
  cachedSecretKey = key;
  return key;
}

export interface TokenPayload {
  email: string;
  role: string;
  exp: number;
  iat: number;
}

export function generateAuthToken(email: string, role: string, expiryHours: number): string {
  const payload: TokenPayload = {
    email,
    role,
    exp: Date.now() + expiryHours * 60 * 60 * 1000,
    iat: Date.now(),
  };

  const payloadString = JSON.stringify(payload);
  const payloadBase64 = Utilities.base64Encode(payloadString);
  const signature = Utilities.computeHmacSha256Signature(payloadString, getSecretKey());
  const signatureBase64 = Utilities.base64Encode(signature);

  return `${payloadBase64}.${signatureBase64}`;
}

export function validateAuthToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signatureBase64] = parts;
  const payloadString = Utilities.newBlob(Utilities.base64Decode(payloadBase64)).getDataAsString();
  const payload: TokenPayload = JSON.parse(payloadString);

  if (Date.now() > payload.exp) return null;

  const expectedSignature = Utilities.computeHmacSha256Signature(payloadString, getSecretKey());
  const expectedBase64 = Utilities.base64Encode(expectedSignature);
  if (signatureBase64 !== expectedBase64) return null;

  return payload;
}

export function requireAuth(token: string): TokenPayload {
  const payload = validateAuthToken(token);
  if (!payload) throw new Error('Unauthorized: Invalid or expired token');
  return payload;
}

// ─── OTP ────────────────────────────────────────────────────────────────────

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeOTP(
  email: string,
  otp: string,
  config: AuthConfig
): { success: boolean; message?: string } {
  try {
    const cache = CacheService.getScriptCache();
    const requestKey = `otp_requests_${email}`;
    const requestCount = cache.get(requestKey) || '0';
    const limit = config.otpRequestLimitPerHour ?? 5;

    if (parseInt(requestCount) >= limit) {
      return { success: false, message: 'Too many OTP requests. Please try again later.' };
    }

    const expiry = (config.otpExpiryMinutes ?? 10) * 60;
    cache.put(`otp_${email}`, otp, expiry);
    cache.put(`otp_attempts_${email}`, '0', expiry);
    cache.put(requestKey, (parseInt(requestCount) + 1).toString(), 3600);

    return { success: true };
  } catch (e) {
    return { success: false, message: 'Failed to generate verification code.' };
  }
}

// ─── Email ──────────────────────────────────────────────────────────────────

function sendOTPEmail(
  email: string,
  otp: string,
  authConfig: AuthConfig,
  emailConfig: EmailConfig
): { success: boolean; message?: string } {
  try {
    const appName = emailConfig.appName;
    const icon = emailConfig.headerIcon ?? '🔐';
    const gradStart = emailConfig.gradientStart ?? '#667eea';
    const gradEnd = emailConfig.gradientEnd ?? '#764ba2';
    const expiryMin = authConfig.otpExpiryMinutes ?? 10;

    const subject = `${icon} ${appName} - Login Verification Code`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, ${gradStart} 0%, ${gradEnd} 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 32px;">${icon}</h1>
          <h2 style="color: white; margin: 10px 0 0 0;">${appName}</h2>
        </div>
        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0;">
          <h3 style="color: #333; margin-top: 0;">Your Login Verification Code</h3>
          <p style="color: #666; font-size: 16px;">Enter this code to complete your login:</p>
          <div style="background: #f8f9fa; border: 2px dashed ${gradStart}; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <div style="font-size: 36px; font-weight: bold; color: ${gradStart}; letter-spacing: 8px; font-family: 'Courier New', monospace;">
              ${otp}
            </div>
          </div>
          <p style="color: #999; font-size: 14px;">⏱️ This code will expire in ${expiryMin} minutes.</p>
          <p style="color: #999; font-size: 14px; border-top: 1px solid #e0e0e0; padding-top: 20px; margin-top: 30px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
        <div style="background: #f8f9fa; padding: 15px; text-align: center; color: #999; font-size: 12px;">
          ${appName} - Secure Authentication
        </div>
      </div>
    `;

    const plainBody = `${appName} - Login Verification Code\n\nYour code is: ${otp}\n\nExpires in ${expiryMin} minutes.`;

    MailApp.sendEmail(email, subject, plainBody, { htmlBody });
    return { success: true };
  } catch (e) {
    return { success: false, message: 'Failed to send verification email.' };
  }
}

// ─── Auth Service Factory ───────────────────────────────────────────────────

export interface AuthService {
  login(email: string): { success: boolean; requiresOTP?: boolean; email?: string; status?: string; message: string };
  verifyOTP(email: string, otp: string): { success: boolean; token?: string; message: string };
  validateToken(token: string): TokenPayload | null;
  requireAuth(token: string): TokenPayload;
  getUserRole(token: string): string;
}

/**
 * Create an auth service configured for your app.
 *
 * `checkUserStatus` and `addUserAsInactive` are callbacks so the framework
 * doesn't need to know your users table schema.
 */
export function createAuthService(
  authConfig: AuthConfig,
  emailConfig: EmailConfig,
  callbacks: {
    checkUserStatus: (email: string) => { exists: boolean; isActive: boolean; role?: string };
    addUserAsInactive: (email: string) => void;
  }
): AuthService {
  return {
    login(email: string) {
      if (!email || email.trim() === '') {
        return { success: false, message: 'Email is required' };
      }
      email = email.trim().toLowerCase();

      const status = callbacks.checkUserStatus(email);
      if (!status.exists) {
        callbacks.addUserAsInactive(email);
        return { success: false, status: 'Pending', message: 'Your access request has been submitted.' };
      }
      if (!status.isActive) {
        return { success: false, status: 'Pending', message: 'Your account is pending approval.' };
      }

      const otp = generateOTP();
      const stored = storeOTP(email, otp, authConfig);
      if (!stored.success) return { success: false, message: stored.message! };

      const sent = sendOTPEmail(email, otp, authConfig, emailConfig);
      if (!sent.success) return { success: false, message: sent.message! };

      return { success: true, requiresOTP: true, email, message: 'Verification code sent to your email' };
    },

    verifyOTP(email: string, otp: string) {
      try {
        const cache = CacheService.getScriptCache();
        const attemptsKey = `otp_attempts_${email}`;
        const attempts = parseInt(cache.get(attemptsKey) || '0');
        const maxAttempts = authConfig.otpMaxAttempts ?? 3;

        if (attempts >= maxAttempts) {
          return { success: false, message: 'Too many failed attempts. Request a new code.' };
        }

        const storedOTP = cache.get(`otp_${email}`);
        if (!storedOTP) {
          return { success: false, message: 'Verification code expired. Request a new one.' };
        }

        if (storedOTP !== otp) {
          cache.put(attemptsKey, (attempts + 1).toString(), (authConfig.otpExpiryMinutes ?? 10) * 60);
          return { success: false, message: 'Invalid code. Please try again.' };
        }

        // OTP valid — clean up and issue token
        cache.remove(`otp_${email}`);
        cache.remove(attemptsKey);

        const status = callbacks.checkUserStatus(email);
        const token = generateAuthToken(email, status.role ?? 'User', authConfig.tokenExpiryHours);

        return { success: true, token, message: 'Login successful' };
      } catch {
        return { success: false, message: 'Verification failed. Please try again.' };
      }
    },

    validateToken: validateAuthToken,
    requireAuth,

    getUserRole(token: string): string {
      const payload = validateAuthToken(token);
      return payload?.role ?? '';
    },
  };
}
