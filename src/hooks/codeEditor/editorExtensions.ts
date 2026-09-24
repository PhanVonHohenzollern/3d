import { acceptCompletion, autocompletion, closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { history, historyKeymap, insertNewlineAndIndent, standardKeymap } from '@codemirror/commands';
import { cpp, cppLanguage } from '@codemirror/lang-cpp';
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
  placeholder,
  type Command,
  type ViewUpdate,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { traceLinesField } from './traceLines';
import { codeCompletions } from './completions';

const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: 'var(--editor)', color: 'var(--foreground)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.7' },
    '.cm-content': { padding: '16px 0', caretColor: 'var(--foreground)' },
    '.cm-line': { padding: '0 12px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'var(--editor-selection)',
    },
    '.cm-content ::selection': { backgroundColor: 'var(--editor-selection)' },
    '.cm-gutters': { backgroundColor: 'var(--editor)', color: 'var(--muted-foreground)', border: 'none' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 16px', minWidth: '0' },
    '.cm-gutterElement.cm-tracedLineNumber': {
      backgroundColor: 'var(--trace)',
      color: 'var(--trace-foreground)',
      fontWeight: 'bold',
    },
    '.cm-activeLine': { backgroundColor: 'var(--editor-line)' },
    '.cm-line.cm-traceLine': { backgroundColor: 'var(--secondary)' },
    '.cm-line.cm-traceLine-active': { backgroundColor: 'var(--trace)' },
    '.cm-line.cm-traceLine, .cm-line.cm-traceLine *': { color: 'var(--trace-foreground)', fontWeight: 'bold' },
    '.cm-placeholder': { color: 'var(--muted-foreground)' },
    '.cm-tooltip': {
      backgroundColor: 'var(--card)',
      color: 'var(--foreground)',
      border: '1px solid var(--border)',
      borderRadius: '6px',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--selection)',
      color: 'var(--selection-foreground)',
    },
    '.cm-tooltip-autocomplete': { maxWidth: 'min(600px, 90vw)' },
    '.cm-completionDetail': { marginLeft: '1em', opacity: '0.7' },
    '.cm-completionInfo': { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
  },
  { dark: true },
);

const insertTabCharacter: Command = (view) => {
  view.dispatch(view.state.replaceSelection('\t'), { scrollIntoView: true, userEvent: 'input' });

  return true;
};

const syntaxColors = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.definitionKeyword, tags.modifier, tags.operatorKeyword, tags.self, tags.null, tags.bool],
    color: 'var(--syntax-keyword)',
  },
  { tag: tags.controlKeyword, color: 'var(--syntax-control)' },
  { tag: [tags.typeName, tags.standard(tags.typeName), tags.namespace], color: 'var(--syntax-type)' },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.function(tags.definition(tags.variableName)),
    ],
    color: 'var(--syntax-function)',
  },
  { tag: [tags.number, tags.literal], color: 'var(--syntax-number)' },
  { tag: [tags.string, tags.special(tags.string), tags.character], color: 'var(--syntax-string)' },
  { tag: tags.escape, color: 'var(--syntax-string)' },
  { tag: [tags.lineComment, tags.blockComment, tags.comment], color: 'var(--syntax-comment)' },
  { tag: [tags.processingInstruction, tags.meta], color: 'var(--syntax-control)' },
  { tag: tags.special(tags.name), color: 'var(--syntax-type)' },
]);

export function createEditorExtensions(onUpdate: (update: ViewUpdate) => void): Extension[] {
  return [
    editorTheme,
    lineNumbers(),
    placeholder('Write or paste C++ geometry code here…'),
    history(),
    drawSelection(),
    highlightActiveLine(),
    EditorState.tabSize.of(4),
    indentUnit.of('\t'),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    keymap.of([
      ...closeBracketsKeymap,
      { key: 'Enter', run: insertNewlineAndIndent, shift: insertNewlineAndIndent },
      { key: 'Tab', run: acceptCompletion },
      { key: 'Tab', run: insertTabCharacter, preventDefault: true },
      ...standardKeymap,
      ...historyKeymap,
    ]),
    cpp(),
    cppLanguage.data.of({ autocomplete: codeCompletions }),
    syntaxHighlighting(syntaxColors),
    traceLinesField,
    EditorView.contentAttributes.of({
      spellcheck: 'false',
      autocorrect: 'off',
      autocapitalize: 'off',
      'aria-label': 'C++ code editor',
    }),
    EditorView.updateListener.of(onUpdate),
  ];
}
