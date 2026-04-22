import crypto from 'node:crypto';

// Parses base64 encoded PEM and extracts P and G as hex strings
export function parseDHParam(pemB64: string): { p: string, g: string } {
    let pem = Buffer.from(cleanBase64(pemB64), 'base64').toString().replace(/\r\n/g, '\n');
    const b64 = pem.split('\n').map(l => l.trim()).filter((l: string) => l && !l.startsWith('-')).join('');



    const buf = Buffer.from(b64, 'base64');
    
    let offset = 0;
    if (buf[offset++] !== 0x30) throw new Error('Not sequence');
    let len = buf[offset++];
    if (len & 0x80) {
        const bytes = len & 0x7f;
        len = 0;
        for (let i = 0; i < bytes; i++) len = (len << 8) | buf[offset++];
    }
    
    // integer P
    if (buf[offset++] !== 0x02) throw new Error('Not integer');
    len = buf[offset++];
    if (len & 0x80) {
        const bytes = len & 0x7f;
        len = 0;
        for (let i = 0; i < bytes; i++) len = (len << 8) | buf[offset++];
    }
    const p = buf.subarray(offset, offset + len).toString('hex');
    offset += len;
    
    // integer G
    if (buf[offset++] !== 0x02) throw new Error('Not integer');
    len = buf[offset++];
    if (len & 0x80) {
        const bytes = len & 0x7f;
        len = 0;
        for (let i = 0; i < bytes; i++) len = (len << 8) | buf[offset++];
    }
    const g = buf.subarray(offset, offset + len).toString('hex');
    
    return { p, g };
}

// Modexp for bigint
export function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let res = 1n;
    base = base % mod;
    while (exp > 0n) {
        if (exp % 2n === 1n) res = (res * base) % mod;
        exp = exp / 2n;
        base = (base * base) % mod;
    }
    return res;
}

export function generateDHRandom(): bigint {
    return BigInt('0x' + crypto.randomBytes(32).toString('hex'));
}

export function computeDHChallenge(pHex: string, gHex: string, random: bigint): string {
    const p = BigInt('0x' + pHex);
    const g = BigInt('0x' + gHex);
    let result = modPow(g, random, p).toString(16);
    return result;
}

function cleanBase64(b64: string): string {
    return b64.replace(/[^A-Za-z0-9+/=]/g, '');
}

export function decryptTokenSecret(b64Secret: string, privateEncryptionB64: string): { prependHex: string, prependStr: string } {
    let cleanedB64 = cleanBase64(privateEncryptionB64);
    let pem = Buffer.from(cleanedB64, 'base64').toString().replace(/\r\n/g, '\n').trim();
    try {
        const secretBuf = Buffer.from(cleanBase64(b64Secret), 'base64');
        const decrypted = crypto.privateDecrypt({
            key: pem,
            padding: crypto.constants.RSA_PKCS1_PADDING
        }, secretBuf);
        
        return {
            prependHex: decrypted.toString('hex'),
            prependStr: decrypted.toString('binary')
        };
    } catch (e: any) {
        console.error('[Crypto] decryptTokenSecret failed:', e.message);
        throw e;
    }
}

export function signOauth(baseString: string, privateSignatureB64: string): string {
    let pem = Buffer.from(cleanBase64(privateSignatureB64), 'base64').toString().replace(/\r\n/g, '\n').trim();
    try {
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(baseString, 'utf8');
        const signature = sign.sign(pem);
        return signature.toString('base64');
    } catch (e: any) {
        console.error('[Crypto] signOauth failed:', e.message);
        throw e;
    }
}



export function signOauthHmac256(baseString: string, lstBase64: string): string {
    const key = Buffer.from(lstBase64, 'base64');
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(baseString, 'utf8');
    return hmac.digest('base64');
}

export function computeLST(dhResponseHex: string, dhRandom: bigint, pHex: string, prependHex: string): string {
    let B = BigInt('0x' + dhResponseHex);
    let a = dhRandom;
    let p = BigInt('0x' + pHex);
    
    let K = modPow(B, a, p);
    let hexStrK = K.toString(16);
    if (hexStrK.length % 2 !== 0) {
        hexStrK = "0" + hexStrK;
    }
    
    let hexBytesK = Buffer.from(hexStrK, 'hex');
    
    let binK = K.toString(2);
    if (binK.length % 8 === 0) {
        hexBytesK = Buffer.concat([Buffer.alloc(1), hexBytesK]);
    }
    
    const prependBytes = Buffer.from(prependHex, 'hex');
    
    const hmac = crypto.createHmac('sha1', hexBytesK);
    hmac.update(prependBytes);
    return hmac.digest('base64');
}

export function generateOAuthHeader(oauthParams: Record<string, string>): string {
    const sortedKeys = Object.keys(oauthParams).sort();
    const parts = sortedKeys.map(k => `${k}="${oauthParams[k]}"`);
    return "OAuth " + parts.join(", ");
}

export function encodeOAuthParam(str: string): string {
    return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

export function validateLST(computedLst: string, consumerKey: string, expectedSignature: string): boolean {
    const key = Buffer.from(computedLst, 'base64');
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(Buffer.from(consumerKey, 'utf8'));
    const hex = hmac.digest('hex');
    return hex === expectedSignature;
}
