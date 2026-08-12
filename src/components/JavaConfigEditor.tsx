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
              backgroundColor: '#07111f',
              color: '#dcecff',
              fontSize: '12px',
            },
            '.cm-content': {
              caretColor: '#42e8e0',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              padding: '12px 0',
            },
            '.cm-gutters': {
              backgroundColor: '#0b1729',
              color: '#536b85',
              border: 'none',
            },
            '&.cm-focused': { outline: '2px solid #42e8e0' },
            '.cm-activeLine': { backgroundColor: '#12243b99' },
            '.cm-activeLineGutter': { backgroundColor: '#12243b' },
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
