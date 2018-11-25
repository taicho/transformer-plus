import { Command } from "./command";
import * as vscode from 'vscode';
import * as vm from 'vm';
import { StandardCommand } from "./standardCommand";
import { runWithContext } from "../common";

interface TransformContext {
    currentDocumentText: string;
    lastSelection: string;
    currentAutoNumber: number;
    selectionIndex: number;
    lastResult: string;
    lastAutoNumber: number;
    lastResultAutoNumber: number;
    currentSelection: string;
    allSelections: string[];
    variables: any;
    toNumberOnly: typeof getAutoNumber;
    toTextOnly: typeof toTextOnly;

}

function toTextOnly(str: string) {
    if (str) {
        const number = getAutoNumber(str);
        if (number !== undefined) {
            return str.replace(number.toString(), '');
        }
    }
}

function getAutoNumber(str: string) {
    if (str) {
        const match = str.match(/(\d+(?:\.\d+)?)/);
        if (match && match[0]) {
            const parsedNumber = parseFloat(match[0]);
            return isNaN(parsedNumber) ? undefined : parsedNumber;
        }
    }
}


export class TransformCommand extends StandardCommand {
    private originalDocumentText: string;
    private originalSelections: vscode.Selection[];
    constructor() {
        super('extension.transform','Transform');
        this.helpText = `
        Description: Replaces text in current selections dynamically
        Must Return: string (replaces current selection)
        Variable: currentDocumentText (per-line, string)
        Variable: lastSelection (per-line, string)
        Variable: currentAutoNumber (per-line, number)
        Variable: selectionIndex (per-line, number)
        Variable: lastResult (per-line, string)
        Variable: lastAutoNumber (per-line, number)
        Variable: lastResultAutoNumber (per-line, number)
        Variable: currentSelection (per-line, string)
        Variable: allSelections (per-line, string[])
        Variable: variables (per-line, any)
        Variable: toNumberOnly (per-line, extracts number from string)
        Variable: toTextOnly (per-line, extract only text from string)
        `;
    }

    protected getPickerOptions() {
        const options = super.getPickerOptions();
        options.placeholder = `Example: "currentSelection + (selectionIndex + 1)"`;
        return options;
    }

    private getFullTextRange() {
        const textEditor = vscode.window.activeTextEditor;
        var firstLine = textEditor.document.lineAt(0);
        var lastLine = textEditor.document.lineAt(textEditor.document.lineCount - 1);
        return new vscode.Range(0,
            firstLine.range.start.character,
            textEditor.document.lineCount - 1,
            lastLine.range.end.character);
    }

    public async executeCore() {
        super.executeCore();
        this.originalDocumentText = vscode.window.activeTextEditor.document.getText();
        this.originalSelections = vscode.window.activeTextEditor.selections.slice(0);
    }

    protected onDidHide = async () => {
        if (!this.accepted) {
            await this.replaceWithOriginalText();
        }
    }

    private async replaceWithOriginalText() {
        await vscode.window.activeTextEditor.edit((builder) => {
            builder.replace(this.getFullTextRange(), this.originalDocumentText);
        });
        vscode.window.activeTextEditor.selections = this.originalSelections.slice(0);
    }

    protected async runCommandCore(expression: string) {        
        await this.replaceWithOriginalText();
        const currentDocument = vscode.window.activeTextEditor.document;
        if(!expression){
            return;
        }
        let context: TransformContext = {
            currentDocumentText: currentDocument.getText(),
            lastSelection: undefined,
            lastResult: undefined,
            currentSelection: undefined,
            allSelections: undefined,
            selectionIndex: undefined,
            variables: {},
            currentAutoNumber: undefined,
            lastAutoNumber: undefined,
            lastResultAutoNumber: undefined,
            toNumberOnly: getAutoNumber,
            toTextOnly,
        };
        for (let i = 0; i < vscode.window.activeTextEditor.selections.length; i++) {
            context.selectionIndex = i;
            const selections = vscode.window.activeTextEditor.selections;
            const selectionStrings = vscode.window.activeTextEditor.selections.map(s => currentDocument.getText(s));
            const selection = selectionStrings[i];
            context.allSelections = selectionStrings;
            const selectionRange = selections[i];
            context.currentSelection = selection;
            context.currentAutoNumber = getAutoNumber(selection);
            Object.seal(context);
            const result = await runWithContext(expression, context);
            context = Object.assign({}, context);
            context.lastSelection = selection;
            context.lastResult = result !== undefined && result !== null ? result.toString() : undefined;
            context.lastAutoNumber = context.currentAutoNumber;
            context.lastResultAutoNumber = getAutoNumber(result);
            if (result) {
                await vscode.window.activeTextEditor.edit((builder) => {
                    builder.replace(selectionRange, result);
                });
            }
        }
    }
}