# Dogfood Evidence Summary

Generated: 2026-07-06T17:57:53.091Z

## Overview

- Repositories: 4
- Labeled reports: 103
- Useful findings: 148
- False-positive finding instances: 286
- Missed findings: 0
- Fixture-needed reports: 26
- Fixture-created reports: 17
- Repair attempts captured: 4
- Repair reruns captured: 4
- Repairs passing rerun: 4
- Missed-finding reviews captured: 71

## Run Labels

- useful: 31
- clean: 30
- pass-with-reviewed-observations: 9
- false-positive: 7
- reviewed-observations: 7
- clean-reviewed: 6
- reviewed-findings: 4
- repair-required: 2
- repair-rerun: 2
- false-positive-reviewed: 1
- pass-with-reviewed-observation: 1
- pass-with-scope-noise: 1
- pending: 1
- superseded-by-clean-replay: 1

## Detector Frequency

- expected-companions: 70
- blast-radius: 65
- scope: 54
- config-change: 47
- dependency: 47
- secret-path: 47
- test-weakening: 47
- repository-intelligence: 17
- intent-verification: 8
- dependency-addition: 4
- rewrite: 3
- api-surface: 1
- framework: 1

## Repair Loop Evidence

- Repair attempts captured: 4
- Repair prompts captured: 3
- Repair reruns captured: 4
- Repairs passing rerun: 4
- Repairs scoped to task: 47
- Repairs scoped to repair contract: 47
- Missed-finding reviews captured: 71
- Reports still missing missed-finding review: 32

## Repositories

- critical-components: 15 reports; useful findings 82; false-positive findings 3; missed findings 0; fixture-needed reports 2; repair attempts 0; missed-finding reviews 3.
- criticaldeveloper-blog: 18 reports; useful findings 10; false-positive findings 93; missed findings 0; fixture-needed reports 13; repair attempts 0; missed-finding reviews 4.
- criticaldeveloper-ft: 23 reports; useful findings 16; false-positive findings 38; missed findings 0; fixture-needed reports 2; repair attempts 0; missed-finding reviews 17.
- diegolopes-ft: 47 reports; useful findings 40; false-positive findings 152; missed findings 0; fixture-needed reports 9; repair attempts 4; missed-finding reviews 47.

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
- `195618-reduce-mobile-fighter-stats-panel-density`: clean-reviewed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `195656-polish-social-profile-link-active-states`: clean-reviewed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `195722-update-homepage-seo-title-description-and-social-preview-alt-text`: clean-reviewed; findings 0; false positives 0; fixture needed no; repair attempted no; missed reviewed yes.
- `195751-add-second-youtube-fight-moment-existing-data-model`: false-positive-reviewed; findings 3; false positives 3; fixture needed yes; repair attempted no; missed reviewed yes.
