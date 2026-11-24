import { AsyncLocalStorage } from "node:async_hooks";
import { DEFAULT_WORKSPACE } from "../src/lib/studio/workspace-scope";

/** The client a piece of work belongs to. Carried automatically through awaits and timers started inside it. */
const current = new AsyncLocalStorage<string>();

export const currentWorkspace = () => current.getStore() ?? DEFAULT_WORKSPACE;
export const isDefaultWorkspace = () => currentWorkspace() === DEFAULT_WORKSPACE;
export const inWorkspace = <T>(workspace: string, work: () => Promise<T>) => current.run(workspace, work);
export { DEFAULT_WORKSPACE };
