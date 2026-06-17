# Codex Diff Quality Gate para desarrollo asistido por IA

## Por qué este proyecto sí cubre un hueco real

La idea tiene sentido porque resuelve una brecha que OpenAI ya deja clara en su propia arquitectura de Codex: `AGENTS.md` y las skills sirven para **orientar** el comportamiento del agente, pero la propia documentación recomienda acompañarlos con infraestructura que **enforce** las reglas del repositorio, como hooks, linters y type checkers. Además, Codex lee `AGENTS.md` antes de empezar a trabajar, las skills empaquetan workflows reutilizables, y los hooks existen precisamente para ejecutar scripts deterministas durante el ciclo de vida del agente. En paralelo, el code review nativo de Codex en GitHub está enfocado en issues serios y solo comenta P0/P1, así que queda espacio para una capa especializada en “diff hygiene” y riesgos de mantenimiento que no son necesariamente vulnerabilidades o bugs críticos. citeturn14view3turn18view0turn18view1turn14view0turn14view2

Ese hueco no es teórico. Los benchmarks recientes de revisión automática muestran que el code review con LLM sigue bastante por debajo de una revisión humana experta: en SWE-PRBench, los modelos evaluados detectan solo un 15–31% de los problemas que habían sido señalados por humanos. CR-Bench añade otro dato importante: en revisión de PRs no basta con “encontrar cosas”; el ruido, los falsos positivos y la baja aceptabilidad para desarrolladores son parte central del problema. Y, en producción, el coste de ese ruido importa porque los commits asistidos por IA introducen deuda técnica real: un estudio a gran escala sobre 302.6 mil commits atribuidos a asistentes de código encontró 484,366 issues diferenciales introducidos y observó que una parte sustancial seguía viva en el `HEAD` más reciente. citeturn23view4turn24view0turn23view2

La implicación práctica es importante: **no deberías construir otro “AI reviewer genérico”**. Tu mejor versión de este proyecto es una herramienta estrecha, repo-aware y evidence-first, especializada en patrones de fallo típicos de cambios generados por agentes: scope creep, dependencia injustificada, weakening de tests, cambios silenciosos de API, ruido estructural y desalineación con convenciones locales. Ese posicionamiento encaja mejor con el estado real del arte que intentar competir con un revisor generalista de PRs. citeturn23view4turn24view0

## Dónde está el valor diferencial frente a AGENTS y skills

El valor máximo no está en repetir instrucciones como “no toques archivos no relacionados”, porque Codex ya permite expresar eso con `AGENTS.md`, skills y goals. El valor está en convertir esas expectativas en **evidencia verificable sobre el diff**. OpenAI incluso lo formula de forma parecida en su guía de prompting: las instrucciones de colaboración no deben sustituir metas claras, criterios de éxito, reglas de herramientas ni condiciones de parada. Y Goal mode existe precisamente para decir qué tiene que permanecer intacto y cómo se comprueba el éxito. citeturn18view1turn30search19turn30search0turn30search4

Aquí conviene pensar el producto con cinco principios. Primero, debe ser **diff-aware**, no repo-wide por defecto: Semgrep documenta el valor de escanear solo lo introducido respecto a una baseline, y GitHub/Reviewdog ya trabajan bien con findings filtrados al diff. Segundo, debe ser **repo-specific**, porque reglas como naming, alcance razonable o necesidad de docs dependen del código cercano y del historial del proyecto. Tercero, debe ser **multicapa**: heurísticas y análisis estático primero, LLM solo para síntesis o casos ambiguos. Cuarto, debe ser **accionable**, con findings pequeños y localizados; GitHub Checks soporta anotaciones de línea, pero además tiene límites operativos por request, lo que favorece comentarios priorizados y no un alud de ruido. Quinto, debe ser **repair-oriented**: no solo “fallar el check”, sino dar a Codex la información mínima para iterar hasta pasar. citeturn3search1turn3search9turn3search3turn13search1turn13search6turn15view3

La mejor diferenciación, por tanto, no es “somos otro reviewer”, sino algo más concreto: **somos un gate de integridad de diff para cambios generados por agentes**. Ese framing es mucho más defendible y útil. Incluso en el paper sobre un runtime substrate para software agents, el estado `unsafe_invalid` incluye exactamente clases de fallos que encajan con tu idea, como tests debilitados, edits destructivos no relacionados o bypass del task. citeturn23view0

