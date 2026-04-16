import type { Signer } from '../signer/signer.js';

export type Party =
  | { readonly kind: 'address'; readonly address: string }
  | { readonly kind: 'signer'; readonly address: string; readonly signer: Signer };

export const Party = {
  address(address: string): Party {
    return { kind: 'address', address };
  },

  signer(signer: Signer): Party {
    return { kind: 'signer', address: signer.address(), signer };
  },
} as const;

export function partyAddress(party: Party): string {
  return party.address;
}
