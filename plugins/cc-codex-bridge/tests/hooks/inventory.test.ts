import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { buildInventory } from "../../src/hooks/inventory.js";
import { copyFixtureProject, makeTmpDir, writeSettings } from "../helpers.js";

describe("hooks/inventory", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = makeTmpDir();
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  test("flattens project + user hooks with stable IDs", () => {
    const project = copyFixtureProject(tmp);
    const home = path.join(tmp, "home");
    fs.mkdirSync(home);
    writeSettings(home, {
      hooks: {
        UserPromptSubmit: [{ matcher: "", hooks: [{ type: "command", command: "user-init.sh" }] }],
      },
    });

    const inventory = buildInventory({ projectRoot: project, userHome: home });
    const projectIds = new Set(inventory.filter((e) => e.scope === "project").map((e) => e.id));
    const userIds = new Set(inventory.filter((e) => e.scope === "user").map((e) => e.id));

    expect(inventory.length).toBeGreaterThan(0);
    expect(projectIds.size).toBeGreaterThan(0);
    expect(userIds.size).toBe(1);
    for (const e of inventory) {
      expect(e.id).toMatch(/^[0-9a-f]{10}$/);
      expect(typeof e.label).toBe("string");
      expect(e.label.length).toBeGreaterThan(0);
    }

    const second = buildInventory({ projectRoot: project, userHome: home });
    expect(second.map((e) => e.id)).toEqual(inventory.map((e) => e.id));
    expect(second.map((e) => e.label)).toEqual(inventory.map((e) => e.label));
  });

  test("external project path replaces project source", () => {
    const project = path.join(tmp, "a");
    const external = path.join(tmp, "b");
    fs.mkdirSync(project);
    fs.mkdirSync(external);
    writeSettings(project, {
      hooks: { Stop: [{ matcher: "", hooks: [{ type: "command", command: "a.sh" }] }] },
    });
    writeSettings(external, {
      hooks: { Stop: [{ matcher: "", hooks: [{ type: "command", command: "b.sh" }] }] },
    });

    const inv = buildInventory({ projectRoot: project, externalProjectPath: external });
    const projectEntries = inv.filter((e) => e.scope === "project");
    expect(projectEntries.length).toBe(1);
    expect((projectEntries[0]!.handler as unknown as { command: string }).command).toBe("b.sh");
  });
});