## Arquitectura recomendada

La arquitectura que más valor añade es una de **núcleo único con múltiples superficies**, no tres implementaciones separadas. El núcleo debe recibir un triple input: **task intent** (prompt, issue, objetivo o commit message), **git diff** y **contexto estructural mínimo** del repo. A partir de ahí genera un modelo interno de findings y lo emite como JSON normalizado, Markdown resumido y SARIF. SARIF te da salida nativa a GitHub Code Scanning cuando el entorno lo soporte, mientras que un formato de findings más simple te permite publicar comentarios con Reviewdog o Checks estándar y mostrar diagnósticos en VS Code. GitHub documenta el upload de SARIF; VS Code expone `DiagnosticCollection` y `publishDiagnostics`; y Reviewdog ya resuelve el filtrado al diff para comentarios automáticos. citeturn3search6turn13search0turn13search5turn3search3

Para una **v1 centrada en TypeScript/JavaScript**, mi recomendación es construir el core en **TypeScript**, no en Rust. La razón no es ideológica sino de time-to-value: las piezas más importantes de tu detector viven ya en ese ecosistema. Tienes el Compiler API y `ts-morph` para AST y símbolos; API Extractor para superficie pública exportada; Knip y reglas de unused para dead code; ESLint/typescript-eslint para señales léxicas y semánticas; y StrykerJS para strength de tests. Esta combinación te permite llegar muy rápido a un producto que realmente detecta cosas de alto valor en repos modernos y, además, desplegar el mismo paquete como CLI, GitHub Action y extensión de VS Code con muy poca fricción. citeturn16search1turn16search3turn8search7turn7search8turn7search22turn9search0turn9search6

Para el soporte multi-lenguaje, sí merece la pena que el motor de parsing sea **Tree-sitter-first** desde el principio, aunque la primera capa semántica profunda sea TS/JS. Tree-sitter ofrece parsing incremental, consultas estructurales y grammars en WebAssembly; además, la documentación oficial muestra tanto el uso incremental como la generación y carga de grammars WASM. Eso te permite unificar parte del análisis entre CLI y editor y dejar los adapters profundos por lenguaje como módulos posteriores. citeturn4search0turn17search0turn17search3turn17search9

El punto clave de producto es que el **LLM no debe leer el repo entero**. SWE-PRBench encontró algo contraintuitivo pero muy útil para diseño: más contexto no solo no ayuda siempre, sino que puede empeorar el review; de hecho, un prompt estructurado de diff+summary superó a configuraciones con contexto más grande. Por eso, si añades una fase LLM, aliméntala con un artefacto compacto: resumen del task, lista de archivos tocados, deltas de API/dependencias/tests, vecinos relevantes y findings previos del motor estático. No le pases el mundo; pásale una representación legible del problema. citeturn23view4

## Los detectores que sí merecen construirse

El detector de **modificaciones no relacionadas** es probablemente tu mayor oportunidad de generar valor diferencial. Aquí no basta con mirar muchos archivos tocados; lo correcto es combinar tres señales. La primera es la **alineación entre task e diff**: un paper reciente sobre detección de tangled changes muestra que combinar commit message con code diff mejora el rendimiento frente a usar solo el diff. La segunda es la **cohesión histórica**: la literatura sobre logical/evolutionary coupling lleva años mostrando que el historial de co-cambios aporta valor para análisis de impacto y para detectar zonas relacionadas del sistema. La tercera es una **huella estructural esperada**: para una request pequeña, el tool debe estimar blast radius esperado y comparar contra el diff real. En la práctica: si el task habla de un parser y el diff irrumpe en `webpack.config`, una migración de tests y cuatro helpers de logging, tu score de scope creep debe subir aunque todo compile. citeturn25view0turn5search2turn5search15

El bloque de **dependencias nuevas sin justificación** también merece estar entre los blockers. GitHub ya tiene Dependency Review y la action correspondiente para detectar dependencias añadidas, severidad de vulnerabilidades, edad y licencias. Tu añadido no debería ser repetir ese diff, sino exigir **justificación contextual**. Eso es especialmente valioso en un mundo donde la hallucination de paquetes no es marginal: el estudio “We Have a Package for You!” encontró porcentajes medios de paquetes alucinados del 5.2% en modelos comerciales y 21.7% en open-weight, con un riesgo claro para la cadena de suministro. Una regla útil aquí sería: si se añade una dependencia de producción, el gate exige evidencia de necesidad y alternativas descartadas; por ejemplo, si el repo ya usa APIs nativas o una utility propia equivalente, el hallazgo sube de severidad. citeturn11search0turn11search2turn11search8turn23view3

