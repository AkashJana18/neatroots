import { buildIdOf, installInfo } from "./util/install.js";

export const VERSION = "0.2.9";

/**
 * Which build of VERSION this copy is: the release tag it was installed from (v0.2.9,
 * v0.2.9-rc.1), else the commit of the source checkout, else null. Read once at startup, so a
 * running neatroots keeps reporting the build it started with even after `neatroots update`
 * replaces the files on disk.
 */
export const BUILD = buildIdOf(installInfo());
