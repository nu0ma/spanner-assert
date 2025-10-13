import { createSpannerAssert } from "./spanner-assert.js";

export const spannerAssert = createSpannerAssert();

export { SpannerAssertionError } from "./errors.js";