Los **cambios silenciosos de API pública** son otro sitio donde puedes aportar valor muy alto con poco ruido. En TypeScript, API Extractor ya está pensado para generar “API reports” y workflows de revisión de la superficie exportada. Para futuros adapters, Rust tiene `public-api` con soporte explícito para diff de items públicos, y Java tiene `japicmp` para comparación rápida entre artefactos. En tu producto, esto debería mapearse a una regla clara: si hay cambios en exports públicos o firmas visibles, el diff no puede pasar como “patch normal” sin changelog, nota de release o acknowledgment explícito del PR. citeturn8search7turn8search0turn8search1turn8search2

La categoría de **tests removidos o debilitados** necesita ir más allá de line coverage. StrykerJS y PIT explican bien la razón: la mutation testing mide si los tests realmente detectan mutaciones, es decir, si ejercen el comportamiento de forma efectiva; cobertura sola no capta eso. Para una v1, yo haría dos niveles. Un nivel barato y siempre activo: diff de assertions, snapshots, matchers, mocks y `it.skip`/`test.todo`, con reglas específicas por framework. Y un nivel caro pero potente: mutation testing incremental sobre código tocado cuando el detector barato ya sospecha weakening. Esa combinación te da buen recall sin convertir el gate en un suplicio de CI. citeturn9search0turn9search1turn9search16turn23view0

El detector de **dead code introducido y lógica duplicada** sí aporta valor, pero conviene tratarlo como P2/P3 salvo casos extremos. Para TS/JS, Knip encuentra dependencies, exports y files no usados; ESLint/typescript-eslint cubren variables o parámetros muertos; y para duplicación, herramientas como jscpd o PMD CPD dan una base muy utilizable. Lo interesante aquí es no correrlas como linters sueltos, sino intersectar sus findings con el diff y con el “nearby context”: si el agente añadió una utility nueva en el PR y jscpd encuentra un bloque muy parecido ya existente a dos carpetas de distancia, eso es mucho más valioso que un warning genérico de duplicación repo-wide. citeturn7search8turn7search4turn7search22turn6search0turn6search1

Para **hardcoded secrets y paths**, no intentes reinventar la rueda: integra detectores maduros y añade correlación repositorio-específica. GitHub Secret Scanning y Gitleaks ya cubren un espectro grande de credenciales; TruffleHog añade verificación activa para muchos detectores; y Semgrep permite escribir reglas custom para paths absolutos, nombres de hosts internos, directorios temporales mal usados o variables de entorno mal tratadas. Aquí el valor extra está en cruzar resultados: un string que parece secreto y además aparece en un archivo de configuración tocado por el agente es claramente más serio que un falso positivo aislado. citeturn10search2turn10search0turn10search1turn10search4turn27search1turn27search9

La categoría de **config changed without docs** parece menor, pero en la práctica puede ser muy útil si la diseñas bien. GitHub Dependency Review ya demuestra que los cambios de manifiestos y lockfiles merecen una vista “rich diff” separada; tu tool debería aplicar esa misma filosofía a `package.json`, `tsconfig`, `eslint`, `vite`, `webpack`, `docker`, `terraform` o `.github/workflows`. La regla no debe ser “si cambia config, exige README siempre”, sino algo más fino: “si cambia un contrato operativo o de DX visible para el equipo y no cambian docs/ADR/notes locales, pide explicación.” Esto reduce ruido y convierte el hallazgo en una conversación útil. citeturn11search1turn11search0

La categoría más difícil, pero también más prometedora, es la de **naming inconsistente con archivos cercanos**. Aquí yo no confiaría solo en un LLM libre. Para TS/JS puedes extraer símbolos con el Compiler API y construir perfiles locales por carpeta o módulo: estilo de nombres de hooks, factories, test files, fixtures, enums, componentes, etc. Luego usas un clasificador liviano o un pequeño pase LLM únicamente cuando el score de rareza sea alto. Es exactamente el tipo de problema donde conviene usar AST para la parte objetiva y modelo solo para interpretar si de verdad hay desalineación semántica. citeturn16search1turn16search3

## Integración nativa con Codex y superficies de uso

