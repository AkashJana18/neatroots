import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Where this copy of neatroots came from: a prebuilt bundle (~/.neatroots/app), a source checkout
// (install.sh --from-source or a git clone), or neither (a dev run of some other layout).

export function cliPath(): string {
  return fs.realpathSync(process.argv[1] ?? ".");
}

/** The prebuilt bundle root: app/neatroots/dist/cli.js → app. */
export function bundleDir(): string | undefined {
  const dir = path.resolve(path.dirname(cliPath()), "..", "..");
  return fs.existsSync(path.join(dir, ".neatroots-bundle")) && fs.existsSync(path.join(dir, "install.sh")) ? dir : undefined;
}

/** The source checkout root: packages/neatroots/dist/cli.js → repo. */
export function sourceDir(): string | undefined {
  const dir = path.resolve(path.dirname(cliPath()), "..", "..", "..");
  return fs.existsSync(path.join(dir, "install.sh")) && fs.existsSync(path.join(dir, "pnpm-workspace.yaml")) ? dir : undefined;
}

export interface InstallInfo {
  mode: "bundle" | "source" | "other";
  root: string | null;
  /** Folders to pip / npm install the steering hooks from. */
  steer_python: string | null;
  steer_ts: string | null;
  /** The runnable examples (examples/README.md lists them). */
  examples: string | null;
}

export function installInfo(): InstallInfo {
  const b = bundleDir();
  if (b) return { mode: "bundle", root: b, steer_python: path.join(b, "steer", "python", "neatroots-steer"), steer_ts: path.join(b, "steer", "ts"), examples: path.join(b, "examples") };
  const s = sourceDir();
  if (s) return { mode: "source", root: s, steer_python: path.join(s, "python", "neatroots-steer"), steer_ts: path.join(s, "packages", "steer-ts"), examples: path.join(s, "examples") };
  return { mode: "other", root: null, steer_python: null, steer_ts: null, examples: null };
}

// Which build of neatroots a copy is, as opposed to which version it says it is. A release
// candidate and its final release carry the same version (v0.2.9-rc.1 and v0.2.9 both report
// 0.2.9), so `neatroots update` compares the build identity: the release tag a bundle was built
// from, or the commit of a source checkout.

/** What scripts/package.mjs records in a bundle's .neatroots-bundle. */
export interface BundleStamp {
  version?: string;
  /** The release tag (v0.2.9, v0.2.9-rc.1) when the bundle was built from one. */
  tag?: string | null;
  commit?: string | null;
  built?: string;
}

export function readBundleStamp(root: string): BundleStamp | null {
  try {
    const stamp: unknown = JSON.parse(fs.readFileSync(path.join(root, ".neatroots-bundle"), "utf8"));
    return stamp && typeof stamp === "object" ? (stamp as BundleStamp) : null;
  } catch {
    return null;
  }
}

/** A source checkout's commit, or null when it isn't one (no .git, no git). */
export function sourceCommit(root: string): string | null {
  try {
    return execFileSync("git", ["-C", root, "rev-parse", "--short", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

/** The build identity installed at `info.root`: its release tag, else its commit; null when it has neither. */
export function buildIdOf(info: InstallInfo): string | null {
  if (!info.root) return null;
  if (info.mode === "bundle") {
    const stamp = readBundleStamp(info.root);
    if (!stamp) return null;
    return stamp.tag || (stamp.commit && stamp.commit !== "unknown" ? stamp.commit : null);
  }
  if (info.mode === "source") return sourceCommit(info.root);
  return null;
}
