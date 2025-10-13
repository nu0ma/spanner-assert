import { createSpannerAssert } from "./spanner-assert.ts";

export const spannerAssert = createSpannerAssert();

export { SpannerAssertionError } from "./errors.js";