La integración más potente con Codex no es un prompt; es un **repair loop**. Los hooks de Codex están hechos para ejecutar scripts deterministas en eventos del ciclo de vida, y el evento `Stop` puede devolver una decisión que hace que Codex continúe trabajando con una nueva razón de continuación. Eso permite montar un flujo muy potente: el usuario trabaja con Goal mode definiendo que el cambio debe cumplir ciertos constraints; al final del turno, el hook corre `codex-diffgate`; si detecta riesgo alto, devuelve una continuación del tipo “reduce el cambio a los archivos mínimos, restaura la aserción eliminada y justifica la dependencia añadida”; Codex sigue iterando hasta pasar. Eso ya es enforcement real, y además está completamente alineado con cómo los hooks y goals están documentados oficialmente. citeturn15view0turn15view3turn15view4turn30search0turn30search4turn30search6

Por eso, el orden de producto que más sentido tiene es **CLI primero**, **GitHub Action después**, **VS Code al final**. El CLI te da la primitiva reutilizable y, sobre todo, se integra directamente con hooks locales y con sesiones de Codex CLI. La GitHub Action oficial de Codex ya está diseñada para ejecutar `codex exec` en CI/CD y gatear cambios en workflows, así que tu acción puede ser un wrapper fino del CLI o un job adicional que genera findings y falla el check si toca. Y la extensión de VS Code debería llegar solo cuando el precision/recall de tus reglas ya esté maduro, porque el editor castiga mucho el ruido. VS Code tiene APIs de diagnósticos adecuadas para presentar findings localizados por archivo y línea cuando ya confías en ellos. citeturn14view1turn14view4turn13search0turn13search5

Donde sí usaría un LLM dentro del producto es en la **explicación de findings ambiguos**, no en la detección base. Codex ya tiene `/review` local y code review en GitHub; ambos pueden servir como una segunda capa narrativa sobre el resultado del gate. También puedes aprovechar subagents si quieres una UX más sofisticada: OpenAI documenta workflows donde se divide una revisión entre agentes estrechos y read-only. En tu caso, eso podría significar un `scope_reviewer`, un `api_reviewer` y un `test_reviewer` que solo expliquen o prioricen hallazgos del motor estático, no que los inventen desde cero. citeturn14view4turn14view2turn28view0

## Cómo medir si realmente funciona y cómo lanzarlo con riesgo bajo

Aquí conviene ser muy disciplinado. OpenAI recomienda empezar con **traces** y luego pasar a datasets y eval runs; además, sus guías de evaluación insisten en diseñar tests específicos del task, logarlo todo y combinar automatización con juicio humano. También hay un matiz importante de actualidad: la documentación de OpenAI ya avisa de la deprecación de la plataforma clásica de Evals y sugiere usar Datasets y las superficies nuevas de evaluación de agentes para workflows iterativos. En otras palabras: para este proyecto, la unidad de aprendizaje no es “¿salió un comentario bonito?”, sino “¿qué patrón de diff detectó bien, cuál se escapó, y dónde metió ruido?”. citeturn22search3turn26search2turn26search6turn26search12turn22search0turn22search1turn22search4

Tu dataset inicial no debería venir de benchmarks públicos, sino de tus propios casos reales: PRs de agentes aceptados sin cambios, PRs reescritos por humanos, PRs donde se revirtió una dependencia, PRs donde se tocó config sin docs, PRs donde se eliminó una aserción útil. Después sí tiene sentido contrastar la herramienta con benchmarks externos. SWE-PRBench, CR-Bench y Code Review Bench son especialmente útiles porque te fuerzan a pensar en recall, factualidad y aceptabilidad, y porque el benchmark de Martian combina un modo offline reproducible con uno online de PRs frescos para reducir leakage. Eso encaja muy bien con la naturaleza cambiante de los revisores automatizados. citeturn23view4turn24view0turn24view1

Si tuviera que priorizar el roadmap para maximizar utilidad real, haría tres fases. La primera sería una **v1 TS/JS** con seis blockers: modificaciones no relacionadas, dependencia nueva sin justificación, cambio silencioso de API pública, weakening de tests, secretos y cambios de config sin explicación visible. La segunda incorporaría el **repair loop con Codex hooks + Goal mode + GitHub Action**, porque ahí es donde el proyecto empieza a cambiar comportamiento, no solo a comentar. La tercera añadiría el **modelo de blast radius esperado** apoyado en historial de co-cambios y casos etiquetados internamente, además de la capa de editor. Ese orden minimiza el riesgo de construir algo vistoso pero genérico, y maximiza la probabilidad de que el producto se convierta en una pieza obligatoria del flujo de desarrollo asistido por Codex. citeturn18view1turn14view0turn14view1turn30search0turn25view0turn5search2

