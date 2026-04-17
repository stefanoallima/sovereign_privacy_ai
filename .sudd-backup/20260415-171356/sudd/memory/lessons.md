# SUDD2 Lessons Learned

This file is updated automatically after each task. Agents read it to avoid repeating mistakes.

## Template
- **Task**: [name]
- **What worked**: [approach that succeeded]
- **What failed**: [approach that didn't work]
- **Lesson**: [takeaway for future tasks]

---

## green_form-fill_01 (2026-03-28)

- **Task**: Form-fill pipeline — privacy-first form filling for PDF/DOCX
- **What worked**: Batching 4 independent Rust modules in parallel (T01-T04), then frontend in parallel batches. Full build passed on first try.
- **What failed**: Pipeline was wired but never called (startPipeline dead code). Serde camelCase/snake_case mismatch between TS and Rust. Export commands returned bytes but frontend expected file writing.
- **Lesson**: Always verify the entry point is actually connected. When Rust structs are consumed by TypeScript via Tauri, add `#[serde(rename_all = "camelCase")]` by default. When commands need to write files, accept output_path in Rust rather than returning bytes to the frontend.

- **Task**: DOCX template filling
- **What failed**: Simple string replacement misses Word's run-splitting (text split across `<w:r>` elements)
- **Lesson**: Always normalize DOCX XML runs before text replacement. Use regex to merge adjacent `</w:t></w:r><w:r><w:t>` patterns.

- **Task**: Gap-fill UI interaction
- **What failed**: Both removing from array AND incrementing index caused every-other-field skip
- **Lesson**: Pick one progression strategy — either shrink the array (always read index 0) or advance the index (keep array stable). Never both.
