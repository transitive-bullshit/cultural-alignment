import type { ComponentType } from 'react'

import { cn } from '@/lib/utils'

import type {
  SocialImagePrototypeData,
  SocialImageScenario,
  SocialImageVariantProps
} from './prototype-types'

import styles from './social-image-prototype.module.css'

type SocialImageDefinition = Readonly<{
  name: string
  rationale: string
  Component: ComponentType<SocialImageVariantProps>
}>

function getScenario(data: SocialImagePrototypeData, slug: string) {
  const scenario = data.scenarios.find((candidate) => candidate.slug === slug)
  if (!scenario) throw new Error(`Missing social image prototype data: ${slug}`)
  return scenario
}

function Still({
  scenario,
  className,
  tone = 'color'
}: {
  readonly scenario: SocialImageScenario
  readonly className?: string
  readonly tone?: 'color' | 'washed' | 'dark'
}) {
  return (
    <div className={cn(styles.still, className)} data-tone={tone}>
      <img
        src={scenario.image.src}
        alt=''
        width={scenario.image.width}
        height={scenario.image.height}
        loading='eager'
        decoding='sync'
      />
    </div>
  )
}

function Brand({ className }: { readonly className?: string }) {
  return (
    <div className={cn(styles.brand, className)}>
      <strong>Cultural Alignment</strong>
      <span>Pop culture through an AI safety lens</span>
    </div>
  )
}