En síntesis, la mejor forma de desarrollar este proyecto no es como un “AI code reviewer” más, sino como un **motor de verificación de diffs de agentes, repo-aware, orientado a evidencia y capaz de cerrar el loop con Codex**. Si haces eso, el producto deja de competir por redações bonitas en PRs y pasa a ocupar un espacio mucho más valioso: convertirse en la barrera que separa un cambio agente-aceptable de un cambio agente-peligroso. citeturn18view1turn14view2turn23view0turn24view0

## Analysis of the project by AI:

My assessment: this is much stronger than most AI-tooling ideas because it focuses on a problem that existing agent instructions cannot solve: verification instead of guidance.

The biggest insight in the report is this shift:

Don't build an AI reviewer.
Build an agent diff integrity gate.

That's the part I'd keep.

What I think is still missing

The report is technically solid, but I think there are 3 opportunities that could make the project significantly more valuable.

1. Learn the repository's "normal change patterns"

Right now the report talks about:

unrelated modifications
API changes
dependency additions
weakened tests

Those are good.

But the killer feature would be:

Expected Diff Pattern Modeling

Example:

User asks:

Add a new RTK Query endpoint.

The system has learned from 40 previous PRs that this kind of task normally touches:

api slice
service file
tests

3-5 files.

Codex changes:

17 files
webpack config
eslint config
package.json

Now you have evidence that the agent deviated from the repository's historical behavior.

This is much harder for AGENTS.md or Skills to solve.

It becomes:

"This change pattern has never appeared in repository history."

That is an extremely powerful signal.

2. Create a "Diff Cost Score"

This is the thing I would personally want before every merge.

Imagine:

Task complexity: Small

Expected:
3 files
120 LOC

Actual:
18 files
1100 LOC

Diff Cost Score:
87/100
(HIGH RISK)

Because one of the most common agent failures is:

solving a small problem with a huge rewrite

Humans do this too, but agents are especially prone to it.

This could become the flagship metric.

3. Add an "Agent Smell Detector"

Not code smells.

Agent smells.

Examples:

Agent Rewrite
Request:
Rename one field

Actual:
Entire file regenerated
Framework Drift
Nearby code:
fetch()

Agent introduced:
axios
Utility Reinvention
Repository already contains:

src/utils/date.ts

Agent created:

src/helpers/date-utils.ts
Abstraction Inflation
Request:
Change validation rule

Agent created:
4 new classes
2 interfaces
3 factories

These are patterns humans instantly recognize as AI-generated nonsense.

Nobody is really building detectors for these today.

What I would build as V1

Not all the detectors from the report.

Only these:

P0
Unrelated file modifications
Dependency addition without justification
Public API change
Test weakening
Secret/path detection
P1
Rewrite for small request
Existing utility already available
Repository convention violation
P2
Duplicate code
Dead code
The thing that excites me most

Not the GitHub Action.

Not the VS Code extension.

Not SARIF.

The thing that excites me is:

Codex Repair Loop
Codex works
↓
Diff Gate runs
↓
Finds issues
↓
Feeds findings back to Codex
↓
Codex repairs itself
↓
Diff Gate runs again

That transforms it from:

a reviewer

into

an autonomous quality-control layer for coding agents.

That is a much bigger category.

If you position it correctly, you're not competing with reviewers like CodeRabbit or generic AI PR bots.

You're building:

"The safety system for autonomous coding agents."

That positioning is substantially more valuable.

The key question is where the intelligence lives.

Bad architecture (expensive)
Task
↓
Send whole repo to LLM
↓
Analyze entire diff
↓
Return findings

Every PR:

tens/hundreds of thousands of tokens
expensive
slow
inconsistent

This is how many AI reviewers work today.

Good architecture (cheap)
Git Diff
↓
AST analysis
↓
Static detectors
↓
Risk scores
↓
LLM only for ambiguous findings

Example:

Files touched: 12

Detector:

- New dependency found
- API changed
- Test assertion removed

Only then:
LLM receives a 2KB summary

