import { Command } from "./command";
import * as vscode from 'vscode';
import * as vm from 'vm';
import { StandardCommand } from "./standardCommand";
import { runWithContext, CancellationToken } from "../common";
import * as path from 'path';


interface IterationObject {
    iterations: number;
    func: () => void;
}
interface GeneratorContext {
    currentDocumentText: string;
    lastResult: IterationObject;
    iterationNumber: number;
    variables: any;
}



export class GeneratorCommand extends StandardCommand {
    private originalDocumentText: string;
    private originalCursorPosition: vscode.Position;
    constructor() {
        super('extension.generatorCommand', 'Generator');
        this.helpText = `
        Example: "return {iterations: 5, func: ()=>{return 'abc\\n';}};
        Example: "({iterations: 5, func: ()=>{return 'abc\\n';}})"
        Description: Generate text dynamically.
        Must Return: { iterations: number, func: function that returns value};
        Variable: currentDocumentText (string)
        Variable: lastResult (last generated value)                
        Variable: iterationNumber (number)        
        Variable: variables (user-defined variables)  
        `;
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
        this.originalCursorPosition = vscode.window.activeTextEditor.selection.active;
    }

    protected onDidHide = async () => {
        if (!this.accepted) {
            await this.replaceWithOriginalText();
        }
    }

    protected getPickerOptions() {
        const options = super.getPickerOptions();
        options.placeholder = `Example: "return {iterations: 5, func: ()=>{return 'abc';}};" `;
        return options;
    }

    private async replaceWithOriginalText() {
        await vscode.window.activeTextEditor.edit((builder) => {
            builder.replace(this.getFullTextRange(), this.originalDocumentText);
        });
        vscode.window.activeTextEditor.selections = [new vscode.Selection(this.originalCursorPosition.line, this.originalCursorPosition.character, this.originalCursorPosition.line, this.originalCursorPosition.character)];
    }

    protected async runCommandCore(expression: string, cancellationToken: CancellationToken) {
        if (cancellationToken.isCancellationRequested) {
            return;
        }    
        console.log(`Last Expression: ${expression}`);
        await this.replaceWithOriginalText();
        if (!expression) {
            return;
        }
        const currentDocument = vscode.window.activeTextEditor.document;

        let context: GeneratorContext = {
            currentDocumentText: currentDocument.getText(),
            lastResult: undefined,
            iterationNumber: undefined,
            variables: {},
        };
        let initialResult;
        try {
            initialResult = await runWithContext(expression, context, false, { requireFrom: vscode.window.activeTextEditor.document.uri.path }) as IterationObject;
        } catch {
            return;
        }
        if (!initialResult || !initialResult.iterations || isNaN(initialResult.iterations)) {
            return;
        }
        const values = [];
        for (let i = 0; i < initialResult.iterations; i++) {
            if (cancellationToken.isCancellationRequested) {
                return;
            }
            context.iterationNumber = i + 1;
            Object.seal(context);
            const result = await runWithContext(`${expression}`, context, true, { requireFrom: vscode.window.activeTextEditor.document.uri.path }) as IterationObject;
            context = Object.assign({}, context);
            if (result && result.func) {
                let valueResult: any;
                try {
                    valueResult = result.func();
                } catch {
                    continue;
                }
                if (valueResult !== undefined || valueResult !== null) {
                    values.push(valueResult);
                }
            }
        }
        if (values.length) {
            if (cancellationToken.isCancellationRequested) {
                return;
            }
            await vscode.window.activeTextEditor.edit((builder) => {
                if (cancellationToken.isCancellationRequested) {
                    return;
                }
                builder.insert(this.originalCursorPosition, values.join(''));
            });
        }
    }
}