/**
 * SSO Express route handlers — SAML + OIDC login/callback flows.
 *
 * tRPC isn't the right transport for HTML redirects + 302s, so these
 * handlers are mounted as raw Express routes. They call into the
 * service-layer functions (ssoSaml.ts, ssoOidc.ts, ssoJitProvision.ts)
 * and handle all the redirect/cookie wallop.
 *
 * Wire format:
 *   SAML SP-initiated:
 *     POST /api/sso/saml/:id/login   → build AuthnRequest, redirect
 *     POST /api/sso/saml/:id/callback → verify SAMLResponse, set session
 *
 *   OIDC Authorization Code + PKCE:
 *     GET /api/sso/oidc/:id/login     → build authorize URL, redirect
 *     GET /api/sso/oidc/:id/callback  → exchange code, verify, set session
 */

import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@rakshex/shared-types/const";

import { logger } from "../_core/logger";
import { sdk } from "../_core/sdk";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";
import * as db from "../db";

import { buildAuthnRequest, verifySamlResponse, parseSamlResponse } from "../services/ssoSaml";
import {
  buildAuthorizeUrl,
  generateState,
  generateNonce,
  generateCodeVerifier,
  deriveCodeChallenge,
  exchangeCodeForTokens,
  verifyIdToken,
} from "../services/ssoOidc";
import { jitProvisionUser, ssoOpenId } from "../services/ssoJitProvision";

import type { SamlConfig } from "../services/ssoSaml";
import type { OidcConfig } from "../services/ssoOidc";
import type { SsoProviderRow } from "@rakshex/database";

/* ── Helpers ──────────────────────────────────────────────────────────── */

function assertEnabled(provider: SsoProviderRow | null): asserts provider is SsoProviderRow {
  if (!provider) throw new SsoRouteError("SSO provider not found", 404);
  if (!provider.enabled) throw new SsoRouteError("SSO provider is not enabled", 403);
}

class SsoRouteError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function upsertLocalUser(
  provider: SsoProviderRow,
  openId: string,
  email: string,
  name: string,
) {
  await db.upsertUser({
    openId,
    name,
    email,
    loginMethod: provider.kind === "saml" ? "saml" : "oidc",
    lastSignedIn: new Date(),
  });
}

async function issueSessionCookie(req: Request, res: Response, openId: string, name: string) {
  const sessionToken = await sdk.createSessionToken(openId, {
    name,
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, {
    ...cookieOptions,
    maxAge: ONE_YEAR_MS,
  });
}

/* ── SAML Routes ──────────────────────────────────────────────────────── */

/**
 * POST /api/sso/saml/:id/login
 *
 * SP-initiated SAML login: looks up the provider config, builds a
 * SAML AuthnRequest XML, stores a pending login row (keyed by request ID),
 * and 302 redirects the browser to the IdP's SSO endpoint.
 */
async function handleSamlLogin(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid_provider_id" });
      return;
    }

    const provider = await db.getSsoProvider(id);
    assertEnabled(provider);
    if (provider.kind !== "saml") {
      res.status(400).json({ error: "provider is not SAML" });
      return;
    }

    const config = provider.config as unknown as SamlConfig;
    const authnRequest = buildAuthnRequest(config);

    // Store the pending login row so we can match InResponseTo later
    await db.createSsoLoginRequest({
      state: authnRequest.id,
      providerId: provider.id,
      codeVerifier: authnRequest.id,
      redirectTo: "/dashboard",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
    });

    // For HTTP-Redirect binding: base64-encode the XML
    const encoded = Buffer.from(authnRequest.xml, "utf-8").toString("base64");
    const redirectUrl = `${config.entryPoint}?SAMLRequest=${encodeURIComponent(encoded)}`;

    logger.info(
      { providerId: provider.id, name: provider.name, requestId: authnRequest.id },
      "[SAML] redirecting to IdP",
    );
    res.redirect(302, redirectUrl);
  } catch (err) {
    if (err instanceof SsoRouteError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err }, "[SAML] login error");
    res.redirect(302, "/?error=sso_saml_login_failed");
  }
}

/**
 * POST /api/sso/saml/:id/callback
 *
 * IdP POSTs the SAMLResponse here after authentication. We verify the
 * XML signature, extract user attributes (NameID, email, name), JIT
 * provision, and set a session cookie.
 */
async function handleSamlCallback(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid_provider_id" });
      return;
    }

    const provider = await db.getSsoProvider(id);
    assertEnabled(provider);
    if (provider.kind !== "saml") {
      res.status(400).json({ error: "provider is not SAML" });
      return;
    }

    const config = provider.config as unknown as SamlConfig;
    const samlResponse = req.body?.SAMLResponse as string | undefined;
    if (!samlResponse) {
      res.status(400).json({ error: "missing SAMLResponse in POST body" });
      return;
    }

    // Parse first to extract InResponseTo, then consume the pending login row
    // to prevent SAML response replay attacks.
    const parsed = await parseSamlResponse(samlResponse);
    const expectedInResponseTo = parsed.inResponseTo ?? undefined;

    if (expectedInResponseTo) {
      const pending = await db.consumeSsoLoginRequest(expectedInResponseTo);
      if (!pending || pending.providerId !== id) {
        res.status(403).json({ error: "invalid or expired SAML response — possible replay" });
        return;
      }
    }

    // Full verification — signature, audience, timing, and InResponseTo
    const attributes = await verifySamlResponse(samlResponse, config, {
      clockSkewSec: 60,
      expectedInResponseTo,
    });

    const nameId = attributes.nameId;
    const email = attributes.email ?? `${nameId}@sso.local`;
    const name =
      (attributes.displayName ?? attributes.firstName)
        ? `${attributes.firstName} ${attributes.lastName ?? ""}`.trim()
        : (email.split("@")[0] ?? nameId);

    // JIT provision
    await jitProvisionUser(
      { subject: nameId, email, name },
      { providerId: provider.id, defaultRole: provider.defaultRole ?? "viewer" },
    );

    const openId = ssoOpenId(provider.id, nameId);
    await upsertLocalUser(provider, openId, email, name);
    await issueSessionCookie(req, res, openId, name);

    logger.info({ providerId: provider.id, name, email }, "[SAML] login successful");
    res.redirect(302, "/dashboard");
  } catch (err) {
    if (err instanceof SsoRouteError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err }, "[SAML] callback error");
    res.redirect(302, "/?error=sso_saml_callback_failed");
  }
}

