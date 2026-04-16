export interface BytesEnvelope {
  content: string;
  contentType: string;
}

export function hexToBytes(input: string): Uint8Array {
  const clean = input.startsWith('0x') ? input.slice(2) : input;
  if (clean.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(clean)) {
    throw new Error(`invalid hex string: ${input}`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    out[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += b.toString(16).padStart(2, '0');
  }
  return out;
}

export function base64ToBytes(input: string): Uint8Array {
  const binary =
    typeof atob === 'function'
      ? atob(input)
      : Buffer.from(input, 'base64').toString('binary');
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function bytesEnvelopeFromHex(bytes: Uint8Array): BytesEnvelope {
  return { content: bytesToHex(bytes), contentType: 'hex' };
}

export function readBytesEnvelope(envelope: BytesEnvelope): Uint8Array {
  const kind = envelope.contentType;
  if (kind === 'hex' || kind === 'application/hex') return hexToBytes(envelope.content);
  if (kind === 'base64' || kind === 'application/base64') return base64ToBytes(envelope.content);
  throw new Error(`unknown BytesEnvelope contentType: ${kind}`);
}
