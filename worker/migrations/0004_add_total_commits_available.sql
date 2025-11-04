-- Add total_commits_available to track how many commits exist beyond what we've cached
-- This allows us to support pagination and indicate when more commits can be loaded

ALTER TABLE repos ADD COLUMN total_commits_available INTEGER DEFAULT 0;
