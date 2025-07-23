import {
  toJson,
  fromJson,
  createIntArg,
  createBoolArg,
  createStringArg,
  createBytesArg,
  createAddressArg,
  createUtxoRefArg,
  hexToBytes,
  bytesToHex
} from '../src/trp/args';
import { ArgValue, Type, BytesEnvelope, UtxoRef, UtxoSet, Utxo } from '../src/trp/types';

function argValueEquals(a: ArgValue, b: ArgValue): boolean {
  if (a.type !== b.type) return false;
  
  switch (a.type) {
    case 'Int':
      return a.value === (b as typeof a).value;
    case 'Bool':
      return a.value === (b as typeof a).value;
    case 'String':
      return a.value === (b as typeof a).value;
    case 'Bytes':
      const bytesA = a.value;
      const bytesB = (b as typeof a).value;
      if (bytesA.length !== bytesB.length) return false;
      return bytesA.every((val, i) => val === bytesB[i]);
    case 'Address':
      const addrA = a.value;
      const addrB = (b as typeof a).value;
      if (addrA.length !== addrB.length) return false;
      return addrA.every((val, i) => val === addrB[i]);
    case 'UtxoRef':
      const refA = a.value;
      const refB = (b as typeof a).value;
      return refA.index === refB.index && 
        refA.txid.length === refB.txid.length &&
        refA.txid.every((val, i) => val === refB.txid[i]);
    case 'UtxoSet':
      // For sets, we need to compare each element
      const setA = Array.from(a.value);
      const setB = Array.from((b as typeof a).value);
      if (setA.length !== setB.length) return false;
      // This is a simplified comparison - in reality, sets are unordered
      return setA.every((utxo, i) => {
        const utxoB = setB[i];
        return utxo.ref.index === utxoB.ref.index &&
          utxo.ref.txid.every((val, j) => val === utxoB.ref.txid[j]);
      });
    default:
      return false;
  }
}

function jsonToValueTest(provided: any, target: Type, expected: ArgValue): void {
  const result = fromJson(provided, target);
  expect(argValueEquals(result, expected)).toBe(true);
}

function roundTripTest(value: ArgValue, target: Type): void {
  const json = toJson(value);
  const restored = fromJson(json, target);
  expect(argValueEquals(value, restored)).toBe(true);
}

