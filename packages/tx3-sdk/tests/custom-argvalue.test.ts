import { describe, test, expect } from "@jest/globals";
import {
  CustomArgValue,
  createCustomArg,
  createIntArg,
  createStringArg,
  createBoolArg,
} from "../src/trp/index.js";

// Define test interfaces for type safety
interface TestUser {
  id: number;
  name: string;
  active: boolean;
  profile: {
    email: string;
    settings: {
      theme: string;
      notifications: boolean;
    };
  };
}

interface SimpleConfig {
  host: string;
  port: number;
  ssl: boolean;
}

describe("CustomArgValue Type Safety", () => {
  test("should create type-safe CustomArgValue from interface", () => {
    const user = CustomArgValue.from<TestUser>({
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
    });

    expect(user.get("id")?.value).toBe(BigInt(1));
    expect(user.get("name")?.value).toBe("Alice");
    expect(user.get("active")?.value).toBe(true);

    const profile = user.get("profile");
    expect(profile).toBeInstanceOf(CustomArgValue);
    expect(profile?.get("email")?.value).toBe("alice@example.com");

    const settings = profile?.get("settings");
    expect(settings).toBeInstanceOf(CustomArgValue);
    expect(settings?.get("theme")?.value).toBe("dark");
    expect(settings?.get("notifications")?.value).toBe(true);
  });

  test("should maintain type safety on get operations", () => {
    const config = CustomArgValue.from<SimpleConfig>({
      host: "localhost",
      port: 8080,
      ssl: true,
    });

    // TypeScript would enforce these types at compile time
    const host = config.get("host"); // ArgValueString
    const port = config.get("port"); // ArgValueInt
    const ssl = config.get("ssl"); // ArgValueBool

    expect(host?.type).toBe("String");
    expect(port?.type).toBe("Int");
    expect(ssl?.type).toBe("Bool");

    expect(host?.value).toBe("localhost");
    expect(port?.value).toBe(BigInt(8080));
    expect(ssl?.value).toBe(true);
  });

  test("should support type-safe modifications", () => {
    const config = CustomArgValue.from<SimpleConfig>({
      host: "localhost",
      port: 8080,
      ssl: false,
    });

    // Type-safe modifications
    config.set("host", createStringArg("newhost"));
    config.set("port", createIntArg(3000));
    config.set("ssl", createBoolArg(true));

    expect(config.get("host")?.value).toBe("newhost");
    expect(config.get("port")?.value).toBe(BigInt(3000));
    expect(config.get("ssl")?.value).toBe(true);
  });

  test("should convert to plain object correctly", () => {
    const user = CustomArgValue.from<TestUser>({
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
    });

    const plain = user.toPlainObject();

    expect(plain).toEqual({
      id: BigInt(1), // Note: numbers become bigint
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
    const original = CustomArgValue.from<SimpleConfig>({
      host: "original",
      port: 5000,
      ssl: true,
    });

    const clone = original.clone();

    // Modify clone
    clone.set("host", createStringArg("cloned"));
    clone.set("port", createIntArg(6000));

    // Original should remain unchanged
    expect(original.get("host")?.value).toBe("original");
    expect(original.get("port")?.value).toBe(BigInt(5000));

    // Clone should be modified
    expect(clone.get("host")?.value).toBe("cloned");
    expect(clone.get("port")?.value).toBe(BigInt(6000));
  });

  test("should check equality correctly", () => {
    const config1 = CustomArgValue.from<SimpleConfig>({
      host: "localhost",
      port: 8080,
      ssl: true,
    });

    const config2 = CustomArgValue.from<SimpleConfig>({
      host: "localhost",
      port: 8080,
      ssl: true,
    });

    const config3 = CustomArgValue.from<SimpleConfig>({
      host: "localhost",
      port: 3000,
      ssl: true,
    });

    expect(config1.equals(config2)).toBe(true);
    expect(config1.equals(config3)).toBe(false);
  });

  test("should handle nested structures correctly", () => {
    const user = CustomArgValue.from<TestUser>({
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
    });

    // Test nested access
    const profile = user.get("profile");
    const settings = profile?.get("settings");

    expect(settings?.get("theme")?.value).toBe("auto");
    expect(settings?.get("notifications")?.value).toBe(true);

    // Test nested modification
    settings?.set("theme", createStringArg("dark"));
    expect(settings?.get("theme")?.value).toBe("dark");

    // Verify the change is reflected in the full object
    const plainObject = user.toPlainObject();
    expect(plainObject.profile.settings.theme).toBe("dark");
  });

  test("should maintain type information through serialization", () => {
    const config = CustomArgValue.from<SimpleConfig>({
      host: "test",
      port: 9000,
      ssl: false,
    });

    // Convert to plain object and back
    const plain = config.toPlainObject();
    const recreated = CustomArgValue.from<SimpleConfig>(plain);

    expect(recreated.equals(config)).toBe(true);
    expect(recreated.get("host")?.type).toBe("String");
    expect(recreated.get("port")?.type).toBe("Int");
    expect(recreated.get("ssl")?.type).toBe("Bool");
  });
});

