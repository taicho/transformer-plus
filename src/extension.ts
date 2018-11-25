'use strict';
import * as vscode from 'vscode';
import * as Commands from './modules/commands';
import { initialize } from './modules/stateManager';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "transformer-plus" is now active!');
    initialize(context);
    Commands.register(context);
}

export function deactivate() {
}