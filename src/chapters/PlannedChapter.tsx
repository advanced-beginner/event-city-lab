import styles from '../App.module.css'
import {
  APP_VERSION,
  CONTENT_VERSION,
  KAFKA_RULE_VERSION,
} from '../domain/simulation'
import { getChapterScenarioSpec } from '../content/chapterScenarioSpecs'
import { ChapterNavigation } from './ChapterNavigation'
import type { ChapterMetadata } from './registry'

interface PlannedChapterProps {
  chapter: ChapterMetadata
}

export function PlannedChapter({ chapter }: PlannedChapterProps) {
  if (chapter.id === 1) {
    throw new Error('Chapter 1 must be rendered by the implemented lab.')
  }

  const scenario = getChapterScenarioSpec(chapter.id)

  return (
    <main className={`${styles.appShell} ${styles.plannedChapterShell}`}>
      <header className={styles.topbar}>
        <div className={styles.brandBlock}>
          <div className={styles.logoMark} aria-hidden="true">
            <svg viewBox="0 0 48 48"><path d="m5 17 19-10 19 10-19 10z" /><path d="M5 17v15l19 10V27z" /><path d="M24 27v15l19-10V17z" /></svg>
          </div>
          <div>
            <p className={styles.kicker}>EVENT CITY · CHAPTER {chapter.numberLabel}</p>
            <h1>{chapter.title}</h1>
          </div>
        </div>
        <div className={styles.headerMeta}>
          <ChapterNavigation activeChapterId={chapter.id} />
          <span className={styles.missionBadge}>준비 중</span>
        </div>
      </header>

      <section className={styles.plannedChapter} aria-labelledby="planned-chapter-title">
        <div className={styles.plannedChapterCard}>
          <p className={styles.kicker}>CHAPTER {chapter.numberLabel} · PLANNED</p>
          <span className={styles.plannedChapterIndex} aria-hidden="true">{chapter.numberLabel}</span>
          <h2 id="planned-chapter-title">{chapter.title}</h2>
          <p className={styles.plannedTopic}>{chapter.topic}</p>
          <p>{chapter.learningGoal}</p>
          <ol className={styles.plannedExperiments} aria-label="예정된 실험">
            {scenario.experiments.map((experiment, index) => (
              <li key={experiment.id}>
                <span>{index + 1}</span>
                <div><strong>{experiment.title}</strong><small>{experiment.failureOrQuestion}</small></div>
              </li>
            ))}
          </ol>
          <div className={styles.plannedNotice} role="status">
            <strong>이 챕터는 아직 실험 엔진에 연결되지 않았습니다.</strong>
            <span>잠금 없이 전체 학습 지도를 탐색할 수 있으며, Chapter 1 실험은 계속 사용할 수 있습니다.</span>
          </div>
          <a className={styles.returnToLab} href="#/chapter/1">Chapter 1 실험으로 돌아가기</a>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Event City Lab v{APP_VERSION}</span><span>Content {CONTENT_VERSION}</span><span>Kafka rules {KAFKA_RULE_VERSION}</span><span>학습용 시뮬레이터 · Apache Kafka 및 ASF와 공식 제휴되지 않음</span>
      </footer>
    </main>
  )
}
