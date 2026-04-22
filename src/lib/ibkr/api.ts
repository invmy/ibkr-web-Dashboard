import { createLiveSessionToken, type IbkrConfig } from "./lst";
import {
  encodeOAuthParam,
  signOauthHmac256,
  generateOAuthHeader,
} from "./crypto";
import { getSecret } from "astro:env/server";

let cachedSession: any = null;

export async function login() {
  const config: IbkrConfig = {
    consumerKey: getSecret("OAUTH_CONSUMER_KEY")!,
    accessToken: getSecret("IBKR_KEY")!,
    accessTokenSecret: getSecret("IBKR_KEY_TOKEN")!,
    dhParamPemBase64: getSecret("IBKR_DHPARAM")!,
    encryptionKeyPemBase64: getSecret("IBKR_PRIVATE_ENCRYPTION")!,
    signatureKeyPemBase64: getSecret("IBKR_PRIVATE_SIGNATURE")!,
  };

  const result = await createLiveSessionToken(config);
  cachedSession = {
    token: result.liveSessionToken,
    consumerKey: config.consumerKey,
    accessToken: config.accessToken,
    expires: result.lstExpiration,
  };
  return cachedSession;
}

export async function executeIbkrRequest(
  method: string,
  endpoint: string,
  body?: any,
) {
  if (!cachedSession || Date.now() >= cachedSession.expires) {
    cachedSession = await login();
  }
  const session = cachedSession;

  const baseUrl = "api.ibkr.com";
  // Check if endpoint already includes /v1/api or /iserver
  const pathPart = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `https://${baseUrl}/v1/api${pathPart}`;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: session.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA256",
    oauth_timestamp: timestamp,
    oauth_token: session.accessToken,
  };

  const paramsString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${k}=${oauthParams[k]}`)
    .join("&");

  const baseString =
    method + "&" + encodeOAuthParam(url) + "&" + encodeOAuthParam(paramsString);
  const signatureBase64 = signOauthHmac256(baseString, session.token);

  oauthParams["oauth_signature"] = encodeOAuthParam(signatureBase64);
  const realm =
    session.consumerKey === "TESTCONS" ? "test_realm" : "limited_poa";
  oauthParams["realm"] = realm;

  const oauthHeader = generateOAuthHeader(oauthParams);

  const headers: any = {
    Authorization: oauthHeader,
    "User-Agent": "astro/6.0",
    Accept: "*/*",
    "Accept-Encoding": "gzip,deflate",
    Connection: "keep-alive",
    Host: baseUrl,
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `IBKR API Error ${response.status} at ${endpoint}: ${text}`,
    );
  }

  return response.json();
}

export async function getAccounts() {
  return executeIbkrRequest("GET", "/portfolio/accounts");
}

export async function getLedger(accountId: string) {
  return executeIbkrRequest("GET", `/portfolio/${accountId}/ledger`);
}

export async function getPositions(accountId: string) {
  return executeIbkrRequest("GET", `/portfolio/${accountId}/positions/0`);
}
