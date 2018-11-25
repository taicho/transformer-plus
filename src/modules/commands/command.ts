import * as vscode from 'vscode';
export class Command {
    constructor(public id: string, public callback?: () => void) {
    }

    public register(context: vscode.ExtensionContext) {
        context.subscriptions.push(vscode.commands.registerCommand(this.id, () => { this.execute(); }));
    }

    public execute() {
        if (!this.callback) {
            this.executeCore();

        } else {
            this.callback();
        }

    }

    protected executeCore() {
        throw new Error('executeCore must be be implemented if no call back is provided.');
    }
}