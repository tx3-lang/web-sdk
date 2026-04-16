export type TirEncoding = 'hex' | 'base64';

export interface TirEnvelope {
  content: string;
  encoding: TirEncoding;
  version: string;
}

export type ArgMap = Record<string, unknown>;

export type EnvMap = Record<string, unknown>;
