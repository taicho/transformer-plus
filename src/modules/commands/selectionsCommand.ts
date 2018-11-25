import * as vscode from 'vscode';
import * as vm from 'vm';
import { StandardCommand } from "./standardCommand";
import { runWithContext } from '../common';

interface SelectorContext {
    currentDocumentText: string;
    currentLineText: string;
    lastLineText: string;
    lineIndex: number;
    lastResults: [number, number][];
    variables: any;
}

export class SelectionsCommand extends StandardCommand {
    constructor(){
        super('extension.createSelections', 'Create Selections');
        this.helpText = `
        Example: "[0,5]" or "[[0,5],[6,8]]"        
        Description: Creates selections per-line in current file from char positions
        Must Return: [number,number] OR [number,number][]
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
        options.placeholder = `Example: "[0,5]" or "[[0,5],[6,8]]"`;
        return options;
    }

    protected async runCommandCore(expression : string) {     
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
            context.lastResults = undefined;
            context.lastLineText = line;
            if (result && result.length) {
                let selections: [number, number][] = [];
                // Is array of arrays
                if (isNaN(result[0])) {
                    selections = selections.concat(result); 
                    context.lastResults = result;
                } else {                    
                    selections.push(result as [number, number]);
                    context.lastResults = [result];
                }
                for (const selection of selections) {
                    windowSelections.push(new vscode.Selection(context.lineIndex, selection[0], context.lineIndex, selection[1]));
                }            
            }
        }
        vscode.window.activeTextEditor.selections = windowSelections;
    }
}