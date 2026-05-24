import type { ArgMap } from '../core/index.js';

/**
 * A named profile baked into a client: environment values and party
 * addresses keyed by name.
 *
 * Produced either by deconstructing a loaded `Protocol` inside
 * `Tx3ClientBuilder.fromProtocol`, or by feeding the per-profile JSON blob a
 * generated codegen client embeds through `Tx3ClientBuilder.fromParts`.
 */
export interface Profile {
  environment: ArgMap;
  parties: Record<string, string>;
}
