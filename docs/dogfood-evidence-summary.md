# Dogfood Evidence Summary

Generated: 2026-07-14T10:57:56.437Z

## Overview

- Repositories: 5
- Labeled reports: 172
- Useful findings: 386
- False-positive finding instances: 955
- Missed findings: 68
- Fixture-needed reports: 81
- Fixture-created reports: 51
- Repair attempts captured: 6
- Repair reruns captured: 6
- Repairs passing rerun: 6
- Missed-finding reviews captured: 140

## Run Labels

- mixed: 44
- clean: 34
- useful: 31
- false-positive: 11
- pass-with-reviewed-observations: 9
- reviewed-observations: 7
- clean-reviewed: 6
- missed: 5
- accepted: 4
- accepted_with_notes: 4
- reviewed-findings: 4
- false-positive-reviewed: 2
- repair-required: 2
- repair-rerun: 2
- pass-with-false-positive-intent-verification: 1
- pass-with-reviewed-observation: 1
- pass-with-scope-noise: 1
- pass-with-useful-artifact-observation-negation-false-positives-and-missed-synapse-workflow: 1
- pass-with-useful-contract-evidence-and-false-positive-companions: 1
- pending: 1
- superseded-by-clean-replay: 1

## Detector Frequency

- expected-companions: 127
- blast-radius: 101
- scope: 68
- test-weakening: 59
- secret-path: 55
- config-change: 52
- dependency: 50
- repository-intelligence: 28
- intent-verification: 26
- api-surface: 23
- dependency-addition: 14
- expected-artifacts: 6
- rewrite: 6
- invariant-coverage: 3
- pattern-violation: 3
- utility-reinvention: 3
- existing-solution: 2
- framework: 1

## Repair Loop Evidence

- Repair attempts captured: 6
- Repair prompts captured: 3
- Repair reruns captured: 6
- Repairs passing rerun: 6
- Repairs scoped to task: 51
- Repairs scoped to repair contract: 49
- Missed-finding reviews captured: 140
- Reports still missing missed-finding review: 32

## Repositories

- critical-components: 19 reports; useful findings 89; false-positive findings 18; missed findings 2; fixture-needed reports 5; repair attempts 0; missed-finding reviews 7.
- criticaldeveloper-blog: 21 reports; useful findings 12; false-positive findings 103; missed findings 1; fixture-needed reports 16; repair attempts 0; missed-finding reviews 7.
- criticaldeveloper-ft: 26 reports; useful findings 16; false-positive findings 38; missed findings 0; fixture-needed reports 2; repair attempts 0; missed-finding reviews 20.
- diegolopes-ft: 49 reports; useful findings 40; false-positive findings 157; missed findings 0; fixture-needed reports 11; repair attempts 4; missed-finding reviews 49.
- tamagotchi: 57 reports; useful findings 229; false-positive findings 639; missed findings 65; fixture-needed reports 47; repair attempts 2; missed-finding reviews 57.

## Reports

### critical-components

- `164154-migrate-ai-docs-to-agents-md-and-ai-docs-with-critical-gate-evidence-workflow`: useful; findings 8; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `165701-add-critical-aura-theme-and-storybook-selector`: useful; findings 6; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `171543-fix-critical-aura-contrast-and-reinforce-theme-design-instructions`: useful; findings 8; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `172041-remove-critical-aura-datatable-cell-hover-and-tighten-tooltip-spacing`: useful; findings 10; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `172700-deepen-critical-aura-visual-design-direction`: useful; findings 10; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `181819-migrate-remaining-readme-files-to-agents-md-and-ai-docs`: useful; findings 18; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `183005-tune-critical-gate-policy-for-docs-and-theme-calibration`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `183957-add-critical-light-aura-theme-and-storybook-selector`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `190345-refine-aura-button-hover-and-appearance-styling`: useful; findings 8; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `195928-sharpen-critical-aura-button-radius-weight-and-hover-design`: useful; findings 6; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `200655-tune-critical-gate-policy-from-aura-theme-evidence`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `critical-dark-aura-rename-refinement`: useful; findings 8; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `104333-post-2-7-0-controlled-dogfood-calibration`: pending; findings 10; false positives 0; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `120826-upgrade-critical-gate-to-2-7-1-and-verify-package-only-upgrade-calibration`: false-positive; findings 3; false positives 3; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `124556-upgrade-critical-gate-to-2-7-2-and-verify-shortened-package-hunk-upgrade-calibra`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `123009-implement-ds-autocomplete-field-with-debounced-static-and-remote-filtering-dropd`: mixed; findings 9; false positives 8; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `174126-implement-production-ready-ds-drawer-with-directional-velocity-snap-settling-nes`: mixed; findings 3; false positives 1; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `113652-i-want-to-implement-a-new-component-called-qrcode-with-all-the-needed-options-fo`: mixed; findings 3; false positives 1; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `122822-i-want-to-develop-a-new-component-called-contextmenu-base-its-functionality-and-`: mixed; findings 7; false positives 5; fixture needed yes; repair attempted not recorded; missed reviewed yes.

