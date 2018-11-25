import * as vm from 'vm';
const Module = require('module');
import * as vscode from 'vscode';
import * as path from 'path';


interface ContextOptions {
    requireFrom?: string;
}

const defaultOptions: ContextOptions = {

};

export async function runWithContext(expression: string, context: any, undefinedOnError: boolean = true, options: vm.RunningScriptOptions & ContextOptions = defaultOptions) {
    if (options) {
        if (options.requireFrom) {
            context = Object.assign({}, context, { require: createRequireFromFilePath(options.requireFrom) });
        }
    }
    const returnExpression = `(()=>{${expression}})()`;
    try {
        let result;
        try {
            const preparedContext = vm.createContext(context);
            return await vm.runInContext(expression, preparedContext, options);
        } catch{
            const preparedContext = vm.createContext(context);
            return await vm.runInContext(returnExpression, preparedContext, options);
        }
    } catch (err) {
        console.log(`VM Error: ${err}`);
        if (undefinedOnError) {
            return;
        }
        throw err;
    }
}


export interface CancellationToken extends Partial<Pick<vscode.CancellationToken, 'isCancellationRequested'>> {
}

export function createRequireFromFilePath(filename) {
    const m = new Module(filename);
    m.filename = filename;
    m.paths = Module._nodeModulePaths(path.dirname(filename));
    return makeRequireFunction(m);
}

function makeRequireFunction(mod) {
    const Module = mod.constructor;

    const require: any = function (path) {
        try {
            exports.requireDepth += 1;
            return mod.require(path);
        } finally {
            exports.requireDepth -= 1;
        }
    };

    const resolve: any = function (request, options) {
        if (typeof request !== 'string') {
            throw new Error('Invalid request argument.');
        }
        return Module._resolveFilename(request, mod, false, options);
    };

    require.resolve = resolve;

    function paths(request) {
        if (typeof request !== 'string') {
            throw new Error('Invalid request argument.');
        }
        return Module._resolveLookupPaths(request, mod, true);
    }

    resolve.paths = paths;

    require.main = process.mainModule;

    require.extensions = Module._extensions;

    require.cache = Module._cache;

    return require;
}