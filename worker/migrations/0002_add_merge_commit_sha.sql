-- Migration: Add merge_commit_sha to pull_requests table
-- Adds the merge commit SHA for each pull request

ALTER TABLE pull_requests ADD COLUMN merge_commit_sha TEXT;
