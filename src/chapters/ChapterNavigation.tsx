import styles from '../App.module.css'
import { chapterHash } from '../routing/chapterRoute'
import { CHAPTERS, type ChapterId } from './registry'

interface ChapterNavigationProps {
  activeChapterId: ChapterId
}

export function ChapterNavigation({ activeChapterId }: ChapterNavigationProps) {
  return (
    <nav className={styles.chapterNav} aria-label="챕터 이동">
      {CHAPTERS.map((chapter) => (
        <a
          key={chapter.id}
          href={chapterHash(chapter.id)}
          className={chapter.id === activeChapterId ? styles.chapterNavActive : undefined}
          aria-current={chapter.id === activeChapterId ? 'page' : undefined}
          aria-label={`Chapter ${chapter.id}: ${chapter.shortTitle}${chapter.implementationStatus === 'planned' ? ', 준비 중' : ''}`}
          title={`${chapter.numberLabel} · ${chapter.title}`}
        >
          {chapter.numberLabel}
        </a>
      ))}
    </nav>
  )
}