describe('Args Conversion Tests', () => {
  
  describe('Integer Tests', () => {
    test('round trip small int', () => {
      roundTripTest(createIntArg(123456789), Type.Int);
    });

    test('round trip negative int', () => {
      roundTripTest(createIntArg(-123456789), Type.Int);
    });

    test('round trip big int', () => {
      roundTripTest(createIntArg(BigInt('12345678901234567890')), Type.Int);
    });

    test('round trip int overflow (min/max)', () => {
      // Test with very large numbers that would be i128::MIN and i128::MAX equivalents
      const maxI128 = BigInt('170141183460469231731687303715884105727'); // 2^127 - 1
      const minI128 = BigInt('-170141183460469231731687303715884105728'); // -2^127
      
      roundTripTest(createIntArg(minI128), Type.Int);
      roundTripTest(createIntArg(maxI128), Type.Int);
    });

    // Tests with native bigint types (serialized as strings)
    test('round trip native bigint via hex string', () => {
      const bigIntValue = 123456789012345n;
      const arg = createIntArg(bigIntValue);
      jsonToValueTest(bigIntValue, Type.Int, arg);
    });

    test('round trip native number', () => {
      const numberValue = 42;
      jsonToValueTest(numberValue, Type.Int, createIntArg(numberValue));
    });

    test('round trip negative native number', () => {
      const negativeValue = -999;
      jsonToValueTest(negativeValue, Type.Int, createIntArg(negativeValue));
    });
  });

  describe('Boolean Tests', () => {
    test('round trip bool true', () => {
      roundTripTest(createBoolArg(true), Type.Bool);
    });

    test('round trip bool false', () => {
      roundTripTest(createBoolArg(false), Type.Bool);
    });

    test('round trip bool from number', () => {
      jsonToValueTest(1, Type.Bool, createBoolArg(true));
      jsonToValueTest(0, Type.Bool, createBoolArg(false));
    });

    test('round trip bool from string', () => {
      jsonToValueTest('true', Type.Bool, createBoolArg(true));
      jsonToValueTest('false', Type.Bool, createBoolArg(false));
    });

    // Tests with native boolean types
    test('round trip native boolean true', () => {
      const boolValue = true;
      jsonToValueTest(boolValue, Type.Bool, createBoolArg(boolValue));
    });

    test('round trip native boolean false', () => {
      const boolValue = false;
      jsonToValueTest(boolValue, Type.Bool, createBoolArg(boolValue));
    });

    test('compare createBoolArg vs native boolean handling', () => {
      const nativeTrue = true;
      const nativeFalse = false;
      
      const argTrue = createBoolArg(nativeTrue);
      const argFalse = createBoolArg(nativeFalse);
      
      // Both should create the same ArgValue structure
      expect(argTrue.type).toBe('Bool');
      expect(argTrue.value).toBe(true);
      expect(argFalse.type).toBe('Bool');
      expect(argFalse.value).toBe(false);
    });
  });

  describe('String Tests', () => {
    test('round trip string', () => {
      roundTripTest(createStringArg('hello world'), Type.Undefined);
    });

    // Tests with native string types
    test('round trip native string', () => {
      const stringValue = 'hello native world';
      jsonToValueTest(stringValue, Type.Undefined, createStringArg(stringValue));
    });

    test('round trip empty native string', () => {
      const emptyString = '';
      jsonToValueTest(emptyString, Type.Undefined, createStringArg(emptyString));
    });

    test('round trip native string with special chars', () => {
      const specialString = 'Hello 🌟 World! @#$%^&*()';
      jsonToValueTest(specialString, Type.Undefined, createStringArg(specialString));
    });

    test('compare createStringArg vs native string handling', () => {
      const nativeString = 'test string';
      const arg = createStringArg(nativeString);
      
      expect(arg.type).toBe('String');
      expect(arg.value).toBe(nativeString);
    });
  });

  describe('Bytes Tests', () => {
    test('round trip bytes', () => {
      const bytes = new TextEncoder().encode('hello');
      roundTripTest(createBytesArg(bytes), Type.Bytes);
    });

    test('round trip bytes from base64 envelope', () => {
      const json: BytesEnvelope = {
        content: 'aGVsbG8=', // "hello" in base64
        encoding: 'base64'
      };
      
      const expectedBytes = new TextEncoder().encode('hello');
      jsonToValueTest(json, Type.Bytes, createBytesArg(expectedBytes));
    });

    test('round trip bytes from hex envelope', () => {
      const json: BytesEnvelope = {
        content: '68656c6c6f', // "hello" in hex
        encoding: 'hex'
      };
      
      const expectedBytes = new TextEncoder().encode('hello');
      jsonToValueTest(json, Type.Bytes, createBytesArg(expectedBytes));
    });

    test('round trip bytes from hex string', () => {
      const hexString = '0x68656c6c6f'; // "hello" in hex with 0x prefix
      const expectedBytes = new TextEncoder().encode('hello');
      jsonToValueTest(hexString, Type.Bytes, createBytesArg(expectedBytes));
    });

    // Tests with native Uint8Array types (serialized as hex strings)
    test('round trip native Uint8Array via hex string', () => {
      const nativeBytes = new Uint8Array([0xFF, 0x00, 0xAB, 0xCD, 0xEF]);
      const arg = createBytesArg(nativeBytes);
      const json = toJson(arg); // This will be a hex string
      jsonToValueTest(json, Type.Bytes, arg);
    });

    test('round trip empty native Uint8Array via hex string', () => {
      const emptyBytes = new Uint8Array([]);
      const arg = createBytesArg(emptyBytes);
      const json = toJson(arg); // This will be "0x"
      jsonToValueTest(json, Type.Bytes, arg);
    });

    test('compare createBytesArg vs native Uint8Array handling', () => {
      const nativeBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const arg = createBytesArg(nativeBytes);
      
      expect(arg.type).toBe('Bytes');
      expect(arg.value).toEqual(nativeBytes);
    });

    test('round trip text encoded as native Uint8Array', () => {
      const text = 'Hello World!';
      const nativeBytes = new TextEncoder().encode(text);
      const arg = createBytesArg(nativeBytes);
      
      roundTripTest(arg, Type.Bytes);
      
      // Verify we can decode it back
      if (arg.type === 'Bytes') {
        const decoded = new TextDecoder().decode(arg.value);
        expect(decoded).toBe(text);
      }
    });
  });

  describe('Address Tests', () => {
    test('round trip address', () => {
      const addressBytes = hexToBytes('abc123def456');
      roundTripTest(createAddressArg(addressBytes), Type.Address);
    });

    test('round trip address from bech32', () => {
      const json = 'addr1vx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzers66hrl8';
      const expectedBytes = hexToBytes('619493315cd92eb5d8c4304e67b7e16ae36d61d34502694657811a2c8e');

      jsonToValueTest(json, Type.Address, createAddressArg(expectedBytes));
    });

    test('round trip address from hex string', () => {
      const hexAddress = '619493315cd92eb5d8c4304e67b7e16ae36d61d34502694657811a2c8e';
      const expectedBytes = hexToBytes(hexAddress);
      jsonToValueTest(hexAddress, Type.Address, createAddressArg(expectedBytes));
    });
  });

  describe('UTXO Reference Tests', () => {
    test('round trip utxo ref', () => {
      const txidHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const txidBytes = hexToBytes(txidHex);
      const utxoRef: UtxoRef = {
        txid: txidBytes,
        index: 0
      };

      roundTripTest(createUtxoRefArg(txidBytes, 0), Type.UtxoRef);
    });

    test('parse utxo ref from string', () => {
      const json = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef#0';
      const expectedTxid = hexToBytes('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
      const expected = createUtxoRefArg(expectedTxid, 0);
      
      jsonToValueTest(json, Type.UtxoRef, expected);
    });

    test('parse utxo ref with different index', () => {
      const json = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef#42';
      const expectedTxid = hexToBytes('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
      const expected = createUtxoRefArg(expectedTxid, 42);
      
      jsonToValueTest(json, Type.UtxoRef, expected);
    });
  });

  describe('Type Inference Tests (Undefined type)', () => {
    test('infer bool from boolean', () => {
      jsonToValueTest(true, Type.Undefined, createBoolArg(true));
      jsonToValueTest(false, Type.Undefined, createBoolArg(false));
    });

    test('infer int from number', () => {
      jsonToValueTest(42, Type.Undefined, createIntArg(42));
      jsonToValueTest(-17, Type.Undefined, createIntArg(-17));
    });

    test('infer string from string', () => {
      jsonToValueTest('hello', Type.Undefined, createStringArg('hello'));
      jsonToValueTest('', Type.Undefined, createStringArg(''));
    });
  });

  describe('Native Types vs CreateArg Functions Comparison', () => {
    test('native bigint vs createIntArg with bigint (via serialization)', () => {
      const nativeBigInt = 123456789012345n;
      const createdArg = createIntArg(nativeBigInt);
      
      jsonToValueTest(nativeBigInt, Type.Int, createdArg);      
      roundTripTest(createdArg, Type.Int);
    });

    test('native number vs createIntArg with number', () => {
      const nativeNumber = 42;
      const createdArg = createIntArg(nativeNumber);
      
      jsonToValueTest(nativeNumber, Type.Int, createdArg);
      roundTripTest(createdArg, Type.Int);
    });

    test('native boolean vs createBoolArg', () => {
      const nativeBool = true;
      const createdArg = createBoolArg(nativeBool);
      
      jsonToValueTest(nativeBool, Type.Bool, createdArg);
      roundTripTest(createdArg, Type.Bool);
    });

    test('native string vs createStringArg', () => {
      const nativeString = 'test string';
      const createdArg = createStringArg(nativeString);
      
      jsonToValueTest(nativeString, Type.Undefined, createdArg);
      roundTripTest(createdArg, Type.Undefined);
    });

    test('native Uint8Array vs createBytesArg (via serialization)', () => {
      const nativeBytes = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
      const createdArg = createBytesArg(nativeBytes);
      
      jsonToValueTest(nativeBytes, Type.Bytes, createdArg);
      roundTripTest(createdArg, Type.Bytes);
    });

    test('native types in type inference (Type.Undefined)', () => {
      // Test that JSON-compatible native types are properly inferred when using Type.Undefined
      jsonToValueTest(999, Type.Undefined, createIntArg(999));
      jsonToValueTest(true, Type.Undefined, createBoolArg(true));
      jsonToValueTest(false, Type.Undefined, createBoolArg(false));
      jsonToValueTest('auto-infer', Type.Undefined, createStringArg('auto-infer'));
    });

    test('edge cases with native types', () => {
      // Zero values
      jsonToValueTest(0, Type.Int, createIntArg(0));

      // Empty values
      jsonToValueTest('', Type.Undefined, createStringArg(''));

      // Test serialized empty bytes
      const emptyBytes = new Uint8Array([]);
      const emptyArg = createBytesArg(emptyBytes);
      jsonToValueTest(emptyBytes, Type.Bytes, emptyArg);

      // Large numbers
      const largeNumber = Number.MAX_SAFE_INTEGER;
      jsonToValueTest(largeNumber, Type.Int, createIntArg(largeNumber));

      // Test serialized large bigint
      const largeBigInt = BigInt(Number.MAX_SAFE_INTEGER) * 2n;
      const largeBigIntArg = createIntArg(largeBigInt);
      jsonToValueTest(largeBigInt, Type.Int, largeBigIntArg);
    });

    test('direct native type creation vs factory functions', () => {
      // Test that creating ArgValues directly with native types produces same results as factory functions
      const testCases = [
        { native: 42, createFn: () => createIntArg(42) },
        { native: true, createFn: () => createBoolArg(true) },
        { native: false, createFn: () => createBoolArg(false) },
        { native: 'hello', createFn: () => createStringArg('hello') },
      ];

      testCases.forEach(({ native, createFn }) => {
        const factoryResult = createFn();
        expect(factoryResult.value).toEqual(
          typeof native === 'number' ? BigInt(native) : native
        );
      });
    });

    test('bigint handling in different ranges', () => {
      const testCases = [
        0n,
        1n,
        -1n,
        BigInt(Number.MAX_SAFE_INTEGER),
        BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        BigInt('12345678901234567890'),
      ];

      testCases.forEach(bigIntValue => {
        const arg = createIntArg(bigIntValue);
        const json = toJson(arg);
        const restored = fromJson(json, Type.Int);
        expect(argValueEquals(arg, restored)).toBe(true);
      });
    });
  });

  describe('Error Cases', () => {
    test('invalid hex string', () => {
      expect(() => {
        fromJson('0xzzzz', Type.Bytes);
      }).toThrow('Invalid hex string');
    });

    test('invalid utxo ref format', () => {
      expect(() => {
        fromJson('invalid-utxo-ref', Type.UtxoRef);
      }).toThrow('Invalid utxo ref');
    });

    test('invalid utxo ref index', () => {
      expect(() => {
        fromJson('abcd#notanumber', Type.UtxoRef);
      }).toThrow('Invalid utxo ref');
    });

    test('null value', () => {
      expect(() => {
        fromJson(null, Type.Int);
      }).toThrow('Value is null');
    });

    test('invalid number for boolean', () => {
      expect(() => {
        fromJson(2, Type.Bool);
      }).toThrow('Invalid number for boolean');
    });

    test('invalid string for boolean', () => {
      expect(() => {
        fromJson('maybe', Type.Bool);
      }).toThrow('Invalid string for boolean');
    });
  });

  describe('Utility Functions', () => {
    test('hexToBytes and bytesToHex round trip', () => {
      const originalHex = 'deadbeef';
      const bytes = hexToBytes(originalHex);
      const backToHex = bytesToHex(bytes);
      expect(backToHex).toBe(originalHex);
    });

    test('hexToBytes with 0x prefix', () => {
      const hex = '0xdeadbeef';
      const bytes = hexToBytes(hex);
      const expected = hexToBytes('deadbeef');
      expect(bytes).toEqual(expected);
    });

    test('hexToBytes with odd length should throw', () => {
      expect(() => {
        hexToBytes('abc'); // odd length
      }).toThrow('Invalid hex string');
    });
  });

  describe('Large Number Handling', () => {
    test('numbers that fit in safe integer range', () => {
      const safeInt = Number.MAX_SAFE_INTEGER;
      const arg = createIntArg(safeInt);
      const json = toJson(arg);
      expect(typeof json).toBe('number');
      expect(json).toBe(safeInt);
    });

    test('numbers that exceed safe integer range become hex strings', () => {
      const bigInt = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1);
      const arg = createIntArg(bigInt);
      const json = toJson(arg);
      expect(typeof json).toBe('string');
      expect(json).toMatch(/^0x[0-9a-f]+$/);
    });

    test('parse hex string back to bigint', () => {
      const original = BigInt('123456789012345678901234567890');
      const arg = createIntArg(original);
      const json = toJson(arg);
      const restored = fromJson(json, Type.Int);
      expect(argValueEquals(arg, restored)).toBe(true);
    });
  });

  describe('ArgValue Factory Functions Tests', () => {
  
    describe('fromString', () => {
      test('creates string ArgValue', () => {
        const result = ArgValue.fromString('hello world');
        expect(result.type).toBe('String');
        expect(result.value).toBe('hello world');
      });

      test('handles empty string', () => {
        const result = ArgValue.fromString('');
        expect(result.type).toBe('String');
        expect(result.value).toBe('');
      });

      test('handles special characters', () => {
        const specialString = 'Hello 🌟 World! @#$%^&*()';
        const result = ArgValue.fromString(specialString);
        expect(result.type).toBe('String');
        expect(result.value).toBe(specialString);
      });
    });

    describe('fromNumber', () => {
      test('creates int ArgValue from number', () => {
        const result = ArgValue.fromNumber(42);
        expect(result.type).toBe('Int');
        expect(result.value).toBe(42n);
      });

      test('creates int ArgValue from bigint', () => {
        const result = ArgValue.fromNumber(BigInt('123456789012345'));
        expect(result.type).toBe('Int');
        expect(result.value).toBe(BigInt('123456789012345'));
      });

      test('handles negative numbers', () => {
        const result = ArgValue.fromNumber(-42);
        expect(result.type).toBe('Int');
        expect(result.value).toBe(-42n);
      });

      test('handles zero', () => {
        const result = ArgValue.fromNumber(0);
        expect(result.type).toBe('Int');
        expect(result.value).toBe(0n);
      });

      test('handles large numbers', () => {
        const largeNum = Number.MAX_SAFE_INTEGER;
        const result = ArgValue.fromNumber(largeNum);
        expect(result.type).toBe('Int');
        expect(result.value).toBe(BigInt(largeNum));
      });
    });

    describe('fromBool', () => {
      test('creates bool ArgValue from true', () => {
        const result = ArgValue.fromBool(true);
        expect(result.type).toBe('Bool');
        expect(result.value).toBe(true);
      });

      test('creates bool ArgValue from false', () => {
        const result = ArgValue.fromBool(false);
        expect(result.type).toBe('Bool');
        expect(result.value).toBe(false);
      });
    });

    describe('fromBytes', () => {
      test('creates bytes ArgValue', () => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5]);
        const result = ArgValue.fromBytes(bytes);
        expect(result.type).toBe('Bytes');
        expect(result.value).toEqual(bytes);
      });

      test('handles empty bytes', () => {
        const bytes = new Uint8Array([]);
        const result = ArgValue.fromBytes(bytes);
        expect(result.type).toBe('Bytes');
        expect(result.value).toEqual(bytes);
      });

      test('handles hex-like bytes', () => {
        const bytes = new Uint8Array([0xFF, 0x00, 0xAB, 0xCD]);
        const result = ArgValue.fromBytes(bytes);
        expect(result.type).toBe('Bytes');
        expect(result.value).toEqual(bytes);
      });
    });

    describe('fromAddress', () => {
      test('creates address ArgValue', () => {
        const address = new Uint8Array([0x01, 0x02, 0x03]);
        const result = ArgValue.fromAddress(address);
        expect(result.type).toBe('Address');
        expect(result.value).toEqual(address);
      });

      test('handles typical cardano address length', () => {
        // Typical Cardano address is 29 bytes
        const address = new Uint8Array(29).fill(0x01);
        const result = ArgValue.fromAddress(address);
        expect(result.type).toBe('Address');
        expect(result.value).toEqual(address);
      });
    });

    describe('fromUtxoRef', () => {
      test('creates UtxoRef ArgValue', () => {
        const utxoRef: UtxoRef = {
          txid: new Uint8Array([1, 2, 3, 4]),
          index: 0
        };
        const result = ArgValue.fromUtxoRef(utxoRef);
        expect(result.type).toBe('UtxoRef');
        expect(result.value).toEqual(utxoRef);
      });    test('handles different index values', () => {
      const utxoRef: UtxoRef = {
        txid: new Uint8Array(32).fill(0xFF), // Typical txid length
        index: 5
      };
      const result = ArgValue.fromUtxoRef(utxoRef);
      expect(result.type).toBe('UtxoRef');
      if (result.type === 'UtxoRef') {
        expect(result.value.index).toBe(5);
        expect(result.value.txid).toEqual(utxoRef.txid);
      }
    });
    });

    describe('fromUtxoSet', () => {
      test('creates UtxoSet ArgValue', () => {
        const utxo: Utxo = {
          ref: { txid: new Uint8Array([1, 2, 3]), index: 0 },
          address: new Uint8Array([4, 5, 6]),
          assets: []
        };
        const utxoSet: UtxoSet = new Set([utxo]);
        const result = ArgValue.fromUtxoSet(utxoSet);
        expect(result.type).toBe('UtxoSet');
        expect(result.value).toEqual(utxoSet);
      });    test('handles empty UtxoSet', () => {
      const utxoSet: UtxoSet = new Set();
      const result = ArgValue.fromUtxoSet(utxoSet);
      expect(result.type).toBe('UtxoSet');
      if (result.type === 'UtxoSet') {
        expect(result.value.size).toBe(0);
      }
    });
    });

    describe('from (generic)', () => {
      test('auto-detects string', () => {
        const result = ArgValue.from('test string');
        expect(result.type).toBe('String');
        expect(result.value).toBe('test string');
      });

      test('auto-detects number', () => {
        const result = ArgValue.from(42);
        expect(result.type).toBe('Int');
        expect(result.value).toBe(42n);
      });

      test('auto-detects bigint', () => {
        const result = ArgValue.from(BigInt('123456789'));
        expect(result.type).toBe('Int');
        expect(result.value).toBe(BigInt('123456789'));
      });

      test('auto-detects boolean', () => {
        const result = ArgValue.from(true);
        expect(result.type).toBe('Bool');
        expect(result.value).toBe(true);
      });

      test('auto-detects Uint8Array', () => {
        const bytes = new Uint8Array([1, 2, 3]);
        const result = ArgValue.from(bytes);
        expect(result.type).toBe('Bytes');
        expect(result.value).toEqual(bytes);
      });

      test('auto-detects UtxoSet', () => {
        const utxoSet: UtxoSet = new Set();
        const result = ArgValue.from(utxoSet);
        expect(result.type).toBe('UtxoSet');
        expect(result.value).toEqual(utxoSet);
      });

      test('auto-detects UtxoRef', () => {
        const utxoRef: UtxoRef = {
          txid: new Uint8Array([1, 2, 3]),
          index: 1
        };
        const result = ArgValue.from(utxoRef);
        expect(result.type).toBe('UtxoRef');
        expect(result.value).toEqual(utxoRef);
      });

      test('throws error for unsupported type', () => {
        expect(() => {
          ArgValue.from({} as any);
        }).toThrow('Cannot convert value to ArgValue');
      });

      test('throws error for null', () => {
        expect(() => {
          ArgValue.from(null as any);
        }).toThrow('Cannot convert value to ArgValue');
      });

      test('throws error for undefined', () => {
        expect(() => {
          ArgValue.from(undefined as any);
        }).toThrow('Cannot convert value to ArgValue');
      });
    });
  });
});