function CornerBrackets() {
  return (
    <span className={styles.brackets} aria-hidden='true'>
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

function DecodedFrameVariant({ data }: SocialImageVariantProps) {
  const frames = [
    getScenario(data, 'lacie-games-her-rating'),
    getScenario(data, 'gps-into-the-lake'),
    getScenario(data, 'keep-summer-safe'),
    getScenario(data, 'auto-enforces-directive-a113'),
    getScenario(data, 'skynet-launches-judgment-day')
  ]

  return (
    <section className={cn(styles.artboard, styles.decoded)}>
      <Brand className={styles.decodedBrand} />
      <h2>
        Familiar stories.
        <em>Real AI risks.</em>
      </h2>

      <div className={styles.decodedStrip} aria-hidden='true'>
        {frames.map((scenario, index) => (
          <div key={scenario.slug} data-frame={index + 1}>
            <Still
              scenario={scenario}
              tone={index === 2 ? 'color' : 'washed'}
            />
            {index === 2 ? <CornerBrackets /> : null}
          </div>
        ))}
      </div>

      <div className={styles.decodedPlate}>
        <dl>
          <div>
            <dt>Scene</dt>
            <dd>Keep Summer Safe</dd>
          </div>
          <div>
            <dt>Pattern</dt>
            <dd>Literal goal. Missing constraints.</dd>
          </div>
          <div>
            <dt>AI risk</dt>
            <dd>Outer alignment</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

function RosettaVariant({ data }: SocialImageVariantProps) {
  const rows = [
    {
      scenario: getScenario(data, 'mickeys-runaway-brooms'),
      concept: 'Outer alignment'
    },
    {
      scenario: getScenario(data, 'gps-into-the-lake'),
      concept: 'Automation bias'
    },
    {
      scenario: getScenario(data, 'hal-resists-disconnection'),
      concept: 'Shutdown resistance'
    }
  ]

  return (
    <section className={cn(styles.artboard, styles.rosetta)}>
      <Brand className={styles.rosettaBrand} />
      <div className={styles.rosettaHeading}>
        <p>The risk Rosetta Stone</p>
        <h2>
          Stories give us a shared
          <em>language for AI risk.</em>
        </h2>
      </div>

      <div className={styles.rosettaLabels} aria-hidden='true'>
        <span>Familiar scene</span>
        <span>AI safety concept</span>
      </div>
      <ol className={styles.rosettaRows}>
        {rows.map(({ scenario, concept }, index) => (
          <li key={scenario.slug}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <Still scenario={scenario} />
            <div>
              <small>{scenario.source}</small>
              <strong>{scenario.title}</strong>
            </div>
            <b aria-hidden='true'>→</b>
            <em>{concept}</em>
          </li>
        ))}
      </ol>
    </section>
  )
}

function SameRiskVariant({ data }: SocialImageVariantProps) {
  const scenarios = [
    getScenario(data, 'hal-resists-disconnection'),
    getScenario(data, 'bender-resists-reset'),
    getScenario(data, 'auto-enforces-directive-a113'),
    getScenario(data, 'skynet-launches-judgment-day')
  ]

  return (
    <section className={cn(styles.artboard, styles.sameRisk)}>
      <Brand className={styles.sameRiskBrand} />
      <p className={styles.sameRiskKicker}>
        Different stories. <strong>Same AI risk.</strong>
      </p>

      <div className={styles.sameRiskMap}>
        {scenarios.map((scenario, index) => (
          <figure key={scenario.slug} data-position={index + 1}>
            <Still scenario={scenario} tone='washed' />
            <figcaption>
              <span>{scenario.source}</span>
              <strong>{scenario.title}</strong>
            </figcaption>
          </figure>
        ))}

        <div className={styles.sameRiskCore}>
          <span>04 stories / one recurring pattern</span>
          <h2>
            Shutdown
            <strong>resistance</strong>
          </h2>
          <p>Capability creates a reason to keep control.</p>
        </div>
      </div>
    </section>
  )
}

function EquationVariant({ data }: SocialImageVariantProps) {
  const scenes = [
    getScenario(data, 'mickeys-runaway-brooms'),
    getScenario(data, 'gps-into-the-lake'),
    getScenario(data, 'lacie-games-her-rating')
  ]

  return (
    <section className={cn(styles.artboard, styles.equation)}>
      <div className={styles.equationStories}>
        <p>Stories you already understand</p>
        <h2>
          Familiar
          <strong>stories</strong>
        </h2>
        <div className={styles.equationStrip} aria-hidden='true'>
          {scenes.map((scenario) => (
            <Still key={scenario.slug} scenario={scenario} />
          ))}
        </div>
      </div>

      <div className={styles.equationLens}>
        <span aria-hidden='true'>×</span>
        <strong>AI safety</strong>
        <small>the lens</small>
      </div>

      <div className={styles.equationResult}>
        <Brand className={styles.equationBrand} />
        <h2>
          A shared language for
          <strong>real AI risks</strong>
        </h2>
        <p>Scene → pattern → risk</p>
      </div>
    </section>
  )
}

function NewLanguageVariant({ data }: SocialImageVariantProps) {
  const mickey = getScenario(data, 'mickeys-runaway-brooms')

  return (
    <section className={cn(styles.artboard, styles.newLanguage)}>
      <Still
        scenario={mickey}
        className={styles.newLanguageLeftImage}
        tone='washed'
      />
      <Still
        scenario={mickey}
        className={styles.newLanguageRightImage}
        tone='dark'
      />
      <div className={styles.newLanguageVeil} aria-hidden='true' />
      <div className={styles.newLanguageLens} aria-hidden='true'>
        <span>AI safety lens</span>
      </div>

      <Brand className={styles.newLanguageBrand} />
      <h2 className={styles.newLanguageHeading}>
        <span>Same scene.</span>
        <em>New language.</em>
      </h2>

      <div className={styles.newLanguageStory}>
        <p>Story</p>
        <strong>Magic brooms won&rsquo;t stop.</strong>
      </div>

      <div className={styles.newLanguageTranslation}>
        <p>AI safety</p>
        <strong>
          The system follows the letter,
          <span>not the intent.</span>
        </strong>
        <em>Outer alignment</em>
      </div>
    </section>
  )
}

export const socialImageVariants: readonly SocialImageDefinition[] = [
  {
    name: 'Selected Frame, Decoded',
    rationale:
      'Locked direction: the current social card, now decoding Keep Summer Safe.',
    Component: DecodedFrameVariant
  },
  {
    name: 'Risk Rosetta Stone',
    rationale:
      'Reusable blog template: one concrete concept for each familiar scene.',
    Component: RosettaVariant
  },
  {
    name: 'Different Stories, Same Risk',
    rationale:
      'Reusable blog template: several stories converging on one safety pattern.',
    Component: SameRiskVariant
  },
  {
    name: 'Shared-Language Equation',
    rationale:
      'Reusable blog template: a bold, feed-legible statement of the project’s lens.',
    Component: EquationVariant
  },
  {
    name: 'Same Scene, New Language',
    rationale: 'Dramatizes the act of looking again through an AI-safety lens.',
    Component: NewLanguageVariant
  }
]
