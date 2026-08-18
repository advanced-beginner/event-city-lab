import type {
  ChapterDiagnosis,
  ChapterEventTemplate,
  ChapterRuleModule,
} from '../chapterSimulation'

function event(
  atMs: number,
  kind: ChapterEventTemplate['kind'],
  component: ChapterEventTemplate['component'],
  state: ChapterEventTemplate['state'],
  title: string,
  detail: string,
  log: string,
): ChapterEventTemplate {
  return { atMs, kind, component, state, title, detail, log }
}

function diagnosis(
  symptom: string,
  rootCause: string,
  evidence: readonly string[],
  recommendedChoiceId: string,
  tradeOff: string,
): ChapterDiagnosis {
  return { symptom, rootCause, evidence, recommendedChoiceId, tradeOff }
}

export const chapter8Rule: ChapterRuleModule = {
  chapterId: 8,
  experiments: [
    {
      id: 'partial-transform',
      title: '출력은 쓰고 offset은 잃은 처리',
      mission: 'consume-transform-produce의 출력과 입력 offset을 따로 commit할 때 생기는 부분 성공을 관찰합니다.',
      predictionPrompt: '출력 record ACK 뒤 input offset commit 전에 장애가 나면 재시작 후 무엇이 중복될까요?',
      successCriteria: '두 독립 commit의 틈을 찾고 하나의 transaction 경계가 필요한 이유를 설명합니다.',
      recommendedChoiceId: 'use-atomic-transform-boundary',
      referenceIds: ['kafka-producer-api', 'consumer-configs'],
      choices: [
        {
          id: 'commit-output-and-offset-separately',
          label: '출력과 offset을 따로 commit',
          description: '출력 ACK를 받은 뒤 일반 consumer offset commit을 별도로 실행합니다.',
          outcome: {
            status: 'failed',
            summary: '출력만 기록된 시점에 장애가 발생해 같은 input을 다시 읽고 중복 출력을 만들었습니다.',
            events: [
              event(0, 'record.dispatched', 'consumer', 'active', 'Input 소비', 'payments p0 offset 24를 읽습니다.', 'consume payments-0@24 committed-next-offset=24'),
              event(120, 'record.dispatched', 'producer', 'active', '변환 출력 발행', 'receipt record가 별도 producer 요청으로 기록됩니다.', 'produce receipts key=payment-24 result=acked'),
              event(230, 'state.changed', 'application', 'failed', 'Offset commit 전 장애', '출력 ACK 이후 consumer offset commit 전에 프로세스가 중단됩니다.', 'crash-before-offset-commit=true'),
              event(360, 'evidence.observed', 'offset', 'failed', 'Input 재수신', '재시작한 consumer가 offset 24를 다시 읽습니다.', 'restart-position=24 replay=true'),
              event(480, 'experiment.failed', 'producer', 'failed', '중복 출력', '같은 input에서 두 번째 receipt가 기록됩니다.', 'receipts key=payment-24 count=2'),
            ],
            diagnosis: diagnosis(
              '한 input 처리로 출력 record가 두 번 생성됐습니다.',
              '출력 produce와 consumer offset commit이 서로 독립이어서 그 사이 장애가 부분 성공을 남겼습니다.',
              ['output ACK before crash', 'committed-next-offset remained 24', 'input replayed', 'output count=2'],
              'use-atomic-transform-boundary',
              'transaction은 원자성을 제공하지만 producer 상태 관리, 추가 지연, timeout과 abort 처리 복잡성을 더합니다.',
            ),
          },
        },
        {
          id: 'use-atomic-transform-boundary',
          label: '출력과 다음 offset을 transaction으로 결합',
          description: '안정적인 transactional.id를 사용해 출력과 input의 다음 offset을 같은 transaction에 넣습니다.',
          outcome: {
            status: 'succeeded',
            summary: '출력 record와 다음 consumer offset이 하나의 commit 결과로 함께 보이게 됐습니다.',
            events: [
              event(0, 'configuration.applied', 'transaction', 'active', 'Transactional producer 초기화', '인스턴스에 안정적이고 고유한 transactional.id를 설정합니다.', 'transactional.id=payments-transformer-0 initTransactions=complete'),
              event(110, 'state.changed', 'transaction', 'active', 'Transaction 시작', 'input 처리 경계를 엽니다.', 'beginTransaction tx=payments-transformer-0'),
              event(220, 'record.dispatched', 'producer', 'active', '변환 출력 추가', 'receipt record를 열린 transaction에 씁니다.', 'tx-produce receipts key=payment-24'),
              event(330, 'evidence.observed', 'offset', 'active', '다음 offset 추가', 'sendOffsetsToTransaction으로 다음 처리 위치 25와 group metadata를 포함합니다.', 'sendOffsetsToTransaction payments-0=25 group=payments-app'),
              event(450, 'state.changed', 'transaction', 'active', 'Transaction commit', '출력과 offset을 같은 transaction으로 commit합니다.', 'commitTransaction result=success'),
              event(560, 'experiment.succeeded', 'consumer', 'complete', '원자적 결과 확인', '재시작 위치는 25이고 committed 출력은 하나입니다.', 'restart-position=25 committed-output-count=1'),
            ],
            diagnosis: diagnosis(
              '출력과 입력 진행 위치가 함께 commit됐습니다.',
              'transactional.id로 초기화한 producer가 출력과 sendOffsetsToTransaction의 다음 offset을 한 transaction에 묶었습니다.',
              ['transactional.id=payments-transformer-0', 'output in transaction', 'next-offset=25 in transaction', 'commit succeeded'],
              'use-atomic-transform-boundary',
              'transactional.id는 재시작 간 안정성과 인스턴스별 고유성이 필요하며 같은 id를 공유하면 이전 producer가 fencing될 수 있습니다.',
            ),
          },
        },
      ],
    },
    {
      id: 'transactional-repair',
      title: '출력과 offset의 단일 transaction',
      mission: 'sendOffsetsToTransaction, commitTransaction, abortTransaction의 책임을 올바른 순서로 구성합니다.',
      predictionPrompt: '출력만 transaction에 넣고 input offset은 일반 commit하면 consume-transform-produce 전체가 원자적일까요?',
      successCriteria: '출력과 다음 input offset을 같은 transaction에 넣고 실패 시 전체를 abort합니다.',
      recommendedChoiceId: 'send-offsets-then-commit',
      referenceIds: ['kafka-producer-api'],
      choices: [
        {
          id: 'transactional-output-only',
          label: '출력만 transaction으로 commit',
          description: '출력은 commitTransaction하지만 input offset은 나중에 일반 consumer commit합니다.',
          outcome: {
            status: 'failed',
            summary: 'transactional 출력은 commit됐지만 input offset은 남아 재처리 시 중복된 논리 결과가 생겼습니다.',
            events: [
              event(0, 'state.changed', 'transaction', 'active', '출력 transaction 시작', 'transactional producer가 receipt를 transaction에 씁니다.', 'beginTransaction tx=payments-transformer-0'),
              event(130, 'record.dispatched', 'producer', 'active', '출력 추가', '변환된 record가 열린 transaction에 추가됩니다.', 'tx-produce receipts key=payment-31'),
              event(250, 'state.changed', 'transaction', 'active', '출력만 commit', 'consumer offset 없이 transaction을 commit합니다.', 'commitTransaction offsets-in-tx=none'),
              event(370, 'state.changed', 'application', 'failed', '일반 offset commit 전 장애', 'consumer 진행 위치가 이전 값으로 남습니다.', 'crash committed-next-offset=31'),
              event(490, 'experiment.failed', 'consumer', 'failed', '전체 경계 분리', '재시작 후 input 31이 다시 처리됩니다.', 'replay payments-0@31'),
            ],
            diagnosis: diagnosis(
              'transaction을 썼지만 input이 재처리됐습니다.',
              '출력만 transaction에 포함하고 consumer offset을 sendOffsetsToTransaction으로 묶지 않았습니다.',
              ['transactional output committed', 'offsets-in-tx=none', 'input offset 31 replayed'],
              'send-offsets-then-commit',
              'offset을 transaction에 포함하면 원자성은 얻지만 해당 consumer group 진행도 transaction 결과에 의존합니다.',
            ),
          },
        },
        {
          id: 'send-offsets-then-commit',
          label: '출력과 offset을 함께 commit하고 실패 시 abort',
          description: '출력 전송 뒤 다음 offset과 group metadata를 transaction에 넣고 단일 commit 또는 abort합니다.',
          outcome: {
            status: 'succeeded',
            summary: '성공 경로는 출력과 offset을 함께 commit하고 실패 경로는 두 결과를 모두 abort했습니다.',
            events: [
              event(0, 'configuration.applied', 'transaction', 'active', 'Producer epoch 확보', 'transactional.id로 initTransactions를 완료해 이전 인스턴스를 fencing합니다.', 'transactional.id=payments-transformer-0 initTransactions=complete'),
              event(120, 'state.changed', 'transaction', 'active', '처리 transaction 시작', 'payments p0 offset 31의 처리 경계를 엽니다.', 'beginTransaction input=payments-0@31'),
              event(240, 'record.dispatched', 'producer', 'active', '출력 transaction에 추가', 'receipt record를 transaction에 씁니다.', 'tx-produce receipts key=payment-31'),
              event(350, 'evidence.observed', 'offset', 'active', '다음 offset 결합', '다음 처리 위치 32와 consumer group metadata를 transaction에 추가합니다.', 'sendOffsetsToTransaction payments-0=32 group=payments-app'),
              event(470, 'state.changed', 'transaction', 'blocked', '재시도 가능한 오류 감지', '첫 시도의 commit 전 오류로 전체 transaction을 abort합니다.', 'abortTransaction tx-attempt=1 output-visible=false offset-advanced=false'),
              event(590, 'state.changed', 'transaction', 'active', '새 transaction 재시도', '같은 input을 새 transaction에서 다시 처리합니다.', 'beginTransaction tx-attempt=2 input=payments-0@31'),
              event(710, 'experiment.succeeded', 'transaction', 'complete', '원자적 commit 완료', '두 번째 시도의 출력과 다음 offset 32가 함께 commit됩니다.', 'commitTransaction tx-attempt=2 output-visible=true next-offset=32'),
            ],
            diagnosis: diagnosis(
              '실패 시 출력과 offset이 모두 숨겨지고 성공 시 함께 반영됐습니다.',
              '출력과 sendOffsetsToTransaction의 다음 offset을 동일 transaction에 넣어 abort/commit 결과를 공유했습니다.',
              ['attempt 1 aborted', 'aborted output not visible', 'aborted offset not advanced', 'attempt 2 committed next-offset=32'],
              'send-offsets-then-commit',
              'abort 후에는 input을 다시 처리하므로 외부 시스템 side effect까지 Kafka transaction이 자동으로 되돌리지는 않습니다.',
            ),
          },
        },
      ],
    },
    {
      id: 'isolation-visibility',
      title: 'read_committed의 가시성',
      mission: 'open, aborted, committed transaction이 consumer isolation.level에 따라 어떻게 보이는지 비교합니다.',
      predictionPrompt: 'read_committed consumer는 broker에 이미 append된 모든 transactional record를 즉시 읽을까요?',
      successCriteria: 'committed transactional record만 반환하며 진행 중 transaction의 LSO까지만 읽는 이유를 설명합니다.',
      recommendedChoiceId: 'read-committed-to-lso',
      referenceIds: ['consumer-configs', 'topic-configs'],
      choices: [
        {
          id: 'read-uncommitted-results',
          label: 'read_uncommitted로 결과 소비',
          description: 'transaction 최종 상태와 무관하게 append된 record를 읽습니다.',
          outcome: {
            status: 'failed',
            summary: 'consumer가 나중에 abort된 transaction의 출력까지 업무 결과로 처리했습니다.',
            events: [
              event(0, 'configuration.applied', 'consumer', 'active', '격리 수준 설정', '결과 consumer가 read_uncommitted를 사용합니다.', 'isolation.level=read_uncommitted'),
              event(120, 'record.dispatched', 'transaction', 'active', '진행 중 출력 append', 'transaction T9의 record가 log에 append되지만 아직 commit되지 않았습니다.', 'offset=90 tx=T9 state=open'),
              event(240, 'evidence.observed', 'consumer', 'active', '미확정 record 반환', 'consumer가 T9 record를 poll 결과로 받습니다.', 'poll returned offset=90 tx=T9 state=open'),
              event(360, 'state.changed', 'transaction', 'failed', 'Transaction abort', 'producer가 T9를 abort합니다.', 'tx=T9 state=aborted'),
              event(480, 'experiment.failed', 'application', 'failed', '취소된 결과 처리', '애플리케이션이 abort된 출력을 이미 반영했습니다.', 'processed offset=90 final-tx-state=aborted'),
            ],
            diagnosis: diagnosis(
              '최종적으로 abort된 record가 업무 결과에 반영됐습니다.',
              'read_uncommitted consumer는 transactional record의 commit 여부와 무관하게 append된 record를 반환할 수 있습니다.',
              ['isolation.level=read_uncommitted', 'T9 open record returned', 'T9 later aborted'],
              'read-committed-to-lso',
              'read_uncommitted는 열린 transaction에 가로막히지 않지만 abort될 수 있는 중간 결과를 노출합니다.',
            ),
          },
        },
        {
          id: 'read-committed-to-lso',
          label: 'read_committed와 LSO 사용',
          description: 'committed transactional record만 읽고 진행 중 transaction보다 뒤의 구간은 확정될 때까지 기다립니다.',
          outcome: {
            status: 'succeeded',
            summary: 'aborted record는 제외되고 open transaction의 LSO 뒤 record는 transaction 결과가 정해진 후 반환됐습니다.',
            events: [
              event(0, 'configuration.applied', 'consumer', 'active', '격리 수준 설정', '결과 consumer가 read_committed를 사용합니다.', 'isolation.level=read_committed'),
              event(120, 'state.changed', 'transaction', 'active', '두 transaction 상태 관찰', 'T9는 abort됐고 T10은 offset 94에서 아직 진행 중입니다.', 'tx=T9 state=aborted offsets=90-91; tx=T10 state=open first-offset=94'),
              event(240, 'evidence.observed', 'offset', 'blocked', 'LSO 경계 확인', 'open transaction T10 때문에 Last Stable Offset은 94입니다.', 'LSO=94 high-watermark=99 poll-range=<94'),
              event(360, 'evidence.observed', 'consumer', 'active', '확정 record만 반환', 'T9의 aborted record를 건너뛰고 LSO 이전 committed record만 반환합니다.', 'returned=committed-only aborted-offsets=90,91 excluded=true'),
              event(480, 'state.changed', 'transaction', 'active', 'Open transaction commit', 'T10이 commit되어 LSO가 앞으로 이동합니다.', 'tx=T10 state=committed new-LSO=100'),
              event(600, 'experiment.succeeded', 'consumer', 'complete', '확정 결과 소비', 'T10의 record와 뒤의 확정 구간이 이제 반환됩니다.', 'returned-through-offset=99 isolation=read_committed'),
            ],
            diagnosis: diagnosis(
              'consumer가 abort된 출력은 제외하고 commit이 확정된 결과만 처리했습니다.',
              'read_committed는 open transaction의 첫 offset인 LSO까지만 읽고 committed transactional record만 반환합니다.',
              ['aborted T9 excluded', 'open T10 first-offset=94', 'LSO=94 before commit', 'T10 returned after commit'],
              'read-committed-to-lso',
              'read_committed는 원자적 결과를 제공하지만 오래 열린 transaction이 LSO를 붙잡아 보이는 consumer lag와 지연을 키울 수 있습니다.',
            ),
          },
        },
      ],
    },
  ],
}

