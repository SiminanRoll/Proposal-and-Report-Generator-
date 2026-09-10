const STORAGE_CODEC_PREFIX = "cc-lzw1:";
const COMPRESSION_THRESHOLD = 96 * 1024;
const MAX_DICTIONARY_CODE = 0xffff;
const BASE64_CHUNK_SIZE = 0x8000;

function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const end = Math.min(bytes.length, offset + BASE64_CHUNK_SIZE);
    let chunk = "";
    for (let index = offset; index < end; index += 1) chunk += String.fromCharCode(bytes[index]);
    parts.push(chunk);
  }
  return globalThis.btoa(parts.join(""));
}

function base64ToBytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index) & 0xff;
  return bytes;
}

/**
 * Compress large project JSON synchronously so the existing project-store API can
 * stay synchronous. The codec operates on UTF-8 bytes and writes 16-bit LZW
 * codes as base64. Small payloads remain plain JSON for faster reads/writes.
 */
export function encodeProjectStorage(raw: string): string {
  if (!raw || raw.length < COMPRESSION_THRESHOLD) return raw;

  const input = new TextEncoder().encode(raw);
  if (!input.length) return raw;

  const dictionary = new Map<number, number>();
  let nextCode = 256;
  let phraseCode = input[0];
  const codes = new Uint16Array(input.length);
  let codeCount = 0;

  for (let index = 1; index < input.length; index += 1) {
    const byte = input[index];
    const key = phraseCode * 256 + byte;
    const found = dictionary.get(key);
    if (found !== undefined) {
      phraseCode = found;
      continue;
    }

    codes[codeCount] = phraseCode;
    codeCount += 1;
    if (nextCode <= MAX_DICTIONARY_CODE) {
      dictionary.set(key, nextCode);
      nextCode += 1;
    }
    phraseCode = byte;
  }

  codes[codeCount] = phraseCode;
  codeCount += 1;

  const packed = new Uint8Array(codeCount * 2);
  for (let index = 0; index < codeCount; index += 1) {
    const code = codes[index];
    packed[index * 2] = code >>> 8;
    packed[index * 2 + 1] = code & 0xff;
  }

  const encoded = `${STORAGE_CODEC_PREFIX}${bytesToBase64(packed)}`;
  return encoded.length < raw.length ? encoded : raw;
}

export function decodeProjectStorage(value: string): string {
  if (!value.startsWith(STORAGE_CODEC_PREFIX)) return value;

  const packed = base64ToBytes(value.slice(STORAGE_CODEC_PREFIX.length));
  if (!packed.length || packed.length % 2 !== 0) throw new Error("Compressed project storage is invalid.");

  const firstCode = (packed[0] << 8) | packed[1];
  if (firstCode > 255) throw new Error("Compressed project storage has an invalid first code.");

  const dictionary: Array<string | undefined> = new Array(MAX_DICTIONARY_CODE + 1);
  for (let code = 0; code < 256; code += 1) dictionary[code] = String.fromCharCode(code);

  let nextCode = 256;
  let previous = dictionary[firstCode]!;
  const output: string[] = [previous];

  for (let offset = 2; offset < packed.length; offset += 2) {
    const code = (packed[offset] << 8) | packed[offset + 1];
    let entry = dictionary[code];
    if (entry === undefined) {
      if (code !== nextCode) throw new Error("Compressed project storage contains an unknown code.");
      entry = previous + previous.charAt(0);
    }

    output.push(entry);
    if (nextCode <= MAX_DICTIONARY_CODE) {
      dictionary[nextCode] = previous + entry.charAt(0);
      nextCode += 1;
    }
    previous = entry;
  }

  const binary = output.join("");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index) & 0xff;
  return new TextDecoder().decode(bytes);
}

export function isCompressedProjectStorage(value: string | null): boolean {
  return Boolean(value?.startsWith(STORAGE_CODEC_PREFIX));
}
