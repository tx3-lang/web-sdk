import type { TirEnvelope } from '../core/index.js';

export type JsonSchema = Record<string, unknown>;

export interface TiiInfo {
  version: string;
}

export interface ProtocolMetadata {
  name: string;
  version: string;
  scope?: string;
  description?: string;
}

export interface Transaction {
  tir: TirEnvelope;
  params: JsonSchema;
  description?: string;
}

export interface PartySpec {
  description?: string;
}

export interface Profile {
  description?: string;
  environment?: unknown;
  parties?: Record<string, string>;
}

export interface Components {
  schemas?: Record<string, JsonSchema>;
}

export interface TiiFile {
  tii: TiiInfo;
  protocol: ProtocolMetadata;
  environment?: JsonSchema;
  parties?: Record<string, PartySpec>;
  transactions: Record<string, Transaction>;
  profiles?: Record<string, Profile>;
  components?: Components;
}
