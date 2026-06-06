const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export interface PasskeyCredential {
  id: string;
  rawId: string;
  type: string;
  response: {
    attestationObject?: string;
    clientDataJSON: string;
    authenticatorData?: string;
    signature?: string;
  };
}

export async function startRegistration(): Promise<PublicKeyCredential | null> {
  const response = await fetch(`${API_BASE}/auth/register/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Registration not available");
  }

  const options = await response.json();

  options.challenge = base64URLToBuffer(options.challenge);
  options.user.id = base64URLToBuffer(options.user.id);
  if (options.excludeCredentials) {
    options.excludeCredentials = options.excludeCredentials.map(
      (cred: { id: string; type: string }) => ({
        ...cred,
        id: base64URLToBuffer(cred.id),
      })
    );
  }

  const credential = (await navigator.credentials.create({
    publicKey: options,
  })) as PublicKeyCredential | null;

  if (!credential) return null;

  const attestationResponse =
    credential.response as AuthenticatorAttestationResponse;

  await fetch(`${API_BASE}/auth/register/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: credential.id,
      rawId: bufferToBase64URL(credential.rawId),
      type: credential.type,
      response: {
        attestationObject: bufferToBase64URL(
          attestationResponse.attestationObject
        ),
        clientDataJSON: bufferToBase64URL(attestationResponse.clientDataJSON),
      },
    }),
  });

  return credential;
}

export async function startAuthentication(): Promise<PublicKeyCredential | null> {
  const response = await fetch(`${API_BASE}/auth/login/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Authentication failed (${response.status})`);
  }

  const options = await response.json();

  options.challenge = base64URLToBuffer(options.challenge);
  if (options.allowCredentials) {
    options.allowCredentials = options.allowCredentials.map(
      (cred: { id: string; type: string }) => ({
        ...cred,
        id: base64URLToBuffer(cred.id),
      })
    );
  }

  const credential = (await navigator.credentials.get({
    publicKey: options,
  })) as PublicKeyCredential | null;

  if (!credential) return null;

  const assertionResponse =
    credential.response as AuthenticatorAssertionResponse;

  let verifyResponse: Response;
  try {
    verifyResponse = await fetch(`${API_BASE}/auth/login/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: credential.id,
        rawId: bufferToBase64URL(credential.rawId),
        type: credential.type,
        response: {
          authenticatorData: bufferToBase64URL(
            assertionResponse.authenticatorData
          ),
          clientDataJSON: bufferToBase64URL(assertionResponse.clientDataJSON),
          signature: bufferToBase64URL(assertionResponse.signature),
        },
      }),
    });
  } catch (fetchErr) {
    throw new Error("Network error during verification. Check connection.");
  }

  if (!verifyResponse.ok) {
    const body = await verifyResponse.json().catch(() => ({}));
    throw new Error(body.error || `Verification failed (${verifyResponse.status})`);
  }

  return credential;
}

function base64URLToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