/* ── OIDC Routes ──────────────────────────────────────────────────────── */

/**
 * GET /api/sso/oidc/:id/login
 *
 * Builds the OIDC authorize URL with PKCE (code_challenge + S256),
 * generates a state nonce + code_verifier, stores the pending login row,
 * and 302 redirects to the IdP's /authorize endpoint.
 */
async function handleOidcLogin(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid_provider_id" });
      return;
    }

    const provider = await db.getSsoProvider(id);
    assertEnabled(provider);
    if (provider.kind !== "oidc") {
      res.status(400).json({ error: "provider is not OIDC" });
      return;
    }

    const config = provider.config as unknown as OidcConfig;
    const state = generateState();
    const nonce = generateNonce();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = deriveCodeChallenge(codeVerifier);

    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/sso/oidc/${id}/callback`;

    // Store pending login row for the callback to consume
    await db.createSsoLoginRequest({
      state,
      providerId: provider.id,
      codeVerifier,
      nonce,
      redirectTo: "/dashboard",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const authUrl = buildAuthorizeUrl(config, {
      redirectUri,
      state,
      nonce,
      codeChallenge,
    });

    logger.info({ providerId: provider.id, name: provider.name }, "[OIDC] redirecting to IdP");
    res.redirect(302, authUrl);
  } catch (err) {
    if (err instanceof SsoRouteError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err }, "[OIDC] login error");
    res.redirect(302, "/?error=sso_oidc_login_failed");
  }
}

/**
 * GET /api/sso/oidc/:id/callback
 *
 * The IdP redirects here with `?code=...&state=...` after authentication.
 * We consume the pending login row (exactly once), exchange the code for
 * tokens, verify the id_token JWS signature via JWKS, JIT provision, and
 * set a session cookie.
 */
async function handleOidcCallback(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "invalid_provider_id" });
      return;
    }

    const code = req.query.code as string | undefined;
    const stateParam = req.query.state as string | undefined;
    const errorParam = req.query.error as string | undefined;

    if (errorParam) {
      logger.warn({ error: errorParam }, "[OIDC] IdP returned error");
      res.redirect(302, "/?error=sso_oidc_denied");
      return;
    }

    if (!code || !stateParam) {
      res.status(400).json({ error: "missing code or state parameter" });
      return;
    }

    // Consume the pending login row — one-time use, expires in 5 min
    const pending = await db.consumeSsoLoginRequest(stateParam);
    if (!pending || pending.providerId !== id) {
      res.status(403).json({ error: "invalid or expired state — possible CSRF" });
      return;
    }

    if (!pending.codeVerifier) {
      res.status(400).json({ error: "missing code_verifier in pending request" });
      return;
    }

    const provider = await db.getSsoProvider(id);
    assertEnabled(provider);
    if (provider.kind !== "oidc") {
      res.status(400).json({ error: "provider is not OIDC" });
      return;
    }

    const config = provider.config as unknown as OidcConfig;
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const redirectUri = `${protocol}://${host}/api/sso/oidc/${id}/callback`;

    // Exchange authorization code for tokens
    const tokenSet = await exchangeCodeForTokens(config, {
      redirectUri,
      code,
      codeVerifier: pending.codeVerifier,
    });

    // Verify the id_token cryptographically
    const claims = await verifyIdToken(tokenSet.idToken, config.issuer, config.clientId, {
      expectedNonce: pending.nonce ?? undefined,
    });

    // JIT provision using the verified sub + email claims
    const email = claims.email ?? `${claims.sub}@sso.local`;
    const name = claims.name ?? claims.preferred_username ?? email.split("@")[0] ?? claims.sub;

    await jitProvisionUser(
      { subject: claims.sub, email, name },
      { providerId: provider.id, defaultRole: provider.defaultRole ?? "viewer" },
    );

    const openId = ssoOpenId(provider.id, claims.sub);
    await upsertLocalUser(provider, openId, email, name);
    await issueSessionCookie(req, res, openId, name);

    logger.info({ providerId: provider.id, sub: claims.sub, email }, "[OIDC] login successful");
    res.redirect(302, "/dashboard");
  } catch (err) {
    if (err instanceof SsoRouteError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    logger.error({ err }, "[OIDC] callback error");
    res.redirect(302, "/?error=sso_oidc_callback_failed");
  }
}

/* ── Route registration ───────────────────────────────────────────────── */

export function registerSsoRoutes(app: Express) {
  // SAML
  app.post("/api/sso/saml/:id/login", handleSamlLogin);
  app.post("/api/sso/saml/:id/callback", handleSamlCallback);

  // OIDC
  app.get("/api/sso/oidc/:id/login", handleOidcLogin);
  app.get("/api/sso/oidc/:id/callback", handleOidcCallback);

  logger.info("[SSO] SAML + OIDC routes mounted");
}
