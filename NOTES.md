## Notes

## RLS Approach

The notes table is protected using Row Level Security (RLS) with two policies: one for SELECT and one for INSERT. Both policies are built around the memberships table, which acts as the source of truth for tenant access.

For reading notes, the SELECT policy uses an EXISTS subquery that checks whether the current user (auth.uid()) belongs to the same group as the note via memberships. This ensures users can only see notes from groups they are actually part of.

For inserting notes, the INSERT policy adds an additional restriction that author_id must match auth.uid(), preventing users from impersonating others. It also reuses the same memberships check to ensure that the target group_id is valid for that user.

Overall, this keeps tenant isolation fully enforced at the database level, meaning access control doesn’t rely on application logic and cannot be bypassed by the API layer.

## How I Used AI

I used Google Antigravity (Claude Opus 4.6) as a pair programming assistant while working through this task. I mainly used it to help me understand the existing project structure, especially the Supabase setup, RLS patterns, and how the documents feature was implemented as a reference.

I also used it to generate a first draft of the notes migration, RLS policies, API route, and test cases. After that, I reviewed and adjusted the outputs to make sure the policies correctly enforced tenant isolation using auth.uid() and that the logic matched the existing patterns in the repository.

For the tests, I verified that asOwner was used for seeding committed data and asUser was used to properly simulate RLS behavior during assertions. I also made sure the test coverage correctly validated both read and write isolation across multiple tenants.
