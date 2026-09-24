import { history, historyKeymap, insertNewline, standardKeymap } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
  type Command,
  type ViewUpdate,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { traceLinesField } from './traceLines';

const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: '#1e1e1e', color: '#d4d4d4' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.25' },
    '.cm-content': { padding: '4px 0', caretColor: '#aeafad' },
    '.cm-line': { padding: '0 4px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#aeafad' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: '#264f78',
    },
    '.cm-content ::selection': { backgroundColor: '#264f78' },
    '.cm-gutters': { backgroundColor: '#252526', color: '#969696', border: 'none' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px', minWidth: '0' },
    '.cm-gutterElement.cm-tracedLineNumber': { backgroundColor: '#554117', color: '#ffde82', fontWeight: 'bold' },
    '.cm-activeLine': { backgroundColor: 'rgba(60, 60, 66, 0.5)' },
    '.cm-line.cm-traceLine': { backgroundColor: 'rgba(60, 73, 96, 0.8)' },
    '.cm-line.cm-traceLine-active': { backgroundColor: 'rgba(108, 75, 18, 0.8)' },
    '.cm-line.cm-traceLine, .cm-line.cm-traceLine *': { color: '#ffe39d', fontWeight: 'bold' },
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
    color: '#569cd6',
  },
  { tag: tags.controlKeyword, color: '#c586c0' },
  { tag: [tags.typeName, tags.standard(tags.typeName), tags.namespace], color: '#4ec9b0' },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.function(tags.definition(tags.variableName)),
    ],
    color: '#dcdcaa',
  },
  { tag: [tags.number, tags.literal], color: '#b5cea8' },
  { tag: [tags.string, tags.special(tags.string), tags.character], color: '#ce9178' },
  { tag: tags.escape, color: '#d7ba7d' },
  { tag: [tags.lineComment, tags.blockComment, tags.comment], color: '#6a9955' },
  { tag: [tags.processingInstruction, tags.meta], color: '#c586c0' },
  { tag: tags.special(tags.name), color: '#4fc1ff' },
]);

export function createEditorExtensions(onUpdate: (update: ViewUpdate) => void): Extension[] {
  return [
    editorTheme,
    lineNumbers(),
    history(),
    drawSelection(),
    highlightActiveLine(),
    EditorState.tabSize.of(4),
    keymap.of([
      { key: 'Enter', run: insertNewline, shift: insertNewline },
      { key: 'Tab', run: insertTabCharacter, preventDefault: true },
      ...standardKeymap,
      ...historyKeymap,
    ]),
    cpp(),
    syntaxHighlighting(syntaxColors),
    traceLinesField,
    EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
    EditorView.updateListener.of(onUpdate),
  ];
}
