import { Command } from "./command";
import * as vscode from 'vscode';
import * as vm from 'vm';
import { CancellationToken } from "../common";
import { getState, setState } from "../stateManager";


export abstract class StandardCommand extends Command {
    protected resultHistory: string[] = [];
    protected executeItem: vscode.QuickPickItem = { label: '', alwaysShow: false };
    protected picker: vscode.QuickPick<vscode.QuickPickItem>;
    protected result: string;
    protected maxHistoryLength = 10;
    protected helpText: string;
    protected helpTextVisible = false;
    private skipForHelp = false;
    protected accepted = false;
    private cancelletionToken: CancellationToken;     
    private lastImediate: any;
    private clearHistoryOnAccept = false;
    protected title: string;
    private activeChangeEvent: vscode.Disposable;
    constructor(id: string, title?: string, protected executeOnValueChange = true) {
        super(id);
        this.title = `${title ? title + ': ' : ''}Press ESC to cancel changes, ENTER to accept`;
        this.resultHistory = getState<string[]>(`${id}.history`) || [];                
    }

    protected resetState() {
        this.helpTextVisible = false;
        this.skipForHelp = false;
        this.accepted = false;
        this.clearHistoryOnAccept = false;
        this.resultHistory = getState<string[]>(`${this.id}.history`) || [];
    }

    protected getPickerOptions() {
        const options: any = {};
        options.items = [].concat(this.resultHistory.map((r) => {
            return { label: r, alwaysShow: true };
        }));
        options.title = this.title;
        options.matchOnDescription = false;
        options.matchOnDetail = false;
        options.activeItems = [];
        return options;
    }

    protected getPicker() {
        if (this.picker) {
            this.picker.dispose();
        }
        this.picker = vscode.window.createQuickPick();
        Object.assign(this.picker, this.getPickerOptions());
        this.picker.onDidAccept(this.onDidAccept);
        this.picker.onDidChangeValue(this.onDidValueChange);
        this.picker.onDidHide(this.onDidHide);
        this.picker.onDidChangeSelection(this.onDidChangeSelection);
        this.picker.onDidChangeActive(this.onDidChangeActive);
        return this.picker;
    }

    protected showHelpText() {
        let items = [{ label: 'Clear History', alwaysShow: true }];
        if (this.helpText) {
            items = items.concat(this.helpText.split('\n').filter(f => f.trim()).map((t, i) => { return { label: `${t.trim()}`, alwaysShow: true }; }));
        }
        this.helpTextVisible = true;
        this.picker.items = items;
    }

    protected showHistory() {
        this.picker.items = [].concat(this.resultHistory.map((r) => {
            return { label: r, alwaysShow: true };
        }));
        this.helpTextVisible = false;
        this.skipForHelp = true;
    }

    protected async addToHistory(item: string) {
        if (!this.resultHistory.some(r => r.trim() === item.trim())) {
            this.resultHistory.push(item);
            if (this.resultHistory.length > this.maxHistoryLength) {
                this.resultHistory.shift();
            }
            await setState(`${this.id}.history`, this.resultHistory);
        }
    }

    public async runCommand(result: string) {
        try {
            console.log('Command run started.');
            this.picker.busy = true;
            if (this.cancelletionToken) {
                this.cancelletionToken.isCancellationRequested = true;
            }
            this.cancelletionToken = {};
            await this.runCommandCore(result, this.cancelletionToken);
            this.picker.busy = false;
            console.log('Command run finished.');
        } catch {
            console.log('Command run finished w/ error.');
            return;
        }

    }

    public async executeCore() {
        console.log('EXECUTE CALLED.==================================');        
        this.resetState();
        const picker = this.getPicker();
        picker.show();
    }

    private async clearHistory() {
        await setState(`${this.id}.history`,[]);
    }

    protected onDidAccept = async () => {
        if(this.clearHistoryOnAccept){
            await this.clearHistory();
            this.execute();
            return;
        }        
        this.accepted = true;
        const value = this.result;
        if (value) {
            await this.addToHistory(value);
        }
        this.picker.hide();
        if (!this.executeOnValueChange || this.result !== this.picker.value) {
            await this.runCommand(value);
        }
    }

    protected onDidChangeActive = (items: vscode.QuickPickItem[]) => {
        if (items.length) {
            if (this.lastImediate) {
                clearImmediate(this.lastImediate);
            }
            this.lastImediate = setImmediate(() => {
                if (!this.helpTextVisible && !this.skipForHelp) {
                    this.picker.value = items[0].label;
                    this.result = this.picker.value;
                    this.runCommand(this.result);
                } else if(this.helpTextVisible && items[0] && items[0].label === 'Clear History'){
                    this.clearHistoryOnAccept = true;
                } else {
                    this.clearHistoryOnAccept = false;
                }
                this.skipForHelp = false;
            });
        }
    }

    protected onDidChangeSelection = (items: vscode.QuickPickItem[]) => {
        console.log('selection changed');
    }


    protected onDidHide = () => {
        this.picker.dispose();
        this.picker = null;
    }

    protected onDidValueChange = async (value: string) => {
        if (value && value.trim().startsWith('?')) {
            this.showHelpText();
        } else if (this.helpTextVisible) {
            this.showHistory();
        }
        if (this.lastImediate) {
            clearImmediate(this.lastImediate);
            this.lastImediate = null;
        }
        if (this.helpTextVisible) {
            return;
        }
        this.picker.activeItems = [];
        this.result = value;
        console.log('value changed');
        if (this.executeOnValueChange) {
            await this.runCommand(this.result);
        }
    }

    protected async abstract runCommandCore(result: string, cancelletionToken?: CancellationToken): Promise<void>;
}