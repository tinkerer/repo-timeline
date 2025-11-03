-- Repos table
CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT NOT NULL UNIQUE,
  last_updated INTEGER NOT NULL, -- Unix timestamp
  last_pr_number INTEGER DEFAULT 0, -- Track highest PR number we've fetched
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_repos_full_name ON repos(full_name);
CREATE INDEX idx_repos_last_updated ON repos(last_updated);

-- Pull Requests table
CREATE TABLE IF NOT EXISTS pull_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  pr_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  merged_at INTEGER NOT NULL, -- Unix timestamp
  merge_commit_sha TEXT, -- Git commit SHA for the merge
  created_at INTEGER NOT NULL,
  FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE,
  UNIQUE(repo_id, pr_number)
);

CREATE INDEX idx_prs_repo_id ON pull_requests(repo_id);
CREATE INDEX idx_prs_merged_at ON pull_requests(merged_at);
CREATE INDEX idx_prs_number ON pull_requests(pr_number);

-- PR Files table - stores file changes for each PR
CREATE TABLE IF NOT EXISTS pr_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pr_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL, -- 'added', 'modified', 'removed', 'renamed'
  additions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  previous_filename TEXT, -- For renamed files
  FOREIGN KEY (pr_id) REFERENCES pull_requests(id) ON DELETE CASCADE
);

CREATE INDEX idx_pr_files_pr_id ON pr_files(pr_id);
CREATE INDEX idx_pr_files_filename ON pr_files(filename);

-- Cache metadata table
CREATE TABLE IF NOT EXISTS cache_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
