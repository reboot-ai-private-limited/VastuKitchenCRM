# ADR-0002: MongoDB (Atlas) with Mongoose

**Status:** Accepted

## Context
Fast MVP; flexible documents (proposal line items, feed posts, comments); no complex relational reporting.

## Decision
MongoDB Atlas + Mongoose.

## Consequences
+ Quick iteration, nested documents fit proposals and feeds.
− Dashboard aggregates need care; cross-collection integrity is app-enforced.
