import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildIdOf, readBundleStamp, type InstallInfo } from "../src/util/install.js";
import { updateNotice } from "../src/cli/service.js";
import { BUILD } from "../src/version.js";
import { makeRoots } from "./helpers.js";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function bundleWith(stamp: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "neatroots-test-bundle-"));
  dirs.push(dir);
  if (stamp !== undefined) fs.writeFileSync(path.join(dir, ".neatroots-bundle"), typeof stamp === "string" ? stamp : JSON.stringify(stamp));
  return dir;
}

function install(root: string | null, mode: InstallInfo["mode"]): InstallInfo {
  return { mode, root, steer_python: null, steer_ts: null, examples: null };
}

describe("build identity", () => {
  it("is the release tag a bundle was built from, so an RC and its release differ", () => {
    const rc = bundleWith({ version: "0.2.9", tag: "v0.2.9-rc.1", commit: "1a2b3c4" });
    const release = bundleWith({ version: "0.2.9", tag: "v0.2.9", commit: "5d6e7f8" });
    expect(buildIdOf(install(rc, "bundle"))).toBe("v0.2.9-rc.1");
    expect(buildIdOf(install(release, "bundle"))).toBe("v0.2.9");
  });

  it("falls back to the commit for a bundle built without a release tag", () => {
    expect(buildIdOf(install(bundleWith({ version: "0.2.9", tag: null, commit: "1a2b3c4" }), "bundle"))).toBe("1a2b3c4");
    // Bundles made before builds carried a tag have only the commit.
    expect(buildIdOf(install(bundleWith({ version: "0.2.8", commit: "1a2b3c4" }), "bundle"))).toBe("1a2b3c4");
  });

  it("is null when the copy carries no identity (a dev run, a broken stamp, a commitless bundle)", () => {
    expect(buildIdOf(install(bundleWith({ version: "0.2.9", tag: null, commit: "unknown" }), "bundle"))).toBe(null);
    expect(buildIdOf(install(bundleWith(undefined), "bundle"))).toBe(null);
    expect(buildIdOf(install(bundleWith("not json"), "bundle"))).toBe(null);
    expect(buildIdOf(install(null, "other"))).toBe(null);
    expect(readBundleStamp(bundleWith(undefined))).toBe(null);
  });

  it("is the commit of a source checkout, or null when it isn't one", () => {
    const repo = fileURLToPath(new URL("../../..", import.meta.url));
    if (fs.existsSync(path.join(repo, ".git"))) expect(buildIdOf(install(repo, "source"))).toMatch(/^[0-9a-f]{7,}$/);
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), "neatroots-test-plain-"));
    dirs.push(plain);
    expect(buildIdOf(install(plain, "source"))).toBe(null);
  });

  it("is reported on /api/status", async () => {
    const tb = await makeRoots({ serve: true, noEngine: true });
    try {
      const status = await (await fetch(`${tb.url}/api/status`)).json();
      expect(status.build).toBe(BUILD);
    } finally {
      await tb.close();
    }
  });
});

describe("update notice", () => {
  const at = (running: { version: string; build: string | null }, installed: { version: string; build: string | null }) => updateNotice(running, installed, 4100);

  it("says to restart when the release installs over its release candidate", () => {
    expect(at({ version: "0.2.9", build: "v0.2.9-rc.1" }, { version: "0.2.9", build: "v0.2.9" })).toBe(
      "! neatroots 0.2.9 (v0.2.9-rc.1) is still running on port 4100. Restart it to use 0.2.9 (v0.2.9): Ctrl+C in its terminal, then neatroots start",
    );
  });

  it("says nothing when the running server is the installed build", () => {
    expect(at({ version: "0.2.9", build: "v0.2.9" }, { version: "0.2.9", build: "v0.2.9" })).toBe(null);
    expect(at({ version: "0.2.9", build: "1a2b3c4" }, { version: "0.2.9", build: "1a2b3c4" })).toBe(null);
  });

  it("still tells versions apart, and falls back to them when no build is known", () => {
    expect(at({ version: "0.2.8", build: "v0.2.8" }, { version: "0.2.9", build: "v0.2.9" })).toContain("Restart it to use 0.2.9 (v0.2.9)");
    expect(at({ version: "0.2.9", build: null }, { version: "0.2.9", build: null })).toBe(null);
    // A server started before build identities existed reports none; its version is all there is.
    expect(at({ version: "0.2.9", build: null }, { version: "0.2.9", build: "v0.2.9" })).toBe(null);
  });
});