### criticaldeveloper-blog

- `103227-add-durable-critical-gate-evidence-export-workflow-for-future-dogfood-runs`: useful; findings 6; false positives 1; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `103536-document-vs-code-extension-report-behavior-and-task-branch-commit-workflow`: useful; findings 6; false positives 1; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `103850-add-instruction-to-merge-completed-task-branches-back-into-main-after-commit`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `110723-redesign-blog-visual-style-as-a-premium-editorial-signal-archive-without-changin`: useful; findings 5; false positives 5; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `111919-fix-homepage-redesign-grid-featured-title-sizing-reload-flicker-and-article-mobi`: false-positive; findings 6; false positives 6; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `112438-polish-article-meta-spacing-and-restrict-drop-cap-styling`: false-positive; findings 3; false positives 3; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `113700-replace-material-symbols-font-with-local-svg-icons`: false-positive; findings 12; false positives 12; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `114047-make-homepage-list-view-the-default-display-mode`: false-positive; findings 3; false positives 3; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `144040-upgrade-critical-gate-dogfood-dependency-to-2-4-3`: useful; findings 6; false positives 6; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `150447-adjust-article-signal-line-gradient`: false-positive; findings 1; false positives 1; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `150827-make-post-detail-hero-metadata-two-columns-on-mobile`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `181051-create-synapse-review-skill-and-agent-instructions`: useful; findings 3; false positives 3; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `182625-update-blog-synapses-across-all-posts`: useful; findings 36; false positives 36; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `094312-fix-article-detail-hero-title-overflow`: pass-with-scope-noise; findings 4; false positives 4; fixture needed yes; repair attempted not recorded; missed reviewed no.
- `111810-upgrade-critical-gate-to-2-7-0-controlled-dogfood-calibration`: superseded-by-clean-replay; findings 8; false positives 8; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `121251-upgrade-critical-gate-to-2-7-1-and-verify-package-only-upgrade-calibration`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `124809-upgrade-critical-gate-to-2-7-2-and-verify-shortened-package-hunk-upgrade-calibra`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `143722-publish-critical-gate-2-7-2-evidence-report-post-and-update-related-synapses`: pass-with-reviewed-observations; findings 4; false positives 4; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `181659-publish-critical-gate-2-8-0-task-contract-release-post-and-update-related-synaps`: pass-with-false-positive-intent-verification; findings 2; false positives 2; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `182748-update-critical-gate-evidence-export-workflow-for-task-contracts-and-check-conte`: pass-with-useful-contract-evidence-and-false-positive-companions; findings 6; false positives 5; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `122436-create-the-agentic-browsing-and-pagespeed-insights-article-and-apply-its-follow-`: pass-with-useful-artifact-observation-negation-false-positives-and-missed-synapse-workflow; findings 4; false positives 3; fixture needed yes; repair attempted not recorded; missed reviewed yes.

### criticaldeveloper-ft

