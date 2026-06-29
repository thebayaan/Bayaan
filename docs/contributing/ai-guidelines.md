# AI-Assisted Development Guidelines

Bayaan welcomes AI-assisted development. This document explains the project's policy on using AI tools, how to mark AI-generated code, and what reviewers should expect.

---

## Policy

**AI tools are allowed and encouraged.** There is no stigma attached to using AI assistance — the goal is good, working, well-understood code, not handwritten code for its own sake.

**You own everything you submit.** Using an AI tool does not transfer responsibility. If AI-generated code breaks something, introduces a bug, or violates a convention, that is the contributor's responsibility to catch before the PR is opened. Every line in your PR should be code you understand.

---

## In-code marking convention

Mark AI-generated code clearly so reviewers can give it appropriate scrutiny and so the codebase can be audited over time.

### Single line

Add `// @ai` as a trailing comment:

```typescript
const sortedItems = items.sort((a, b) => a.name.localeCompare(b.name)); // @ai
```

### Multi-line block

Wrap the block with `// @ai-start` and `// @ai-end`:

```typescript
// @ai-start
const groupedByCategory = items.reduce(
  (acc, item) => {
    const key = item.category ?? 'uncategorized';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  },
  {} as Record<string, typeof items>,
);
// @ai-end
```

### Whole file

If an entire file was scaffolded by AI (e.g. a new service stub or utility), add this as the first comment in the file:

```typescript
// @ai-generated
```

---

## Review expectations

When reviewing a PR with AI-marked code, reviewers should:

- Check that the logic is actually correct for the use case, not just syntactically valid
- Verify that the code follows project conventions (Pressable not TouchableOpacity, FlashList not FlatList, `usePlayerActions` not `useUnifiedPlayer`, etc.)
- Confirm that any AI-generated types match the actual data shapes in `types/`
- Not assume AI-generated code was tested — ask if it is unclear

---

## What the `@ai` tag is not

The `@ai` tag is **not** a mark of lower quality or a flag for rejection. It is purely a transparency signal. Well-written, well-tested, convention-following AI code is as welcome as handwritten code.

The tag exists so:

1. Reviewers know to read with fresh eyes rather than assume the author understood every line
2. Future maintainers can audit where AI was used if needed
3. The project maintains transparency as a community norm

---

## PR disclosure

The [pull request template](../../.github/PULL_REQUEST_TEMPLATE.md) includes an AI disclosure checkbox:

```
- [ ] AI assistance used? If yes, all AI-generated blocks are marked with `// @ai`
```

Check this box if you used any AI tool to generate code, tests, or documentation included in the PR. Leave it unchecked if you did not.

---

## Scope

This policy applies to:

- TypeScript and TSX source code
- Test files
- Configuration files (e.g. `app.config.js`, babel, metro)

It does not apply to:

- Commit messages (never include AI tool names in commits per project convention)
- PR descriptions (you may write them however you like)
- This documentation (docs are collaborative regardless of how they were drafted)

---

## Examples of acceptable and unacceptable use


| Scenario                                                                                                       | Acceptable? |
| -------------------------------------------------------------------------------------------------------------- | ----------- |
| AI writes a utility function; contributor reads, tests, marks it `// @ai`, and submits                         | Yes         |
| AI generates a full component; contributor reviews for convention compliance, adds `// @ai-generated`, submits | Yes         |
| Contributor pastes AI output without reading it, no `@ai` markers                                              | No          |
| AI suggests a refactor; contributor evaluates and rejects half of it, keeps the rest with markers              | Yes         |
| AI writes a migration script; contributor runs it locally to verify it works                                   | Yes         |


