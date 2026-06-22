Regression for the blog dogfood run where removing `material-symbols` was misclassified as adding
the unchanged neighboring `astro` dependency. Dependency removals with a matching lockfile update
must not emit `dependency-addition` or block the gate.