- `185443-track-critical-gate-evidence-and-agent-git-workflow`: useful; findings 3; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `195744-replace-design-systems-playground-with-critical-gate-project-profile`: useful; findings 8; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `200714-update-sitemap-for-critical-gate-project-route`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `201030-add-missing-legal-pages-to-sitemap`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `201817-tune-critical-gate-policy-for-generated-evidence-companions`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `222052-fix-critical-gate-project-detail-marketplace-and-npm-links`: useful; findings 5; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed no.
- `144028-update-about-information-cards-layout-and-remove-list-markers`: pass-with-reviewed-observations; findings 2; false positives 2; fixture needed no; repair attempted no; missed reviewed yes.
- `144914-masonry-align-about-cards-and-fix-project-card-arrow`: pass-with-reviewed-observations; findings 10; false positives 10; fixture needed no; repair attempted no; missed reviewed yes.
- `145601-move-about-cta-into-left-column-and-stabilize-about-layout`: pass-with-reviewed-observation; findings 1; false positives 1; fixture needed no; repair attempted no; missed reviewed yes.
- `150132-set-about-cta-margin-and-show-consent-banner-globally`: pass-with-reviewed-observations; findings 5; false positives 5; fixture needed no; repair attempted no; missed reviewed yes.
- `150801-match-contact-card-spacing-and-replace-now-playing-dot-with-rotating-vinyl`: pass-with-reviewed-observations; findings 9; false positives 9; fixture needed no; repair attempted no; missed reviewed yes.
- `164848-update-now-playing-playlist-from-youtube-screenshot`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `165850-keep-now-playing-vinyl-spinning-continuously`: pass-with-reviewed-observations; findings 3; false positives 3; fixture needed no; repair attempted no; missed reviewed yes.
- `083953-upgrade-critical-gate-dependency-and-evidence-workflow-to-2-6-0`: pass-with-reviewed-observations; findings 3; false positives 3; fixture needed no; repair attempted no; missed reviewed yes.
- `090427-replay-about-card-layout-project-arrow-contact-spacing-and-now-playing-vinyl-ui-`: pass-with-reviewed-observations; findings 1; false positives 1; fixture needed yes; repair attempted no; missed reviewed yes.
- `101010-upgrade-critical-gate-to-2-7-0-and-rerun-focused-dogfood-calibration`: false-positive; findings 2; false positives 2; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `101717-controlled-ui-replay-for-repository-intelligence-calibration-in-aboutview-presen`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `102812-fix-about-cta-placement-after-cards-and-remove-cta-scroll-bounce`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `104742-restore-desktop-about-cta-column-placement-while-keeping-mobile-cta-below-cards`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `121429-upgrade-critical-gate-to-2-7-1-and-verify-package-only-upgrade-calibration`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `124858-upgrade-critical-gate-to-2-7-2-and-verify-shortened-package-hunk-upgrade-calibra`: clean; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `130052-add-wall-clock-synchronized-countdown-to-now-playing-track-duration`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `121658-improve-pagespeed-agentic-navigation-score-by-fixing-consent-banner-accessibilit`: useful; findings 2; false positives 2; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `194927-i-want-to-add-new-information-in-the-about-section-with-internationalized-text-c`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `200637-in-the-about-hobbyproject-elements-remove-the-blue-icon-and-change-it-for-a-simp`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `201144-fix-the-problem-type-text-discovered-html-css-starting-the-real-coding-journey-m`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.

### diegolopes-ft

