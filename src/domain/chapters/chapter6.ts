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

export const chapter6Rule: ChapterRuleModule = {
  chapterId: 6,
  experiments: [
    {
      id: 'assignment-capacity',
      title: 'partition보다 많은 consumer',
      mission: '같은 group의 consumer 수와 실제 병렬 처리 수가 언제 달라지는지 확인합니다.',
      predictionPrompt: 'partition 3개에 같은 group의 consumer 5개를 연결하면 몇 개가 record를 받을까요?',
      successCriteria: '동일 group의 partition은 한 consumer에만 배정되며 초과 consumer는 idle임을 설명합니다.',
      recommendedChoiceId: 'match-parallelism-to-partitions',
      referenceIds: ['consumer-rebalance-protocol'],
      choices: [
        {
          id: 'add-consumers-only',
          label: 'consumer 5개를 모두 투입',
          description: 'partition 수는 그대로 둔 채 같은 group의 consumer만 늘립니다.',
          outcome: {
            status: 'failed',
            summary: 'consumer 두 개는 배정받을 partition이 없어 처리량 증가에 기여하지 못했습니다.',
            events: [
              event(0, 'experiment.started', 'coordinator', 'active', 'Group join 시작', 'consumer 5개가 같은 group에 합류합니다.', 'group=delivery-workers members=5 partitions=3'),
              event(180, 'state.changed', 'coordinator', 'active', 'Assignment 계산', 'coordinator가 partition 3개의 소유자를 정합니다.', 'assignment p0->c1 p1->c2 p2->c3'),
              event(320, 'evidence.observed', 'consumer', 'blocked', '초과 consumer 대기', 'c4와 c5에는 할당된 partition이 없습니다.', 'consumer=c4,c5 assigned=[] state=idle'),
              event(450, 'experiment.failed', 'consumer', 'failed', '병렬 처리 상한 도달', '같은 group의 활성 consumer 수는 partition 수를 넘을 수 없습니다.', 'active-consumers=3 requested=5'),
            ],
            diagnosis: diagnosis(
              'consumer를 늘렸지만 활성 처리자가 3개에서 증가하지 않았습니다.',
              '동일 consumer group에서는 각 partition이 한 consumer에만 배정되므로 partition 수가 병렬 처리 상한입니다.',
              ['partitions=3', 'members=5', 'assigned-members=3', 'idle-members=2'],
              'match-parallelism-to-partitions',
              'partition을 늘리면 병렬성은 커지지만 key 분산, 운영 비용, partition 간 전역 순서 부재를 함께 감수해야 합니다.',
            ),
          },
        },
        {
          id: 'match-parallelism-to-partitions',
          label: 'partition과 활성 consumer 수를 맞춤',
          description: '필요한 병렬성을 먼저 정하고 partition 3개에 consumer 3개만 활성 배치합니다.',
          outcome: {
            status: 'succeeded',
            summary: '세 partition이 각각 한 consumer에 배정되어 불필요한 idle 멤버 없이 병렬 처리합니다.',
            events: [
              event(0, 'experiment.started', 'coordinator', 'active', '용량 계획 적용', 'partition 수를 기준으로 같은 group의 활성 멤버 수를 정합니다.', 'planned partitions=3 consumers=3'),
              event(160, 'configuration.applied', 'consumer', 'active', 'Group 구성 완료', 'consumer 3개가 같은 group에 합류합니다.', 'group=delivery-workers members=3'),
              event(300, 'state.changed', 'partition', 'active', '일대일 assignment', '각 partition에 서로 다른 consumer가 배정됩니다.', 'assignment p0->c1 p1->c2 p2->c3'),
              event(430, 'experiment.succeeded', 'consumer', 'complete', '병렬 처리 확인', '모든 consumer가 고유 partition에서 record를 처리합니다.', 'active-consumers=3 idle-consumers=0'),
            ],
            diagnosis: diagnosis(
              '모든 활성 consumer가 partition을 하나씩 소유합니다.',
              'consumer 병렬성을 partition 수에 맞춰 동일 group의 assignment 용량을 낭비하지 않았습니다.',
              ['partitions=3', 'members=3', 'unique-owners=3'],
              'match-parallelism-to-partitions',
              '트래픽 증가에 대비한 여분 consumer는 빠른 대체에는 유리하지만 평상시에는 idle 자원을 소비합니다.',
            ),
          },
        },
      ],
    },
    {
      id: 'join-leave-rebalance',
      title: '멤버 변경과 소유권 이동',
      mission: 'consumer join/leave 때 partition ownership이 바뀌는 경계를 안전하게 처리합니다.',
      predictionPrompt: '처리 중인 consumer가 떠날 때 이전 소유자가 하던 작업은 자동으로 새 소유자에게 인계될까요?',
      successCriteria: 'revocation 전에 처리 경계를 정리하고 새 assignment 뒤에 처리를 재개합니다.',
      recommendedChoiceId: 'handle-revocation-and-assignment',
      referenceIds: ['consumer-rebalance-protocol', 'consumer-configs'],
      choices: [
        {
          id: 'ignore-ownership-boundary',
          label: '소유권 변경을 무시',
          description: 'revocation 중에도 이전 consumer의 비동기 처리를 계속합니다.',
          outcome: {
            status: 'failed',
            summary: '이전 소유자와 새 소유자의 처리가 겹쳐 완료 책임과 offset 증거가 불명확해졌습니다.',
            events: [
              event(0, 'experiment.started', 'consumer', 'active', 'p1 처리 시작', 'c1이 p1의 offset 41을 처리합니다.', 'owner=c1 partition=p1 offset=41'),
              event(120, 'state.changed', 'coordinator', 'active', '멤버 이탈 감지', 'c1 이탈로 group assignment가 갱신됩니다.', 'member=c1 event=leave'),
              event(220, 'state.changed', 'partition', 'blocked', 'p1 소유권 이동', 'p1이 c2에 배정되지만 c1의 작업은 아직 진행 중입니다.', 'partition=p1 revoked=c1 assigned=c2'),
              event(360, 'evidence.observed', 'offset', 'failed', '처리 경계 충돌', '두 consumer가 offset 41의 완료 책임을 주장합니다.', 'partition=p1 offset=41 workers=c1,c2'),
              event(480, 'experiment.failed', 'consumer', 'failed', '안전한 인계 실패', 'revocation과 assignment 경계를 처리하지 않았습니다.', 'rebalance-handoff=unsafe'),
            ],
            diagnosis: diagnosis(
              'partition 소유권 이동 중 동일 record의 처리 책임이 겹쳤습니다.',
              'rebalance는 partition assignment를 바꾸지만 애플리케이션의 진행 중 작업과 offset 처리를 자동 인계하지 않습니다.',
              ['p1 revoked from c1', 'p1 assigned to c2', 'offset 41 processed by two workers'],
              'handle-revocation-and-assignment',
              'revocation 때 작업을 정리하면 중복 위험은 줄지만 rebalance 완료까지 처리 지연이 생길 수 있습니다.',
            ),
          },
        },
        {
          id: 'handle-revocation-and-assignment',
          label: '소유권 경계 처리',
          description: 'revocation에서 완료된 작업을 정리하고 assignment 후 새 소유자가 이어받습니다.',
          outcome: {
            status: 'succeeded',
            summary: '처리 완료 offset과 partition ownership 경계를 명시해 새 소유자가 안전하게 재개했습니다.',
            events: [
              event(0, 'experiment.started', 'consumer', 'active', 'p1 처리 추적', 'c1이 완료된 offset과 진행 중 작업을 분리해 추적합니다.', 'owner=c1 completed=40 in-flight=41'),
              event(130, 'state.changed', 'coordinator', 'active', 'Rebalance 시작', '멤버 변경으로 assignment 갱신이 시작됩니다.', 'group=delivery-workers event=rebalance'),
              event(230, 'evidence.observed', 'offset', 'active', 'Revocation 정리', 'c1이 완료된 다음 위치 41을 기록하고 진행 중 작업을 중단합니다.', 'revoked=p1 committed-next-offset=41'),
              event(350, 'state.changed', 'partition', 'active', '새 소유자 배정', 'c2가 p1의 소유권과 재시작 위치를 받습니다.', 'assigned p1->c2 start-offset=41'),
              event(470, 'experiment.succeeded', 'consumer', 'complete', '인계 완료', 'c2가 offset 41부터 처리를 재개합니다.', 'owner=c2 partition=p1 processing-offset=41'),
            ],
            diagnosis: diagnosis(
              '새 소유자가 확인된 다음 offset부터 처리를 재개했습니다.',
              '애플리케이션이 revocation과 assignment를 명시적인 처리·commit 책임 경계로 사용했습니다.',
              ['committed-next-offset=41', 'old-owner-stopped', 'new-owner-started=41'],
              'handle-revocation-and-assignment',
              'classic과 consumer group protocol은 assignment와 timeout 설정 주체가 다르므로 protocol 변경 시 기존 튜닝 값을 그대로 가정하면 안 됩니다.',
            ),
          },
        },
      ],
    },
    {
      id: 'poll-timeout',
      title: '느린 처리와 max.poll.interval.ms',
      mission: '긴 record 처리가 poll 생존 조건을 넘지 않도록 처리 구조를 조정합니다.',
      predictionPrompt: '정상적으로 heartbeat 중이어도 poll 호출 간격이 max.poll.interval.ms를 넘으면 어떻게 될까요?',
      successCriteria: 'poll 간격을 제한 안에 유지하고 처리 지연과 group protocol 설정 책임을 구분합니다.',
      recommendedChoiceId: 'keep-poll-cadence',
      referenceIds: ['consumer-configs'],
      choices: [
        {
          id: 'block-poll-past-interval',
          label: 'poll 스레드에서 장시간 처리',
          description: 'max.poll.interval.ms=300000인데 poll 스레드를 360000ms 동안 막습니다.',
          outcome: {
            status: 'failed',
            summary: 'poll 간격 제한을 초과한 consumer가 실패한 멤버로 간주되어 partition이 재할당됐습니다.',
            events: [
              event(0, 'configuration.applied', 'consumer', 'active', 'Poll 제한 설정', '최대 poll 간격을 300000ms로 설정합니다.', 'max.poll.interval.ms=300000 group.protocol=classic'),
              event(100, 'record.dispatched', 'consumer', 'active', '느린 작업 시작', 'poll이 반환한 record를 같은 스레드에서 처리합니다.', 'processing-time-ms=360000'),
              event(300100, 'state.changed', 'coordinator', 'blocked', 'Poll 제한 초과', 'coordinator 관점에서 멤버가 poll 진행 의무를 지키지 못했습니다.', 'elapsed-since-poll-ms=300100'),
              event(300260, 'state.changed', 'partition', 'failed', 'Partition 재할당', '느린 consumer의 partition이 다른 멤버로 이동합니다.', 'reason=max.poll.interval.exceeded'),
              event(300400, 'experiment.failed', 'consumer', 'failed', '처리 결과 제출 실패', '이전 소유자의 늦은 결과는 현재 assignment와 충돌합니다.', 'commit rejected after rebalance'),
            ],
            diagnosis: diagnosis(
              '긴 처리 중 partition 소유권을 잃고 늦은 commit이 실패했습니다.',
              'heartbeat 생존과 별개로 poll 호출 간격이 max.poll.interval.ms를 초과해 멤버가 실패한 것으로 처리됐습니다.',
              ['max.poll.interval.ms=300000', 'processing-time-ms=360000', 'partition reassigned'],
              'keep-poll-cadence',
              'max.poll.interval.ms를 크게 늘리면 긴 처리는 허용하지만 실제 장애를 감지하고 재할당하는 시간도 길어집니다.',
            ),
          },
        },
        {
          id: 'keep-poll-cadence',
          label: 'poll 주기와 처리량을 함께 제한',
          description: 'poll당 record 수와 작업 시간을 제한해 다음 poll을 300000ms 안에 호출합니다.',
          outcome: {
            status: 'succeeded',
            summary: 'poll 주기를 유지하면서 완료된 record의 offset만 순서 있게 반영했습니다.',
            events: [
              event(0, 'configuration.applied', 'consumer', 'active', '처리 예산 설정', '한 poll 배치가 제한 시간 안에 끝나도록 크기를 조정합니다.', 'max.poll.interval.ms=300000 batch-budget-ms=180000'),
              event(100, 'record.dispatched', 'application', 'active', '제한된 작업 실행', '처리 완료와 offset 진행을 partition별로 추적합니다.', 'batch-size=20 worker-budget-ms=180000'),
              event(180100, 'evidence.observed', 'offset', 'active', '완료 경계 확인', '완료된 마지막 record 다음 위치를 commit 후보로 표시합니다.', 'partition=p1 next-offset=61'),
              event(180220, 'state.changed', 'consumer', 'active', '다음 poll 호출', 'max.poll.interval.ms 전에 poll loop가 재개됩니다.', 'elapsed-since-poll-ms=180220'),
              event(180360, 'experiment.succeeded', 'coordinator', 'complete', 'Group membership 유지', '재할당 없이 기존 ownership이 유지됩니다.', 'owner=c1 partition=p1 rebalance=false'),
            ],
            diagnosis: diagnosis(
              'consumer가 처리 지연 중에도 poll 진행 조건을 지켰습니다.',
              'batch 크기와 처리 예산을 제한해 poll 간격을 max.poll.interval.ms 이내로 유지했습니다.',
              ['elapsed-since-poll-ms=180220', 'max.poll.interval.ms=300000', 'rebalance=false'],
              'keep-poll-cadence',
              '작업을 별도 실행기로 넘기면 poll 생존성은 좋아지지만 pause/resume, 순서, 완료 offset 추적 책임이 애플리케이션으로 이동합니다.',
            ),
          },
        },
      ],
    },
  ],
}