Instead of sending:

5000 LOC

you send:

Task:
Add RTK endpoint

Findings:

- Added axios
- Modified 14 files
- Removed 2 assertions
- Public API changed

Explain risks.

That's tiny.

In practice

Suppose Codex consumed:

$0.50

to implement a feature.

Your Diff Gate might consume:

$0.01

or

$0.03

if it's mostly deterministic.

Potentially less.

The interesting possibility

For many checks you need zero LLM calls.

Examples:

API changes
export function x()

↓

export function y()

Pure AST.

No AI needed.

New dependency
{
"dependencies": {
"lodash": "^5"
}
}

Pure diff analysis.

No AI needed.

Tests removed
-expect(result).toBe(true)

Pure AST or diff rules.

No AI needed.

Secret detection

Use:

Gitleaks
Trufflehog
Semgrep

No AI needed.

Where I'd actually spend tokens

Only on things humans struggle to formalize:

Scope creep
Task:
Add validation to login form

Files changed:
18

Why?
Naming inconsistency
useCustomerData
useCustomerStore
CustomerProvider

new:
CustomerEngine
Architectural mismatch
Repo uses RTK Query

Agent introduced React Query

Those are genuinely semantic.

My guess for a production version

If I were building this for Codex specifically:

80-90% deterministic
10-20% LLM

The most valuable version is not the smartest one.

It's the one that catches:

agent scope creep
unnecessary rewrites
hidden API changes
weakened tests

while adding almost no latency and almost no cost.

That's why I think the strongest moat isn't AI at all. It's building a repository-aware diff analysis engine that understands what a normal change looks like in that codebase. The LLM should be the final interpreter, not the primary detector.

## Value of the project from ChagtGPT:

The value depends on whether it becomes a tool or a control point.

Most developer tooling ideas fail because they're just another tool.

This project has potential because it can become a required gate in AI-assisted development workflows.

The lowest value version

A GitHub bot that comments:

"This PR modified 14 files."

Nobody pays much for that.

There are already:

CodeRabbit
GitHub Copilot Code Review
Reviewdog
Static analyzers

This market is crowded.

The medium value version

A specialized reviewer for AI-generated code.

Positioning:

"We catch mistakes coding agents make."

Examples:

unnecessary rewrites
dependency hallucinations
weakened tests
scope creep

This is better because it's focused.

You could sell it as:

AI Code Review
for AI-generated Pull Requests

There is real demand for this today.

The high value version

This is where I think the opportunity actually is.

Position it as:

"Quality Enforcement Layer for Coding Agents"

Not review.

Enforcement.

Meaning:

Codex
Claude Code
Kiro
Cursor
Windsurf
Aider
OpenHands

all generate code.

Before merge:

Agent
↓
Diff Gate
↓
Pass / Fail

Now your product sits between:

agent output
production code

That position is much more valuable.

Why companies might care

Today managers worry about:

Can AI generate code?

Tomorrow they'll worry about:

How do we stop AI from generating bad code?

Those are different markets.

The second market is usually bigger.

Examples:

Git → GitHub
Docker → Kubernetes
CI → CI governance
Cloud → Cloud security

The governance/control layer often becomes more valuable than the generator.

The strongest value proposition

Not:

"We find bugs."

But:

"We reduce the blast radius of autonomous agents."

Imagine a company with 100 developers.

Today:

100 developers

In 3–5 years:

100 developers

- 1000 agent-generated changes/day

Nobody can manually review that volume.

They will need automated gates.

Your project fits exactly there.

What would make it venture-scale?

One thing.

Repository Intelligence

If you build enough knowledge to answer:

"Is this change normal for THIS repository?"

you have something difficult to replicate.

Because then you're not merely checking code quality.

You're learning:

architecture
conventions
change patterns
coupling
expected blast radius

for each codebase.

That becomes a data moat.

What would make me personally excited to build it?

A feature like this:

Task:
Add validation to signup form

Expected change pattern:
3 files

Actual:
17 files

Confidence:
92%

Reason:
Historical changes of this class touch:

- validator
- tests
- form component

Unexpected:

- webpack config
- package.json
- logging infrastructure

The moment it can say:

"This change does not look like how this repository normally evolves"

it becomes much more than a linter, reviewer, or static analysis tool.

At that point, it starts becoming the equivalent of a "CI/CD safety system for coding agents," which is where I think the real long-term value lies.
