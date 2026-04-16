import type { ArgMap, BytesEnvelope, EnvMap, TirEnvelope } from '../core/index.js';

export type WitnessType = 'vkey';

export interface TxWitness {
  key: BytesEnvelope;
  signature: BytesEnvelope;
  type: WitnessType;
}

export interface SubmitParams {
  tx: BytesEnvelope;
  witnesses: TxWitness[];
}

export interface SubmitResponse {
  hash: string;
}

export interface TxEnvelope {
  hash: string;
  tx: string;
}

export interface ResolveParams {
  args: ArgMap;
  tir: TirEnvelope;
  env?: EnvMap;
}

export type TxStage =
  | 'pending'
  | 'propagated'
  | 'acknowledged'
  | 'confirmed'
  | 'finalized'
  | 'dropped'
  | 'rolled_back'
  | 'unknown';

export interface ChainPoint {
  slot: number;
  blockHash: string;
}

export interface TxStatus {
  stage: TxStage;
  confirmations: number;
  nonConfirmations: number;
  confirmedAt?: ChainPoint;
}

export type TxStatusMap = Record<string, TxStatus>;

export interface CheckStatusResponse {
  statuses: TxStatusMap;
}

export interface TxLog {
  hash: string;
  stage: TxStage;
  payload?: string;
  confirmations: number;
  nonConfirmations: number;
  confirmedAt?: ChainPoint;
}

export interface DumpLogsResponse {
  entries: TxLog[];
  nextCursor?: number;
}

export interface PendingTx {
  hash: string;
  payload?: string;
}

export interface PeekPendingResponse {
  entries: PendingTx[];
  hasMore: boolean;
}

export interface InflightTx {
  hash: string;
  stage: TxStage;
  confirmations: number;
  nonConfirmations: number;
  confirmedAt?: ChainPoint;
  payload?: string;
}

export interface PeekInflightResponse {
  entries: InflightTx[];
  hasMore: boolean;
}

export interface UnsupportedTirDiagnostic {
  expected: string;
  provided: string;
}

export interface MissingTxArgDiagnostic {
  key: string;
  type: string;
}

export interface SearchSpaceDiagnostic {
  byAddressCount?: number;
  byAssetClassCount?: number;
  byRefCount?: number;
  matched: string[];
}

export interface InputQueryDiagnostic {
  address?: string;
  collateral: boolean;
  minAmount: Record<string, string>;
  refs: string[];
  supportMany: boolean;
}

export interface InputNotResolvedDiagnostic {
  name: string;
  query: InputQueryDiagnostic;
  search_space: SearchSpaceDiagnostic;
}

export interface TxScriptFailureDiagnostic {
  logs: string[];
}
