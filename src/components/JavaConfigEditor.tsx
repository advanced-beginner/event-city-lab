import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { java } from '@codemirror/lang-java'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { useEffect, useRef } from 'react'

interface JavaConfigEditorProps {
  value: string
  onChange: (value: string) => void
}

export function JavaConfigEditor({ value, onChange }: JavaConfigEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) return

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          java(),
          EditorView.lineWrapping,
          EditorView.theme({
            '&': {
              height: '100%',
              backgroundColor: '#f7f8fa',
              color: '#344457',
              fontSize: '12px',
            },
            '.cm-content': {
              caretColor: '#0e9da0',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              padding: '12px 0',
            },
            '.cm-gutters': {
              backgroundColor: '#eef1f4',
              color: '#8995a3',
              borderRight: '1px solid #d9dee5',
            },
            '&.cm-focused': { outline: '2px solid #0e9da0' },
            '.cm-activeLine': { backgroundColor: '#e9f6f599' },
            '.cm-activeLineGutter': { backgroundColor: '#deefee' },
            '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
              backgroundColor: '#bee7e5',
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    })
  }, [value])

  return <div ref={hostRef} aria-label="Java Producer 설정 코드 편집기" />
}
