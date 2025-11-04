import { describe, test, expect } from "@jest/globals";
import {
  CustomArgValue,
  createIntArg,
  createStringArg,
  createBoolArg,
} from "../src/trp/index.js";

function plainToCustom(obj: Record<string, any>): {
  custom: CustomArgValue;
  keys: string[];
} {
  const keys = Object.keys(obj);
  const fields = keys.map((k) => {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return plainToCustom(v).custom as any;
    }
    if (typeof v === "number") return createIntArg(v);
    if (typeof v === "bigint") return createIntArg(v as bigint);
    if (typeof v === "boolean") return createBoolArg(v);
    if (typeof v === "string") return createStringArg(v);
    throw new Error(`Unsupported test value type: ${v}`);
  });
  return { custom: new CustomArgValue(0, fields as any), keys };
}

function getByName(custom: CustomArgValue, keys: string[], name: string): any {
  const idx = keys.indexOf(name);
  if (idx === -1) return undefined;
  return custom.getField(idx as number);
}

function customToPlain(
  custom: CustomArgValue,
  shape: Record<string, any>,
): Record<string, any> {
  const out: Record<string, any> = {};
  const keys = Object.keys(shape);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const expected = shape[k];
    const field = custom.getField(i as number) as any;
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      out[k] = customToPlain(field as CustomArgValue, expected);
    } else if (field && typeof field === "object" && "type" in field) {
      out[k] = field.value;
    } else {
      out[k] = field;
    }
  }
  return out;
}

