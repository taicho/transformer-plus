import { TransformCommand } from './transformCommand';
import { SelectionsCommand } from './selectionsCommand';
import { ExtensionContext } from 'vscode';
import { SelectionsFromRegexCommand } from './selectionsFromRegexCommand';
import {GeneratorCommand} from './generatorCommand';

export function register(context: ExtensionContext) {
    (new TransformCommand()).register(context);
    (new SelectionsCommand()).register(context);
    (new SelectionsFromRegexCommand()).register(context);
    (new GeneratorCommand()).register(context);
}