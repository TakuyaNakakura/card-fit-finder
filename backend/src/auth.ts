import crypto from "node:crypto";

const SESSION_COOKIE_NAME = "cc_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface SessionCookieOptions {
  secure?: boolean;
}

interface SessionPayload {
  username: string;
  expiresAt: number;
}

function base64urlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function base64urlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), candidate);
}

export function createSessionToken(
  username: string,
  secret: string,
  now = Date.now()
): string {
  const payload: SessionPayload = {
    username,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000
  };
  const encoded = base64urlEncode(JSON.stringify(payload));
  const signature = signValue(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now()
): SessionPayload | null {
  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expected = signValue(encoded, secret);

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  const payload = JSON.parse(base64urlDecode(encoded)) as SessionPayload;

  if (payload.expiresAt <= now) {
    return null;
  }

  return payload;
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [key, ...valueParts] = part.trim().split("=");

    if (!key || valueParts.length === 0) {
      return cookies;
    }

    cookies[key] = decodeURIComponent(valueParts.join("="));
    return cookies;
  }, {});
}

export function createSessionCookie(token: string, options: SessionCookieOptions = {}): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Priority=High",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`
  ];

  if (options.secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function clearSessionCookie(options: SessionCookieOptions = {}): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Priority=High",
    "Max-Age=0"
  ];

  if (options.secure) {
    attributes.push("Secure");
  }

  return attributes.join("; ");
}

export function readSessionToken(cookieHeader: string | undefined): string | undefined {
  return parseCookieHeader(cookieHeader)[SESSION_COOKIE_NAME];
}