- `192045-build-diego-lopes-gif-motion-archive-landing-page`: useful; findings 16; false positives 0; fixture needed no; repair attempted yes; missed reviewed yes.
- `192901-fix-diego-lopes-homepage-sections-to-occupy-full-viewport-height`: useful; findings 4; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `193844-refine-diego-lopes-hero-typography-and-add-section-navigation`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `194605-brighten-diego-lopes-hero-background-and-slow-zoom-motion`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `200015-add-scroll-entry-exit-animations-and-fix-top-navigation`: pass-with-reviewed-observations; findings 14; false positives 7; fixture needed yes; repair attempted no; missed reviewed yes.
- `201219-show-all-hero-motion-elements-on-initial-page-load`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `205050-upgrade-critical-gate-from-2-7-2-to-2-7-3`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `143721-fix-final-frame-bottom-motion-visibility`: repair-required; findings 1; false positives 0; fixture needed no; repair attempted yes; missed reviewed yes.
- `143822-fix-final-frame-bottom-motion-visibility`: repair-rerun; findings 2; false positives 2; fixture needed no; repair attempted no; missed reviewed yes.
- `145045-fix-moments-background-motion-performance-and-scroll-flicker`: useful; findings 5; false positives 1; fixture needed no; repair attempted no; missed reviewed yes.
- `145949-adapt-moments-section-image-separator-and-section-text-opacity`: useful; findings 1; false positives 1; fixture needed no; repair attempted no; missed reviewed yes.
- `150512-remove-moments-overlay-darkening`: useful; findings 1; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `153043-use-supplied-image-as-rest-of-moments-section-background`: useful; findings 2; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `155516-convert-moments-list-to-horizontal-youtube-video-gallery`: useful; findings 1; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `161211-reverse-youtube-moment-order-and-add-background-burn-reveal-effects`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `164005-swap-moments-second-background-and-reveal-old-background-in-identity`: useful; findings 2; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `100905-remove-hero-and-start-homepage-at-moments-section`: useful; findings 1; false positives 1; fixture needed no; repair attempted no; missed reviewed yes.
- `102530-fix-viewport-section-heights-background-aspect-ratio-and-section-navigation`: useful; findings 3; false positives 3; fixture needed yes; repair attempted yes; missed reviewed yes.
- `103529-split-hidden-moments-gallery-into-memory-section-and-fix-first-background-clippi`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `104322-fix-top-background-diagonal-clipping-and-reveal-content-after-section-navigation`: useful; findings 6; false positives 6; fixture needed yes; repair attempted no; missed reviewed yes.
- `110116-replace-section-links-with-fixed-section-navigator-and-update-top-section-copy`: useful; findings 12; false positives 12; fixture needed yes; repair attempted no; missed reviewed yes.
- `111051-move-moments-copy-to-identity-and-add-fighter-stats-panel`: reviewed-findings; findings 8; false positives 8; fixture needed yes; repair attempted no; missed reviewed yes.
- `112419-move-fighter-stats-to-fight-memory-and-move-video-gallery-to-fighter-identity`: reviewed-findings; findings 10; false positives 10; fixture needed yes; repair attempted no; missed reviewed yes.
- `113934-fix-section-clip-angle-and-prevent-stat-and-title-wrapping-issues`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `114950-fix-fight-memory-title-overlap-with-stats-panel`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `115735-prevent-fight-memory-title-from-running-behind-stats-panel`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `121857-fix-identity-youtube-card-layout-and-open-video-on-youtube`: reviewed-findings; findings 8; false positives 8; fixture needed yes; repair attempted no; missed reviewed yes.
- `122915-remove-top-left-background-clip-and-focus-identity-on-video-content`: reviewed-findings; findings 5; false positives 5; fixture needed yes; repair attempted no; missed reviewed yes.
- `124107-polish-identity-video-hover-fit-and-bottom-navigator-behavior`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `142812-center-identity-content-remove-horizontal-overflow-and-widen-video-title-fit`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `144321-show-active-navigator-label-and-hide-it-while-hovering-inactive-menu-items`: clean; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `145754-fix-navigator-label-stacking-and-swap-identity-and-end-frame-backgrounds`: reviewed-observations; findings 9; false positives 9; fixture needed no; repair attempted no; missed reviewed yes.
- `150916-delay-navigator-labels-during-navigation-update-youtube-layout-and-win-streak`: repair-required; findings 10; false positives 9; fixture needed no; repair attempted yes; missed reviewed yes.
- `151058-delay-navigator-labels-during-navigation-update-youtube-layout-and-win-streak-re`: repair-rerun; findings 8; false positives 8; fixture needed no; repair attempted no; missed reviewed yes.
- `152500-use-tall-final-frame-background-with-left-clip-reveal`: reviewed-observations; findings 8; false positives 8; fixture needed no; repair attempted no; missed reviewed yes.
- `153750-activate-identity-navigator-on-section-entry-and-remove-background-blur`: reviewed-observations; findings 6; false positives 6; fixture needed no; repair attempted no; missed reviewed yes.
- `160444-update-section-urls-social-layout-and-bottom-note`: reviewed-observations; findings 12; false positives 12; fixture needed no; repair attempted no; missed reviewed yes.
- `162050-fix-navigator-hover-state-memory-intro-font-and-final-background-sizing`: reviewed-observations; findings 11; false positives 11; fixture needed no; repair attempted no; missed reviewed yes.
- `163203-fix-bottom-note-left-clipping-height`: reviewed-observations; findings 1; false positives 1; fixture needed no; repair attempted no; missed reviewed yes.
- `163951-add-favicon-assets-and-seo-metadata`: reviewed-observations; findings 21; false positives 21; fixture needed no; repair attempted no; missed reviewed yes.
- `165219-fix-mobile-section-sizing-and-navigator-usability`: clean-reviewed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `165853-add-comprehensive-project-readme`: clean-reviewed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `143942-fix-mobile-background-clipping-depth-while-preserving-alternating-sides`: clean-reviewed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `184248-upgrade-critical-gate-to-2-7-5-and-verify-expected-companion-calibration`: clean; findings 0; false positives 0; fixture needed yes; repair attempted no; missed reviewed yes.
- `195618-reduce-mobile-fighter-stats-panel-density`: clean-reviewed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `195656-polish-social-profile-link-active-states`: clean-reviewed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `195722-update-homepage-seo-title-description-and-social-preview-alt-text`: clean-reviewed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `195751-add-second-youtube-fight-moment-existing-data-model`: false-positive-reviewed; findings 3; false positives 3; fixture needed yes; repair attempted no; missed reviewed yes.
- `192704-i-want-to-include-a-loader-for-all-the-content-of-the-site-to-prevent-sloopy-loa`: false-positive-reviewed; findings 5; false positives 5; fixture needed yes; repair attempted no; missed reviewed yes.

