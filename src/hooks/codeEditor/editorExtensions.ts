import { linter, lintGutter, lintKeymap } from '@codemirror/lint';
import { lintCppSyntax } from './linting';
import {
  acceptCompletion,
  startCompletion,
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';
import { history, historyKeymap, insertNewlineAndIndent, standardKeymap } from '@codemirror/commands';
import { cpp, cppLanguage } from '@codemirror/lang-cpp';
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
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
    '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.6' },
    '.cm-content': { padding: '12px 0', caretColor: 'var(--foreground)' },
    '.cm-line': { padding: '0 12px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--foreground)' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'var(--editor-selection)',
    },
    '.cm-content ::selection': { backgroundColor: 'var(--editor-selection)' },
    '.cm-gutters': {
      backgroundColor: 'var(--editor-gutter)',
      color: 'var(--muted-foreground)',
      border: 'none',
      borderRight: '1px solid var(--border)',
    },
    '.cm-activeLineGutter': { backgroundColor: 'var(--editor-line)', color: 'var(--foreground)', fontWeight: '600' },
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
      borderRadius: '8px',
      boxShadow: '0 8px 24px rgb(0 0 0 / 16%)',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--selection)',
      color: 'var(--selection-foreground)',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul': {
      fontFamily: 'inherit',
      width: 'min(520px, calc(100vw - 32px))',
      minWidth: '0',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'min(288px, 40vh)',
      padding: '4px',
    },
    '.cm-tooltip.cm-tooltip-autocomplete > ul > li': {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minHeight: '32px',
      padding: '4px 8px',
      borderRadius: '4px',
      lineHeight: '1.5',
      fontSize: '12px',
    },
    '.cm-completionIcon': { flex: '0 0 16px', paddingRight: '0', opacity: '0.8' },
    '.cm-completionLabel': { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' },
    '.cm-completionMatchedText': { fontWeight: '700', textDecoration: 'none' },
    '.cm-completionDetail': {
      flex: '0 1 40%',
      minWidth: '0',
      marginLeft: 'auto',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      fontStyle: 'normal',
      opacity: '0.75',
      fontSize: '11px',
    },
    '.cm-tooltip.cm-completionInfo': {
      width: 'min(380px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'min(240px, 35vh)',
      overflow: 'auto',
      padding: '12px',
      fontSize: '12px',
      lineHeight: '1.6',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    },
    '.cm-panel.cm-panel-lint': {
      backgroundColor: 'var(--card)',
      color: 'var(--foreground)',
      borderTop: '1px solid var(--border)',
    },
    '.cm-panel.cm-panel-lint ul': { maxHeight: '160px' },
    '.cm-panel.cm-panel-lint ul [aria-selected], .cm-panel.cm-panel-lint ul:focus [aria-selected]': {
      backgroundColor: 'var(--secondary)',
      color: 'var(--foreground)',
    },
    '.cm-panel.cm-panel-lint [aria-selected] u': { textDecoration: 'none' },
    '.cm-diagnostic': { padding: '8px 28px 8px 12px', fontSize: '12px', lineHeight: '1.5', whiteSpace: 'normal' },
    '.cm-diagnostic-error': { borderLeftColor: 'var(--destructive)' },
    '.cm-diagnosticSource': { color: 'var(--muted-foreground)' },
    '.cm-tooltip-lint': { maxWidth: 'min(420px, calc(100vw - 24px))' },
    '@media (max-width: 600px)': {
      '.cm-tooltip.cm-tooltip-autocomplete > ul': { maxHeight: 'min(224px, 30vh)' },
      '.cm-tooltip.cm-completionInfo': {
        position: 'static !important',
        width: '100%',
        maxHeight: 'min(160px, 20vh)',
        margin: '4px 0 0',
        border: 'none',
        borderTop: '1px solid var(--border)',
        borderRadius: '0 0 8px 8px',
        boxShadow: 'none',
      },
    },
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
    highlightActiveLineGutter(),
    EditorState.tabSize.of(4),
    indentUnit.of('\t'),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    autocompletion(),
    linter((view) => lintCppSyntax(view.state.doc.toString()), { delay: 500 }),
    lintGutter(),
    keymap.of([
      { mac: 'Meta-Shift-Space', run: startCompletion, preventDefault: true },
      ...lintKeymap,
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
