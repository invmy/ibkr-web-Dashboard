import {
  parseDHParam,
  generateDHRandom,
  computeDHChallenge,
  decryptTokenSecret,
  signOauth,
  computeLST,
  generateOAuthHeader,
  encodeOAuthParam,
  validateLST,
} from "./crypto";

export interface IbkrConfig {
  consumerKey: string;
  accessToken: string;
  accessTokenSecret: string;
  dhParamPemBase64: string;
  encryptionKeyPemBase64: string;
  signatureKeyPemBase64: string;
}

export async function createLiveSessionToken(config: IbkrConfig) {
  const { p, g } = parseDHParam(config.dhParamPemBase64);
  const dhRandom = generateDHRandom();
  const dhChallenge = computeDHChallenge(p, g, dhRandom);

  const { prependHex } = decryptTokenSecret(
    config.accessTokenSecret,
    config.encryptionKeyPemBase64,
  );

  const baseUrl = "api.ibkr.com";
  const method = "POST";
  const url = `https://${baseUrl}/v1/api/oauth/live_session_token`;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: config.consumerKey,
    oauth_nonce: nonce,
    oauth_timestamp: timestamp,
    oauth_token: config.accessToken,
    oauth_signature_method: "RSA-SHA256",
    diffie_hellman_challenge: dhChallenge,
  };

  const paramsString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${k}=${oauthParams[k]}`)
    .join("&");

  const baseString =
    prependHex +
    method +
    "&" +
    encodeOAuthParam(url) +
    "&" +
    encodeOAuthParam(paramsString);

  const signatureBase64 = signOauth(baseString, config.signatureKeyPemBase64);

  oauthParams["oauth_signature"] = encodeOAuthParam(signatureBase64);

  const realm = config.consumerKey === "TESTCONS" ? "test_realm" : "limited_poa";
  oauthParams["realm"] = realm;

  const oauthHeader = generateOAuthHeader(oauthParams);

  const headers = {
    Authorization: oauthHeader,
    "User-Agent": "astro/6.0",
    Accept: "*/*",
    "Accept-Encoding": "gzip,deflate",
    Connection: "keep-alive",
    Host: "api.ibkr.com",
  };

  const response = await fetch(url, {
    method,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LST request failed: ${response.status} - ${text}`);
  }

  const responseData = await response.json();
  const dhResponse = responseData.diffie_hellman_response;
  const lstSignature = responseData.live_session_token_signature;
  const lstExpiration = responseData.live_session_token_expiration;

  const computedLst = computeLST(dhResponse, dhRandom, p, prependHex);
  const isValid = validateLST(computedLst, config.consumerKey, lstSignature);

  return {
    liveSessionToken: computedLst,
    lstSignature,
    lstExpiration,
    isValid,
  };
}
