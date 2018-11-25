import { Command } from "./command";
import * as vscode from 'vscode';
import * as vm from 'vm';
import { StandardCommand } from "./standardCommand";
import { runWithContext } from "../common";

interface SelectorContext {
    currentDocumentText: string;
    currentLineText: string;
    lastLineText: string;
    lineIndex: number;
    lastResults: [number, number][];
    variables: any;
}

export class SelectionsFromRegexCommand extends StandardCommand {
    constructor() {
        super('extension.createSelectionsFromRegex', 'Selections from Regex');
        this.helpText = `
        Example(s): "/abc/i" or "'abc'" or "return /abc/i;"
        Description: Creates selections from a RegExp or string
        Must Return: RegExp or string
        Variable: currentDocumentText (string)
        Variable: currentLineText (per-line, string)
        Variable: lastLineText (per-line, string)
        Variable: lineIndex (per-line, number)
        Variable: lastResults (per-line, [number,number][])
        Variable: variables (user-defined variables)        
        `;
    }    

    protected getPickerOptions() {
        const options = super.getPickerOptions();
        options.placeholder = `Example(s): "/abc/i" or "'abc'" or "return /abc/i;"`;
        return options;
    }

    protected createEmptySelection() {
        vscode.window.activeTextEditor.selections = [new vscode.Selection(0, 0, 0, 0)];
    }

    protected async runCommandCore(expression: string) {      
        if(!expression){
            return;
        }  
        const currentDocument = vscode.window.activeTextEditor.document;

        let context: SelectorContext = {
            currentDocumentText: currentDocument.getText(),
            currentLineText: undefined,
            lastLineText: undefined,
            lineIndex: undefined,
            lastResults: undefined,
            variables: {},            
        };
        const lines = context.currentDocumentText.split('\n');
        const windowSelections = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            context.lineIndex = i;
            context.currentLineText = line;
            Object.seal(context);
            const result = await runWithContext(expression, context);
            context = Object.assign({}, context);            
            context.lastLineText = line;
            if (result) {
                let expression: RegExp;
                let isGlobalExpression = true;
                if (result.constructor && result.constructor.name === 'RegExp') {
                    expression = result;
                } else if (typeof result === 'string') {
                    expression = new RegExp(result, 'g');
                }
                if (!expression) {
                    return;
                } else {
                    isGlobalExpression = expression.flags.toLowerCase().includes('g');
                }
                let selections: [number, number][] = [];
                let match = expression.exec(line);
                while (match) {
                    selections.push([match.index, match.index + match[0].length]);
                    if (isGlobalExpression) {
                        match = expression.exec(line);
                    } else {
                        match = null;
                    }
                }
                context.lastResults = selections;
                for (const selection of selections) {
                    windowSelections.push(new vscode.Selection(context.lineIndex, selection[0], context.lineIndex, selection[1]));
                }
            }
        }
        if (!windowSelections.length) {
            windowSelections.push(new vscode.Selection(0, 0, 0, 0));
        }
        vscode.window.activeTextEditor.selections = windowSelections;
    }
}