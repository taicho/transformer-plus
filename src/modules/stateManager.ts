import { ExtensionContext } from "vscode";

let context : ExtensionContext;
export function initialize(extensionContext) {
    context = extensionContext;
}


export function getState<TState = any>(namespace : string) {
    return context.globalState.get<TState>(namespace);
}

export async function setState<TState = any>(namespace: string, state : TState) {
    await context.globalState.update(namespace,state);
}