### tamagotchi

- `151610-add-native-tauri-backed-save-persistence-with-browser-fallback`: accepted_with_notes; findings 90; false positives 72; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `152122-add-windows-tray-menu-and-close-to-tray-desktop-behavior`: accepted_with_notes; findings 65; false positives 45; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `152442-add-deeper-pet-lifecycle-health-recovery-death-and-medicine-behavior`: accepted_with_notes; findings 73; false positives 58; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `152855-fix-severe-neglect-mood-so-dirty-exhausted-pets-become-sick`: accepted_with_notes; findings 139; false positives 120; fixture needed yes; repair attempted not recorded; missed reviewed yes.
- `153516-create-og-tamagotchi-behavior-roadmap-from-tamanalysis-references`: accepted; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `153739-update-og-tamagotchi-roadmap-with-p1-guide-mechanics`: accepted; findings 0; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `154356-task-1-1-define-canonical-og-tamagotchi-stats-and-units`: accepted; findings 19; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `154814-task-1-1-define-canonical-og-tamagotchi-stats-and-units-with-branch-workflow-ins`: accepted; findings 5; false positives 0; fixture needed no; repair attempted not recorded; missed reviewed yes.
- `171241-go-ahead-with-the-next-phase-task-then`: mixed; findings 15; false positives 13; fixture needed yes; repair attempted no; missed reviewed yes.
- `174111-go-ahead-with-next-one`: mixed; findings 3; false positives 2; fixture needed yes; repair attempted no; missed reviewed yes.
- `135539-go-ahead-with-next`: mixed; findings 5; false positives 3; fixture needed yes; repair attempted no; missed reviewed yes.
- `141529-go-ahead-with-next`: mixed; findings 2; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `142354-go-ahead`: mixed; findings 6; false positives 2; fixture needed yes; repair attempted no; missed reviewed yes.
- `143310-go-ahead`: mixed; findings 8; false positives 1; fixture needed yes; repair attempted no; missed reviewed yes.
- `145004-go-ahead`: mixed; findings 10; false positives 3; fixture needed yes; repair attempted no; missed reviewed yes.
- `145833-go-ahead`: mixed; findings 4; false positives 1; fixture needed yes; repair attempted no; missed reviewed yes.
- `150535-go-ahead`: mixed; findings 8; false positives 2; fixture needed yes; repair attempted no; missed reviewed yes.
- `151324-go-ahead`: missed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `152825-go-ahead-with-next`: mixed; findings 14; false positives 6; fixture needed yes; repair attempted no; missed reviewed yes.
- `153827-go-ahead`: mixed; findings 15; false positives 3; fixture needed yes; repair attempted no; missed reviewed yes.
- `154838-before-continuing-with-the-roadmap-i-d-want-to-work-a-little-bit-on-the-ui-ux`: mixed; findings 23; false positives 16; fixture needed yes; repair attempted no; missed reviewed yes.
- `160842-small-fixes-before-continuing-with-the-roadmap-fix-bad-off-center-overlapping-lc`: mixed; findings 20; false positives 17; fixture needed yes; repair attempted no; missed reviewed yes.
- `161831-small-fixes-make-the-stats-menu-the-last-lcd-option-and-show-stats-automatically`: mixed; findings 11; false positives 10; fixture needed yes; repair attempted no; missed reviewed yes.
- `162757-small-fixes-explain-how-care-increases-and-fix-the-stats-lcd-layout-where-stat-r`: missed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `163700-last-fix-before-continuing-with-the-roadmap-in-stats-view-distinguish-values-fro`: missed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `165706-implement-roadmap-task-4-2-og-inspired-evolution-tree-with-egg-to-baby-to-child-`: mixed; findings 23; false positives 21; fixture needed yes; repair attempted no; missed reviewed yes.
- `171114-small-fix-before-continuing-with-the-roadmap-fix-the-lights-off-effect-so-it-cov`: mixed; findings 13; false positives 11; fixture needed yes; repair attempted no; missed reviewed yes.
- `172850-implement-roadmap-task-4-3-finite-lifespan-and-death-so-every-run-eventually-end`: mixed; findings 30; false positives 25; fixture needed yes; repair attempted no; missed reviewed yes.
- `174537-implement-roadmap-task-5-2-og-status-screens-with-status-pages-navigable-through`: mixed; findings 12; false positives 10; fixture needed yes; repair attempted no; missed reviewed yes.
- `175507-implement-roadmap-task-5-3-device-shell-polish-with-a-stable-fixed-size-shell-no`: mixed; findings 6; false positives 5; fixture needed yes; repair attempted no; missed reviewed yes.
- `180025-fix-browser-web-drag-and-drop-fallback-so-the-tamagotchi-shell-can-be-dragged-in`: mixed; findings 5; false positives 4; fixture needed yes; repair attempted no; missed reviewed yes.
- `181443-implement-roadmap-task-6-1-og-style-guessing-game-with-five-a-b-guesses-3-of-5-r`: mixed; findings 23; false positives 21; fixture needed yes; repair attempted no; missed reviewed yes.
- `182731-implement-roadmap-task-6-2-game-animation-and-feedback-so-the-pet-reacts-to-win-`: mixed; findings 25; false positives 19; fixture needed yes; repair attempted no; missed reviewed yes.
- `183601-implement-roadmap-task-7-1-sprite-state-machine-so-renderer-state-is-derived-fro`: mixed; findings 22; false positives 13; fixture needed yes; repair attempted no; missed reviewed yes.
- `185327-fix-tamagotchi-header-status-layout-and-replace-the-flickering-evolution-square-`: mixed; findings 16; false positives 14; fixture needed yes; repair attempted no; missed reviewed yes.
- `191406-implement-roadmap-task-7-2-original-pixel-art-set-with-original-non-copied-sprit`: mixed; findings 13; false positives 10; fixture needed yes; repair attempted no; missed reviewed yes.
- `192412-implement-roadmap-task-7-3-animation-timing-so-animations-run-independently-from`: mixed; findings 10; false positives 7; fixture needed yes; repair attempted no; missed reviewed yes.
- `194056-implement-roadmap-task-8-1-save-schema-v2-so-the-save-schema-includes-all-og-fie`: mixed; findings 21; false positives 18; fixture needed yes; repair attempted no; missed reviewed yes.
- `195600-implement-roadmap-task-8-2-dev-debug-panel-with-a-hidden-dev-only-panel-to-inspe`: mixed; findings 24; false positives 14; fixture needed yes; repair attempted no; missed reviewed yes.
- `201612-implement-roadmap-task-9-1-domain-golden-tests-covering-every-care-action-app-cl`: mixed; findings 5; false positives 4; fixture needed yes; repair attempted no; missed reviewed yes.
- `202744-implement-roadmap-task-9-2-save-and-migration-tests-covering-missing-save-corrup`: mixed; findings 10; false positives 10; fixture needed yes; repair attempted no; missed reviewed yes.
- `203209-add-a-tamagotchi-shaped-favicon-for-the-web-version`: false-positive; findings 3; false positives 3; fixture needed yes; repair attempted no; missed reviewed yes.
- `204440-implement-roadmap-task-9-3-ui-smoke-tests-covering-main-shell-render-a-b-c-navig`: mixed; findings 4; false positives 3; fixture needed yes; repair attempted no; missed reviewed yes.
- `205257-implement-roadmap-task-10-1-packaging-so-pnpm-run-tauri-build-succeeds-on-window`: mixed; findings 7; false positives 5; fixture needed yes; repair attempted no; missed reviewed yes.
- `210020-implement-roadmap-task-10-2-desktop-companion-behavior-so-tray-behavior-is-stabl`: mixed; findings 11; false positives 9; fixture needed yes; repair attempted no; missed reviewed yes.
- `210911-implement-roadmap-task-10-3-documentation-so-readme-explains-how-to-run-and-pack`: mixed; findings 8; false positives 7; fixture needed yes; repair attempted no; missed reviewed yes.
- `212111-fix-windows-desktop-shell-ux-so-the-packaged-tamagotchi-does-not-open-a-console-`: mixed; findings 9; false positives 5; fixture needed yes; repair attempted no; missed reviewed yes.
- `213039-clarify-fresh-egg-clock-setup-so-users-understand-that-hatching-starts-only-afte`: mixed; findings 8; false positives 6; fixture needed yes; repair attempted no; missed reviewed yes.
- `213947-fix-tamagotchi-dragging-so-the-windows-app-can-move-freely-instead-of-staying-ce`: mixed; findings 7; false positives 6; fixture needed yes; repair attempted no; missed reviewed yes.
- `215133-remove-the-remaining-gray-visual-background-behind-the-tamagotchi-and-make-the-e`: mixed; findings 6; false positives 6; fixture needed yes; repair attempted no; missed reviewed yes.
- `220808-use-the-existing-web-favicon-as-the-windows-desktop-application-icon-for-the-tau`: missed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `221654-polish-the-tamagotchi-shell-ui-by-making-the-body-more-og-egg-oval-shaped-improv`: missed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `230235-add-native-windows-notifications-for-attention-calls-improve-the-poop-sprite-mak`: mixed; findings 26; false positives 2; fixture needed yes; repair attempted yes; missed reviewed yes.
- `230837-add-native-windows-notifications-for-attention-calls-improve-the-poop-sprite-mak`: mixed; findings 18; false positives 1; fixture needed yes; repair attempted yes; missed reviewed yes.
- `104533-add-offline-sleep-grace-so-a-clean-pet-with-lights-off-can-survive-a-normal-over`: false-positive; findings 8; false positives 2; fixture needed yes; repair attempted no; missed reviewed yes.
- `105153-document-overnight-care-behavior-so-users-know-a-clean-sleeping-pet-with-lights-`: false-positive; findings 1; false positives 1; fixture needed yes; repair attempted no; missed reviewed yes.
- `105752-fix-the-shell-context-menu-so-it-opens-at-the-exact-right-click-position-and-rem`: false-positive; findings 3; false positives 3; fixture needed yes; repair attempted no; missed reviewed yes.
