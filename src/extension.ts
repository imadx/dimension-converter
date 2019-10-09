import * as vscode from 'vscode';

const getMatchedTypeAndValue = (inputValue: string) => {
  const regexPx = /^(\d+\.?\d*|\.\d*)px$/;
  const regexRem = /^(\d+\.?\d*|\.\d*)rem$/;
  const regexNumber = /^(\d+\.?\d*|\.\d*)$/;
  const regexUnit = /#{(\d*\.?\d*)\s\*.*\$unit\s*}|#{\s*\$unit\s*\*\s*(\d*\.?\d*)}|(\d*\.?\d*)\s\*.*\$unit\s*|\s*\$unit\s*\*\s*(\d*\.?\d*)|\s*\$unit\s*/;
  const regexUnitAlone = /\$unit|#{\$unit}/;

  const valueMatchPx = inputValue.match(regexPx);
  if (valueMatchPx && !Number.isNaN(+valueMatchPx[1])) {
    return ['px', +valueMatchPx[1]];
  }

  const valueMatchRem = inputValue.match(regexRem);
  if (valueMatchRem && !Number.isNaN(+valueMatchRem[1])) {
    return ['rem', +valueMatchRem[1]];
  }

  const valueMatchNumber = inputValue.match(regexNumber);
  if (valueMatchNumber && !Number.isNaN(+valueMatchNumber[1])) {
    return ['px', +valueMatchNumber[1]];
  }

  const valueMatchUnit = inputValue.match(regexUnit);
  const matches =
    valueMatchUnit && valueMatchUnit.slice(1).filter((matched) => matched !== undefined);
  console.log('matches', matches && matches[0]);
  if (valueMatchUnit && matches && matches[0] !== undefined && !Number.isNaN(+matches[0])) {
    return ['unit', +matches[0]];
  }

  const valueMatchUnitAlone = inputValue.match(regexUnitAlone);
  if (valueMatchUnitAlone) return ['unit', 1];

  return null;
};

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('extension.dimensionconverter', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active text editor. Please open a text editor');
      return;
    }

    const hasMultipleSelections = editor.selections.length > 1;
    const updatedConvertedValues: string[] = [];
    editor.selections.forEach(async (selection) => {
      let inputValue = editor.document.getText(selection) || null;
      const isBorderStyleLine = editor.document
        .lineAt(selection.start.line)
        .text.trim()
        .startsWith('border');

      if (!inputValue && !hasMultipleSelections) {
        inputValue =
          (await vscode.window.showInputBox({
            placeHolder: `Enter a dimension to convert (eg: '10px', '1.5rem')`,
          })) || '';
      }

      const result = getMatchedTypeAndValue(inputValue || '');
      if (!result) {
        vscode.window.showWarningMessage(
          `Enter a proper dimension to convert (eg: '10px', '1.5rem')`,
        );
        updatedConvertedValues.push(inputValue || '');
        return;
      }

      const [unit, value] = result;

      let unitFactor = unit === 'rem' ? 1 : 16;

      switch (unit) {
        case 'rem':
          unitFactor = 1;
          break;
        case 'px':
          unitFactor = 16;
          break;
        case 'unit':
          unitFactor = 16 / 6;
          break;
      }

      // Check whether the line contains border, and use thin instead
      if (unit === 'px' && value === 1) {
        vscode.window.showInformationMessage(
          `It's better not to convert 1px to $units, use 'thin' where possible`,
        );
        updatedConvertedValues.push(isBorderStyleLine ? 'thin' : '1px');
        return;
      }

      // Get the value rounded off to 3 decimal places
      const multiplier = Math.floor((+value * 1000) / unitFactor) / 1000;

      let convertedValue = '';
      if (multiplier === 1) {
        // Return '$unit' if multiplier is 1
        convertedValue = '$unit';
      } else if (multiplier === 0) {
        // Return '0' if multiplier is 0
        convertedValue = '0';
      } else {
        // Updated unit converted to the required dimensions
        convertedValue = `#{$unit * ${multiplier}}`;
      }

      // replace the editor text
      updatedConvertedValues.push(convertedValue);
    });

    editor.edit((builder) => {
      editor.selections.forEach((selection, i) => {
        builder.replace(selection, updatedConvertedValues[i]);
      });
    });
  });

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