describe("CustomArgValue Type Safety", () => {
  test("should create type-safe CustomArgValue from interface", () => {
    const userShape = {
      id: 1,
      name: "Alice",
      active: true,
      profile: {
        email: "alice@example.com",
        settings: {
          theme: "dark",
          notifications: true,
        },
      },
    };
    const { custom: user, keys: userKeys } = plainToCustom(userShape);

    expect(getByName(user, userKeys, "id")?.value).toBe(BigInt(1));
    expect(getByName(user, userKeys, "name")?.value).toBe("Alice");
    expect(getByName(user, userKeys, "active")?.value).toBe(true);

    const profile = getByName(user, userKeys, "profile") as CustomArgValue;
    expect(profile).toBeInstanceOf(CustomArgValue);
    // nested keys are positional (0=email,1=settings)
    expect((profile.getField(0) as any)?.value).toBe("alice@example.com");

    const settings = profile.getField(1) as CustomArgValue;
    expect(settings).toBeInstanceOf(CustomArgValue);
    expect((settings.getField(0) as any)?.value).toBe("dark");
    expect((settings.getField(1) as any)?.value).toBe(true);
  });

  test("should maintain type safety on get operations", () => {
    const configShape = { host: "localhost", port: 8080, ssl: true };
    const { custom: config, keys: cfgKeys } = plainToCustom(configShape);

    const host = getByName(config, cfgKeys, "host"); // ArgValueString
    const port = getByName(config, cfgKeys, "port"); // ArgValueInt
    const ssl = getByName(config, cfgKeys, "ssl"); // ArgValueBool

    expect(host?.type).toBe("String");
    expect(port?.type).toBe("Int");
    expect(ssl?.type).toBe("Bool");

    expect(host?.value).toBe("localhost");
    expect(port?.value).toBe(BigInt(8080));
    expect(ssl?.value).toBe(true);
  });

  test("should support type-safe modifications", () => {
    const configShape = { host: "localhost", port: 8080, ssl: false };
    const { custom: config, keys: cfgKeys } = plainToCustom(configShape);

    // Type-safe modifications (mutate underlying fields by index)
    const hostIdx = cfgKeys.indexOf("host");
    const portIdx = cfgKeys.indexOf("port");
    const sslIdx = cfgKeys.indexOf("ssl");
    (config as any).fields[hostIdx] = createStringArg("newhost");
    (config as any).fields[portIdx] = createIntArg(3000);
    (config as any).fields[sslIdx] = createBoolArg(true);

    expect(getByName(config, cfgKeys, "host")?.value).toBe("newhost");
    expect(getByName(config, cfgKeys, "port")?.value).toBe(BigInt(3000));
    expect(getByName(config, cfgKeys, "ssl")?.value).toBe(true);
  });

  test("should convert to plain object correctly", () => {
    const userShape = {
      id: 1,
      name: "Bob",
      active: false,
      profile: {
        email: "bob@example.com",
        settings: {
          theme: "light",
          notifications: false,
        },
      },
    };
    const { custom: user } = plainToCustom(userShape);
    const plain = customToPlain(user, userShape);

    expect(plain).toEqual({
      id: BigInt(1),
      name: "Bob",
      active: false,
      profile: {
        email: "bob@example.com",
        settings: {
          theme: "light",
          notifications: false,
        },
      },
    });
  });

  test("should clone with type safety", () => {
    const origShape = { host: "original", port: 5000, ssl: true };
    const { custom: original, keys: origKeys } = plainToCustom(origShape);

    const clone = new CustomArgValue(original.constructorIndex, [
      ...original.fields,
    ]);

    const hostIdx = origKeys.indexOf("host");
    const portIdx = origKeys.indexOf("port");
    (clone as any).fields[hostIdx] = createStringArg("cloned");
    (clone as any).fields[portIdx] = createIntArg(6000);

    // Original should remain unchanged
    expect((getByName(original, origKeys, "host") as any)?.value).toBe(
      "original",
    );
    expect((getByName(original, origKeys, "port") as any)?.value).toBe(
      BigInt(5000),
    );

    // Clone should be modified
    expect((clone.getField(hostIdx) as any).value).toBe("cloned");
    expect((clone.getField(portIdx) as any).value).toBe(BigInt(6000));
  });

  test("should check equality correctly", () => {
    const cfgShape1 = { host: "localhost", port: 8080, ssl: true };
    const { custom: config1 } = plainToCustom(cfgShape1);
    const { custom: config2 } = plainToCustom(cfgShape1);
    const { custom: config3 } = plainToCustom({
      host: "localhost",
      port: 3000,
      ssl: true,
    });

    expect(config1.toArray()).toEqual(config2.toArray());
    expect(config1.toArray()).not.toEqual(config3.toArray());
  });

  test("should handle nested structures correctly", () => {
    const userShape = {
      id: 123,
      name: "Charlie",
      active: true,
      profile: {
        email: "charlie@example.com",
        settings: {
          theme: "auto",
          notifications: true,
        },
      },
    };
    const { custom: user, keys: userKeys } = plainToCustom(userShape);

    // Test nested access
    const profile = getByName(user, userKeys, "profile") as CustomArgValue;
    const settings = profile.getField(1) as CustomArgValue;

    expect((settings.getField(0) as any)?.value).toBe("auto");
    expect((settings.getField(1) as any)?.value).toBe(true);

    // Test nested modification (mutate fields)
    (settings as any).fields[0] = createStringArg("dark");
    expect((settings.getField(0) as any)?.value).toBe("dark");

    // Verify the change is reflected in the full object
    const plainObject = customToPlain(user, userShape);
    expect(plainObject.profile.settings.theme).toBe("dark");
  });

  test("should maintain type information through serialization", () => {
    const cfgShape = { host: "test", port: 9000, ssl: false };
    const { custom: config } = plainToCustom(cfgShape);

    // Convert to plain object and back using test helpers
    const plain = customToPlain(config, cfgShape);
    const { custom: recreated, keys: recreatedKeys } = plainToCustom(plain);

    expect(recreated.toArray()).toEqual(config.toArray());
    expect(getByName(recreated, recreatedKeys, "host")?.type).toBe("String");
    expect(getByName(recreated, recreatedKeys, "port")?.type).toBe("Int");
    expect(getByName(recreated, recreatedKeys, "ssl")?.type).toBe("Bool");
  });
});
